import pytest
from rest_framework import status

@pytest.mark.django_db
class TestSerializerValidationConstraints:

    def test_enquiry_validation_missing_required(self, jwt_client):
        """Omit mandatory fields to verify serializer error mappings."""
        client = jwt_client("sales_executive")
        payload = {
            "id": "ENQ_VAL_1",
            # missing customer, vehicle, temperature, status, date, source
        }
        response = client.post("/api/enquiry/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        for field in ["customer", "vehicle", "temperature", "status", "date", "source"]:
            assert field in response.data

    def test_enquiry_validation_invalid_types(self, jwt_client):
        """Passing incorrect data types (like an array for status) triggers validation errors."""
        client = jwt_client("sales_executive")
        payload = {
            "id": "ENQ_VAL_2",
            "customer": 12345,  # Invalid data type (should be string)
            "vehicle": True,     # Invalid data type (should be string)
            "temperature": ["Hot"],  # List instead of string
            "status": {"name": "New Lead"}, # Dict instead of string
            "date": "2026/06/13", # Wrong format (expected YYYY-MM-DD)
            "source": "Walk-in"
        }
        response = client.post("/api/enquiry/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "date" in response.data

    def test_enquiry_validation_oversized_payload_id(self, jwt_client):
        """Enquiry ID exceeding the model length constraint (>20 characters) should be rejected."""
        client = jwt_client("sales_executive")
        payload = {
            "id": "ENQ_WAY_TOO_LONG_IDENTIFIER_123456",  # 33 characters
            "customer": "Test",
            "vehicle": "FZ",
            "temperature": "Hot",
            "status": "New Lead",
            "date": "2026-06-13",
            "source": "Walk-in"
        }
        response = client.post("/api/enquiry/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        # Validation error raised because mapped enquiry_id inherits model constraints
        assert "enquiry_id" in response.data or "id" in response.data

    def test_appointment_validation_missing_required(self, jwt_client):
        """Omitting required fields in appointment creation returns 400."""
        client = jwt_client("manager")
        payload = {"id": "APP_VAL_1"}
        response = client.post("/api/appointment/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        for field in ["customer", "vehicle", "status", "date", "time"]:
            assert field in response.data

    def test_appointment_validation_invalid_status_enum(self, jwt_client):
        """Appointment status validation checks enum restrictions (Scheduled, Pending, Completed)."""
        client = jwt_client("manager")
        payload = {
            "id": "APP_VAL_2",
            "customer": "Kunal",
            "vehicle": "FZ",
            "status": "Cancelled",  # Invalid enum value
            "date": "2026-06-13",
            "time": "10:00 AM"
        }
        response = client.post("/api/appointment/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "status" in response.data

    def test_feedback_validation_missing_required(self, jwt_client):
        """Omitting required fields in feedback creation returns 400."""
        client = jwt_client("sales_executive")
        payload = {"id": "FB_VAL_1"}
        response = client.post("/api/feedback/create/", payload, format="json")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        for field in ["enquiry_id", "customer", "vehicle", "status", "date"]:
            assert field in response.data

    def test_empty_request_bodies(self, jwt_client):
        """Validates that all creation endpoints cleanly reject empty bodies."""
        sales_client = jwt_client("sales_executive")
        manager_client = jwt_client("manager")
        
        # Enquiry create
        res_enq = sales_client.post("/api/enquiry/create/", {}, format="json")
        assert res_enq.status_code == status.HTTP_400_BAD_REQUEST
        
        # Appointment create
        res_app = manager_client.post("/api/appointment/create/", {}, format="json")
        assert res_app.status_code == status.HTTP_400_BAD_REQUEST
        
        # Feedback create
        res_fb = sales_client.post("/api/feedback/create/", {}, format="json")
        assert res_fb.status_code == status.HTTP_400_BAD_REQUEST
