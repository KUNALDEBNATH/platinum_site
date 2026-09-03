import pytest
from rest_framework import status
from sales.models import Feedback

@pytest.mark.django_db
class TestFeedbackAPI:

    def test_get_feedback_happy_path(self, jwt_client, seed_feedback):
        """Director role is allowed to view feedback submissions."""
        seed_feedback(feedback_id="FB001", customer="John Feedback")
        
        client = jwt_client("director")
        response = client.get("/api/feedback/")
        
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        assert len(response.data) >= 1

    def test_get_feedback_unauthorized(self, api_client):
        """Unauthenticated client must be rejected with 401 Unauthorized."""
        response = api_client.get("/api/feedback/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_feedback_forbidden(self, jwt_client):
        """Manager role is forbidden from retrieving feedback list."""
        client = jwt_client("manager")
        response = client.get("/api/feedback/")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_feedback_happy_path(self, jwt_client):
        """Sales executive role can record a new user feedback."""
        client = jwt_client("sales_executive")
        payload = {
            "id": "FB001",
            "enquiry_id": "ENQ100",
            "customer": "Karan",
            "vehicle": "MT-15",
            "status": "Submitted",
            "date": "2026-06-13",
            "rating": 4,
            "feedback_text": "Good performance"
        }
        response = client.post("/api/feedback/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["feedback_id"] == "FB001"
        assert response.data["customer"] == "Karan"
        assert Feedback.objects.filter(feedback_id="FB001").exists()

    def test_create_feedback_unauthorized(self, api_client):
        """Unauthenticated client cannot record feedback."""
        payload = {"id": "FB001", "customer": "Karan"}
        response = api_client.post("/api/feedback/create/", payload, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_feedback_forbidden(self, jwt_client):
        """Director role is forbidden from creating feedback."""
        client = jwt_client("director")
        payload = {
            "id": "FB001",
            "enquiry_id": "ENQ100",
            "customer": "Karan",
            "vehicle": "MT-15",
            "status": "Submitted",
            "date": "2026-06-13"
        }
        response = client.post("/api/feedback/create/", payload, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_feedback_missing_required_fields(self, jwt_client):
        """Creating feedback missing primary 'id' returns 400."""
        client = jwt_client("sales_executive")
        payload = {
            "enquiry_id": "ENQ100",
            "customer": "Karan"
        }
        response = client.post("/api/feedback/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "id" in response.data

    def test_create_feedback_duplicate_id(self, jwt_client, seed_feedback):
        """Creating feedback with a duplicate identifier returns 400."""
        seed_feedback(feedback_id="FB999")
        
        client = jwt_client("sales_executive")
        payload = {
            "id": "FB999",  # Duplicate ID
            "enquiry_id": "ENQ100",
            "customer": "Karan",
            "vehicle": "MT-15",
            "status": "Submitted",
            "date": "2026-06-13"
        }
        response = client.post("/api/feedback/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "feedback_id" in response.data

    def test_create_feedback_empty_body(self, jwt_client):
        """Submitting an empty JSON payload returns 400 Bad Request."""
        client = jwt_client("sales_executive")
        response = client.post("/api/feedback/create/", {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
