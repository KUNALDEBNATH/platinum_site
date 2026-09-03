import os
import sys
import pytest
from rest_framework import status
from sales.models import Enquiry, Appointment, Feedback
from datetime import date

# Import services first to initialize our custom chatbot module inside sys.modules
import sales.services
import sys
chatbot_test_module = sys.modules["test"]
# Mock the causal model loading function so that unit tests run fast and offline without downloading gigabytes of models
chatbot_test_module._load_llm = lambda: False

@pytest.fixture(autouse=True)
def reset_chatbot_singleton():
    sales.services.reset_chatbot_instance()
    yield
    sales.services.reset_chatbot_instance()

@pytest.fixture
def seed_test_data():
    # Seed basic enquiry, appointment, and feedback to verify RAG/database alignment
    Enquiry.objects.create(
        enquiry_id="ENQ001",
        customer="Dinesh",
        vehicle="R15",
        temperature="Hot",
        status="New Lead",
        date=date(2026, 5, 26),
        source="Walk-in"
    )
    Appointment.objects.create(
        appointment_id="APP001",
        customer="Dinesh",
        vehicle="R15",
        status="Scheduled",
        date=date(2026, 5, 27),
        time="10:00 AM"
    )
    Feedback.objects.create(
        feedback_id="FB001",
        enquiry_id="ENQ001",
        customer="Dinesh",
        vehicle="R15",
        status="Submitted",
        date=date(2026, 5, 28)
    )

@pytest.mark.django_db
class TestChatbotAPI:

    def test_health_api(self, api_client):
        """Verify the health API endpoint return values."""
        response = api_client.get("/api/health/")
        assert response.status_code == status.HTTP_200_OK
        assert "status" in response.data
        assert "chatbot_ready" in response.data

    def test_suggestions_api(self, api_client):
        """Verify the suggestions API endpoint structure."""
        response = api_client.get("/api/suggestions/")
        assert response.status_code == status.HTTP_200_OK
        assert "suggestions" in response.data
        assert isinstance(response.data["suggestions"], list)
        assert len(response.data["suggestions"]) > 0

    def test_chat_api_missing_query(self, api_client):
        """Verify that the chat API correctly flags missing 'query' parameter."""
        response = api_client.post("/api/chat/", {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.data

    def test_chat_api_valid_query(self, api_client, seed_test_data):
        """Verify that the chat API successfully retrieves seeded customer data."""
        # Ensure LLM is mocked on active chatbot singleton instance
        from sales.services import get_chatbot_instance
        get_chatbot_instance().use_llm = False
        
        response = api_client.post("/api/chat/", {"query": "Show Dinesh details"}, format="json")
        assert response.status_code == status.HTTP_200_OK, f"Response: {response.content.decode()}"
        assert "answer" in response.data
        assert "intent" in response.data
        assert "elapsed" in response.data
        # RAG should extract the customer Dinesh and provide details in the answer
        assert "Dinesh" in response.data["answer"]

    def test_chatbot_rebuilds_after_enquiry_create(self, api_client, auth_client):
        """Verify the chatbot sees CRM records created after initialisation."""
        health = api_client.get("/api/health/")
        assert health.status_code == status.HTTP_200_OK
        sales_client = auth_client("sales_executive")

        payload = {
            "id": "ENQ999",
            "customer": "Postman QA",
            "vehicle": "R15",
            "temperature": "Hot",
            "status": "New Lead",
            "date": "2026-05-26",
            "source": "Postman",
        }
        created = sales_client.post("/api/enquiry/create/", payload, format="json")
        assert created.status_code == status.HTTP_201_CREATED

        response = api_client.post("/api/chat/", {"query": "Show ENQ999 full details"}, format="json")
        assert response.status_code == status.HTTP_200_OK, f"Response: {response.content.decode()}"
        assert "ENQ999" in response.data["answer"]
        assert "Postman QA" in response.data["answer"]

    def test_reset_chat_api(self, api_client):
        """Verify the chat conversation reset endpoint."""
        response = api_client.post("/api/reset/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "ok"
