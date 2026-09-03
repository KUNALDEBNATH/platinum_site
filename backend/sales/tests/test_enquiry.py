import pytest
from rest_framework import status
from sales.models import Enquiry

@pytest.mark.django_db
class TestEnquiryAPI:

    def test_get_enquiries_happy_path(self, jwt_client, seed_enquiry):
        """Director role should be allowed to view the enquiries list."""
        seed_enquiry(enquiry_id="ENQ001", customer="Alice")
        seed_enquiry(enquiry_id="ENQ002", customer="Bob")
        
        client = jwt_client("director")
        response = client.get("/api/enquiry/")
        
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        assert len(response.data) >= 2
        assert response.data[0]["customer"] in ["Alice", "Bob"]

    def test_get_enquiries_unauthorized(self, api_client):
        """Unauthenticated client must be rejected with 401 Unauthorized."""
        response = api_client.get("/api/enquiry/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_enquiries_forbidden(self, jwt_client):
        """Sales executive role is forbidden from viewing enquiries list."""
        client = jwt_client("sales_executive")
        response = client.get("/api/enquiry/")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_enquiry_happy_path(self, jwt_client):
        """Sales executive role can successfully create a new enquiry."""
        client = jwt_client("sales_executive")
        payload = {
            "id": "ENQ001",
            "customer": "Charlie",
            "vehicle": "MT-15",
            "temperature": "Hot",
            "status": "New Lead",
            "date": "2026-06-13",
            "source": "Walk-in"
        }
        response = client.post("/api/enquiry/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["enquiry_id"] == "ENQ001"
        assert response.data["customer"] == "Charlie"
        assert Enquiry.objects.filter(enquiry_id="ENQ001").exists()

    def test_create_enquiry_unauthorized(self, api_client):
        """Unauthenticated client cannot create an enquiry."""
        payload = {
            "id": "ENQ001",
            "customer": "Charlie",
            "vehicle": "MT-15"
        }
        response = api_client.post("/api/enquiry/create/", payload, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_enquiry_forbidden(self, jwt_client):
        """Manager role is forbidden from creating enquiries."""
        client = jwt_client("manager")
        payload = {
            "id": "ENQ001",
            "customer": "Charlie",
            "vehicle": "MT-15",
            "temperature": "Hot",
            "status": "New Lead",
            "date": "2026-06-13",
            "source": "Walk-in"
        }
        response = client.post("/api/enquiry/create/", payload, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_enquiry_missing_required_fields(self, jwt_client):
        """Creating an enquiry missing primary key 'id' returns 400 Bad Request."""
        client = jwt_client("sales_executive")
        payload = {
            "customer": "Charlie",
            "vehicle": "MT-15"
        }
        response = client.post("/api/enquiry/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "id" in response.data

    def test_create_enquiry_invalid_temperature(self, jwt_client):
        """Enquiry temperature choice field validation check."""
        client = jwt_client("sales_executive")
        payload = {
            "id": "ENQ001",
            "customer": "Charlie",
            "vehicle": "MT-15",
            "temperature": "SuperHot",  # Invalid choice
            "status": "New Lead",
            "date": "2026-06-13",
            "source": "Walk-in"
        }
        response = client.post("/api/enquiry/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "temperature" in response.data

    def test_create_enquiry_invalid_status(self, jwt_client):
        """Enquiry status choice validation check."""
        client = jwt_client("sales_executive")
        payload = {
            "id": "ENQ001",
            "customer": "Charlie",
            "vehicle": "MT-15",
            "temperature": "Hot",
            "status": "Confirmed",  # Invalid status (allowed: Submitted, Draft, Closed, New Lead)
            "date": "2026-06-13",
            "source": "Walk-in"
        }
        response = client.post("/api/enquiry/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "status" in response.data

    def test_create_enquiry_invalid_date(self, jwt_client):
        """Enquiry date field validation check."""
        client = jwt_client("sales_executive")
        payload = {
            "id": "ENQ001",
            "customer": "Charlie",
            "vehicle": "MT-15",
            "temperature": "Hot",
            "status": "New Lead",
            "date": "not-a-valid-date",  # Invalid format
            "source": "Walk-in"
        }
        response = client.post("/api/enquiry/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "date" in response.data

    def test_create_enquiry_duplicate_id(self, jwt_client, seed_enquiry):
        """Creating an enquiry with a duplicate enquiry_id returns 400 Bad Request."""
        seed_enquiry(enquiry_id="ENQ999")
        
        client = jwt_client("sales_executive")
        payload = {
            "id": "ENQ999",  # Duplicate ID
            "customer": "Dave",
            "vehicle": "FZ-S",
            "temperature": "Hot",
            "status": "New Lead",
            "date": "2026-06-13",
            "source": "Walk-in"
        }
        response = client.post("/api/enquiry/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "enquiry_id" in response.data

    def test_create_enquiry_empty_body(self, jwt_client):
        """Creating an enquiry with empty JSON payload returns 400 Bad Request."""
        client = jwt_client("sales_executive")
        response = client.post("/api/enquiry/create/", {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
