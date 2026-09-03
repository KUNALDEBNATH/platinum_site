import pytest
from datetime import date
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from sales.models import Enquiry, Appointment, Feedback, Profile

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def make_user(db):
    def _make_user(username, role, password="Password123"):
        user = get_user_model().objects.create_user(
            username=username,
            password=password,
            role=role,
        )
        # Ensure profile exists and role is aligned
        profile, _ = Profile.objects.get_or_create(user=user)
        if role == 'director':
            profile.role = 'director'
        elif role == 'manager' or role == 'salesmanager':
            profile.role = 'salesmanager'
        elif role == 'sales_executive' or role == 'sales':
            profile.role = 'sales'
        elif role == 'admin':
            profile.role = 'admin'
            user.is_superuser = True
            user.is_staff = True
            user.save()
        profile.save()
        return user
    return _make_user

@pytest.fixture
def auth_client(api_client, make_user):
    def _auth_client(role, username=None):
        user = make_user(username or role, role)
        api_client.force_authenticate(user=user)
        return api_client
    return _auth_client

@pytest.fixture
def jwt_client(api_client, make_user):
    def _jwt_client(role, username=None, password="Password123"):
        username = username or f"{role}_jwt_test"
        user = make_user(username, role, password=password)
        r = api_client.post(
            "/api/token/",
            {"username": username, "password": password},
            format="json"
        )
        token = r.data.get("access")
        client = APIClient()
        if token:
            client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client
    return _jwt_client

@pytest.fixture
def seed_enquiry(db):
    def _seed(enquiry_id="ENQ001", customer="John Test", vehicle="FZ-S", temperature="Hot", status="New Lead"):
        return Enquiry.objects.create(
            enquiry_id=enquiry_id,
            customer=customer,
            vehicle=vehicle,
            temperature=temperature,
            status=status,
            date=date(2026, 6, 13),
            source="Walk-in"
        )
    return _seed

@pytest.fixture
def seed_appointment(db):
    def _seed(appointment_id="APP001", customer="John Test", vehicle="FZ-S", status="Scheduled"):
        return Appointment.objects.create(
            appointment_id=appointment_id,
            customer=customer,
            vehicle=vehicle,
            status=status,
            date=date(2026, 6, 13),
            time="10:00 AM"
        )
    return _seed

@pytest.fixture
def seed_feedback(db):
    def _seed(feedback_id="FB001", enquiry_id="ENQ001", customer="John Test", vehicle="FZ-S", status="Submitted"):
        return Feedback.objects.create(
            feedback_id=feedback_id,
            enquiry_id=enquiry_id,
            customer=customer,
            vehicle=vehicle,
            status=status,
            date=date(2026, 6, 13),
            rating=5,
            feedback_text="Good service"
        )
    return _seed
