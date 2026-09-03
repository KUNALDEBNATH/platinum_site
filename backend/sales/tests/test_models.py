from datetime import date
import pytest
from django.contrib.auth import get_user_model
from sales.models import Appointment, Enquiry, Feedback, Profile

@pytest.mark.django_db
class TestSalesModels:

    def test_create_profile(self):
        User = get_user_model()
        user = User.objects.create_user(username="testuser", password="testpassword")
        profile = Profile.objects.get(user=user)
        assert profile.role == 'sales'
        profile.role = 'director'
        profile.save()
        assert profile.role == 'director'

    def test_create_enquiry(self):
        """Unit test to verify Enquiry model constraints and data save."""
        enquiry = Enquiry.objects.create(
            enquiry_id="ENQ001",
            customer="John Doe",
            vehicle="FZ-S",
            temperature="Hot",
            status="New Lead",
            date=date(2026, 5, 26),
            source="Walk-in"
        )
        assert enquiry.enquiry_id == "ENQ001"
        assert enquiry.customer == "John Doe"
        assert enquiry.vehicle == "FZ-S"
        assert enquiry.status == "New Lead"

    def test_create_appointment(self):
        """Verify Appointment creation."""
        appointment = Appointment.objects.create(
            appointment_id="APP001",
            customer="John Doe",
            vehicle="FZ-S",
            status="Scheduled",
            date=date(2026, 5, 27),
            time="10:00 AM"
        )
        assert appointment.appointment_id == "APP001"
        assert appointment.customer == "John Doe"
        assert appointment.time == "10:00 AM"

    def test_create_feedback(self):
        """Verify Feedback model."""
        feedback = Feedback.objects.create(
            feedback_id="FB001",
            enquiry_id="ENQ001",
            customer="John Doe",
            vehicle="FZ-S",
            status="Submitted",
            date=date(2026, 5, 28)
        )
        assert feedback.feedback_id == "FB001"
        assert feedback.customer == "John Doe"
        assert feedback.status == "Submitted"
