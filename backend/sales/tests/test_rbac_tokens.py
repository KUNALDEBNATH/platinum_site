import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from sales.models import Profile

@pytest.fixture
def rbac_clients():
    User = get_user_model()
    
    # 1. Create Director User & Profile
    director_user, _ = User.objects.get_or_create(username="director_qa", email="director@qa.com")
    director_user.set_password("directorpass")
    director_user.save()
    dir_profile, _ = Profile.objects.get_or_create(user=director_user)
    dir_profile.role = 'director'
    dir_profile.save()

    # 2. Create Admin User & Profile
    admin_user, _ = User.objects.get_or_create(username="admin_qa", email="admin@qa.com")
    admin_user.set_password("adminpass")
    admin_user.save()
    admin_profile, _ = Profile.objects.get_or_create(user=admin_user)
    admin_profile.role = 'admin'
    admin_profile.save()

    # 3. Create Sales User & Profile
    sales_user, _ = User.objects.get_or_create(username="sales_qa", email="sales@qa.com")
    sales_user.set_password("salespass")
    sales_user.save()
    sales_profile, _ = Profile.objects.get_or_create(user=sales_user)
    sales_profile.role = 'sales'
    sales_profile.save()

    # Reload from database to clear in-memory caches and ensure related profiles are loaded fresh
    director_user = User.objects.select_related('profile').get(pk=director_user.pk)
    admin_user = User.objects.select_related('profile').get(pk=admin_user.pk)
    sales_user = User.objects.select_related('profile').get(pk=sales_user.pk)

    # Create clients with tokens
    dir_client = APIClient()
    dir_client.force_authenticate(user=director_user)

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin_user)

    sales_client = APIClient()
    sales_client.force_authenticate(user=sales_user)

    return {
        "director": dir_client,
        "admin": admin_client,
        "sales": sales_client
    }

@pytest.mark.django_db
class TestRBACAccessControl:

    def test_director_access(self, rbac_clients):
        # Director accesses director-only revenue endpoint -> 200
        res = rbac_clients["director"].get("/api/director/revenue/")
        assert res.status_code == 200

        # Director accesses admin-only logs endpoint -> 403
        res = rbac_clients["director"].get("/api/admin/logs/")
        assert res.status_code == 403

    def test_admin_access(self, rbac_clients):
        # Admin accesses admin-only logs endpoint -> 200
        res = rbac_clients["admin"].get("/api/admin/logs/")
        assert res.status_code == 200

        # Admin is super-role and can access director analytics endpoints -> 200
        res = rbac_clients["admin"].get("/api/director/revenue/")
        assert res.status_code == 200

    def test_sales_access(self, rbac_clients):
        # Sales accesses director-only revenue endpoint -> 403
        res = rbac_clients["sales"].get("/api/director/revenue/")
        assert res.status_code == 403

        # Sales accesses admin-only logs endpoint -> 403
        res = rbac_clients["sales"].get("/api/admin/logs/")
        assert res.status_code == 403
