import pytest
from rest_framework import status
from sales.models import Appointment

@pytest.mark.django_db
class TestAppointmentAPI:

    def test_get_appointments_happy_path(self, jwt_client, seed_appointment):
        """Manager and Director roles are allowed to retrieve appointments."""
        seed_appointment(appointment_id="APP001", customer="John Manager")
        
        # Test as Manager
        client_mgr = jwt_client("manager")
        res_mgr = client_mgr.get("/api/appointment/")
        assert res_mgr.status_code == status.HTTP_200_OK
        assert isinstance(res_mgr.data, list)
        
        # Test as Director
        client_dir = jwt_client("director")
        res_dir = client_dir.get("/api/appointment/")
        assert res_dir.status_code == status.HTTP_200_OK

    def test_get_appointments_unauthorized(self, api_client):
        """Unauthenticated client must be rejected with 401 Unauthorized."""
        response = api_client.get("/api/appointment/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_appointments_forbidden(self, jwt_client):
        """Sales executive role is forbidden from viewing appointments list."""
        client = jwt_client("sales_executive")
        response = client.get("/api/appointment/")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_appointment_happy_path(self, jwt_client):
        """Manager role can successfully schedule a new appointment."""
        client = jwt_client("manager")
        payload = {
            "id": "APP001",
            "customer": "Robert",
            "vehicle": "Fazer",
            "status": "Scheduled",
            "date": "2026-06-13",
            "time": "11:00 AM"
        }
        response = client.post("/api/appointment/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["appointment_id"] == "APP001"
        assert response.data["customer"] == "Robert"
        assert Appointment.objects.filter(appointment_id="APP001").exists()

    def test_create_appointment_unauthorized(self, api_client):
        """Unauthenticated client cannot create an appointment."""
        payload = {"id": "APP001", "customer": "Robert"}
        response = api_client.post("/api/appointment/create/", payload, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_appointment_forbidden(self, jwt_client):
        """Sales executive role cannot create appointments."""
        client = jwt_client("sales_executive")
        payload = {
            "id": "APP001",
            "customer": "Robert",
            "vehicle": "Fazer",
            "status": "Scheduled",
            "date": "2026-06-13",
            "time": "11:00 AM"
        }
        response = client.post("/api/appointment/create/", payload, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_appointment_missing_required_fields(self, jwt_client):
        """Creating an appointment missing primary identifier 'id' returns 400."""
        client = jwt_client("manager")
        payload = {
            "customer": "Robert",
            "vehicle": "Fazer"
        }
        response = client.post("/api/appointment/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "id" in response.data

    def test_create_appointment_invalid_status(self, jwt_client):
        """Appointment status must belong to allowed set (Scheduled, Pending, Completed)."""
        client = jwt_client("manager")
        payload = {
            "id": "APP001",
            "customer": "Robert",
            "vehicle": "Fazer",
            "status": "Rejected",  # Invalid choice
            "date": "2026-06-13",
            "time": "11:00 AM"
        }
        response = client.post("/api/appointment/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "status" in response.data

    def test_create_appointment_duplicate_id(self, jwt_client, seed_appointment):
        """Creating an appointment with a duplicate identifier returns 400."""
        seed_appointment(appointment_id="APP999")
        
        client = jwt_client("manager")
        payload = {
            "id": "APP999",  # Duplicate ID
            "customer": "Susan",
            "vehicle": "Fazer",
            "status": "Scheduled",
            "date": "2026-06-13",
            "time": "11:00 AM"
        }
        response = client.post("/api/appointment/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "appointment_id" in response.data

    def test_create_appointment_empty_body(self, jwt_client):
        """Submitting an empty JSON payload returns 400 Bad Request."""
        client = jwt_client("manager")
        response = client.post("/api/appointment/create/", {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
