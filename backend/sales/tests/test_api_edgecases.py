from datetime import date
import pytest
from rest_framework import status
from sales.models import Enquiry

@pytest.mark.django_db
class TestEnquiryAPIEdgeCases:

    def test_valid_post_request(self, auth_client):
        """QA TestCase 1: Valid POST to Enquiry creation."""
        client = auth_client("sales_executive")
        payload = {
            "id": "ENQ001",
            "customer": "Rithwik",
            "vehicle": "FZ-S",
            "temperature": "Hot",
            "status": "New Lead",
            "date": "2026-05-26",
            "source": "Walk-in"
        }
        res = client.post("/api/enquiry/create/", payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["customer"] == "Rithwik"
        assert res.data["enquiry_id"] == "ENQ001"

    def test_missing_required_fields(self, auth_client):
        """QA TestCase 2: Missing 'id' which is required for identification."""
        client = auth_client("sales_executive")
        payload = {
            "customer": "Rithwik",
            "vehicle": "FZ-S"
        }
        res = client.post("/api/enquiry/create/", payload, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "id" in res.data  # Should flag field as required

    def test_empty_request_body(self, auth_client):
        """QA TestCase 4: Robustness against empty input."""
        client = auth_client("sales_executive")
        res = client.post("/api/enquiry/create/", {}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_when_no_data_exists(self, auth_client):
        """QA TestCase 6: Verify empty state array."""
        client = auth_client("director")
        res = client.get("/api/enquiry/")
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data) == 0

    def test_get_after_multiple_inserts(self, auth_client):
        """QA TestCase 7: Verification of returned enquiry list."""
        client = auth_client("director")
        Enquiry.objects.create(
            enquiry_id="ENQ001",
            customer="T1",
            vehicle="FZ-S",
            temperature="Hot",
            status="New Lead",
            date=date(2026, 5, 26),
            source="Walk-in"
        )
        Enquiry.objects.create(
            enquiry_id="ENQ002",
            customer="T2",
            vehicle="FZ-S",
            temperature="Hot",
            status="New Lead",
            date=date(2026, 5, 26),
            source="Walk-in"
        )
        res = client.get("/api/enquiry/")
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data) == 2
