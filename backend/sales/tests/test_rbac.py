import pytest
from rest_framework import status

@pytest.mark.django_db
class TestRoleBasedAccessControlMatrix:

    @pytest.mark.parametrize(
        ("role", "method", "endpoint", "payload", "expected_status"),
        [
            # --- /api/enquiry/ ---
            ("director", "get", "/api/enquiry/", None, status.HTTP_200_OK),
            ("admin", "get", "/api/enquiry/", None, status.HTTP_200_OK),
            ("manager", "get", "/api/enquiry/", None, status.HTTP_403_FORBIDDEN),
            ("sales_executive", "get", "/api/enquiry/", None, status.HTTP_403_FORBIDDEN),

            # --- /api/enquiry/create/ ---
            ("sales_executive", "post", "/api/enquiry/create/", {
                "id": "ENQ_RBAC_1", "customer": "Test", "vehicle": "MT", "temperature": "Hot",
                "status": "New Lead", "date": "2026-06-13", "source": "Walk-in"
            }, status.HTTP_201_CREATED),
            ("admin", "post", "/api/enquiry/create/", {
                "id": "ENQ_RBAC_2", "customer": "Test", "vehicle": "MT", "temperature": "Hot",
                "status": "New Lead", "date": "2026-06-13", "source": "Walk-in"
            }, status.HTTP_201_CREATED),
            ("director", "post", "/api/enquiry/create/", {
                "id": "ENQ_RBAC_3", "customer": "Test", "vehicle": "MT", "temperature": "Hot",
                "status": "New Lead", "date": "2026-06-13", "source": "Walk-in"
            }, status.HTTP_403_FORBIDDEN),
            ("manager", "post", "/api/enquiry/create/", {
                "id": "ENQ_RBAC_4", "customer": "Test", "vehicle": "MT", "temperature": "Hot",
                "status": "New Lead", "date": "2026-06-13", "source": "Walk-in"
            }, status.HTTP_403_FORBIDDEN),

            # --- /api/appointment/ ---
            ("director", "get", "/api/appointment/", None, status.HTTP_200_OK),
            ("manager", "get", "/api/appointment/", None, status.HTTP_200_OK),
            ("admin", "get", "/api/appointment/", None, status.HTTP_200_OK),
            ("sales_executive", "get", "/api/appointment/", None, status.HTTP_403_FORBIDDEN),

            # --- /api/appointment/create/ ---
            ("manager", "post", "/api/appointment/create/", {
                "id": "APP_RBAC_1", "customer": "Test", "vehicle": "MT", "status": "Scheduled",
                "date": "2026-06-13", "time": "10:00 AM"
            }, status.HTTP_201_CREATED),
            ("admin", "post", "/api/appointment/create/", {
                "id": "APP_RBAC_2", "customer": "Test", "vehicle": "MT", "status": "Scheduled",
                "date": "2026-06-13", "time": "10:00 AM"
            }, status.HTTP_201_CREATED),
            ("director", "post", "/api/appointment/create/", {
                "id": "APP_RBAC_3", "customer": "Test", "vehicle": "MT", "status": "Scheduled",
                "date": "2026-06-13", "time": "10:00 AM"
            }, status.HTTP_403_FORBIDDEN),
            ("sales_executive", "post", "/api/appointment/create/", {
                "id": "APP_RBAC_4", "customer": "Test", "vehicle": "MT", "status": "Scheduled",
                "date": "2026-06-13", "time": "10:00 AM"
            }, status.HTTP_403_FORBIDDEN),

            # --- /api/feedback/ ---
            ("director", "get", "/api/feedback/", None, status.HTTP_200_OK),
            ("admin", "get", "/api/feedback/", None, status.HTTP_200_OK),
            ("manager", "get", "/api/feedback/", None, status.HTTP_403_FORBIDDEN),
            ("sales_executive", "get", "/api/feedback/", None, status.HTTP_403_FORBIDDEN),

            # --- /api/feedback/create/ ---
            ("sales_executive", "post", "/api/feedback/create/", {
                "id": "FB_RBAC_1", "enquiry_id": "ENQ100", "customer": "Test", "vehicle": "MT",
                "status": "Submitted", "date": "2026-06-13"
            }, status.HTTP_201_CREATED),
            ("admin", "post", "/api/feedback/create/", {
                "id": "FB_RBAC_2", "enquiry_id": "ENQ100", "customer": "Test", "vehicle": "MT",
                "status": "Submitted", "date": "2026-06-13"
            }, status.HTTP_201_CREATED),
            ("director", "post", "/api/feedback/create/", {
                "id": "FB_RBAC_3", "enquiry_id": "ENQ100", "customer": "Test", "vehicle": "MT",
                "status": "Submitted", "date": "2026-06-13"
            }, status.HTTP_403_FORBIDDEN),
            ("manager", "post", "/api/feedback/create/", {
                "id": "FB_RBAC_4", "enquiry_id": "ENQ100", "customer": "Test", "vehicle": "MT",
                "status": "Submitted", "date": "2026-06-13"
            }, status.HTTP_403_FORBIDDEN),

            # --- /api/director/revenue/ ---
            ("director", "get", "/api/director/revenue/", None, status.HTTP_200_OK),
            ("admin", "get", "/api/director/revenue/", None, status.HTTP_200_OK),
            ("manager", "get", "/api/director/revenue/", None, status.HTTP_403_FORBIDDEN),
            ("sales_executive", "get", "/api/director/revenue/", None, status.HTTP_403_FORBIDDEN),

            # --- /api/director/dashboard/ ---
            ("director", "get", "/api/director/dashboard/", None, status.HTTP_200_OK),
            ("admin", "get", "/api/director/dashboard/", None, status.HTTP_200_OK),
            ("manager", "get", "/api/director/dashboard/", None, status.HTTP_403_FORBIDDEN),
            ("sales_executive", "get", "/api/director/dashboard/", None, status.HTTP_403_FORBIDDEN),

            # --- /api/admin/logs/ ---
            ("admin", "get", "/api/admin/logs/", None, status.HTTP_200_OK),
            ("director", "get", "/api/admin/logs/", None, status.HTTP_403_FORBIDDEN),
            ("manager", "get", "/api/admin/logs/", None, status.HTTP_403_FORBIDDEN),
            ("sales_executive", "get", "/api/admin/logs/", None, status.HTTP_403_FORBIDDEN),
        ]
    )
    def test_rbac_matrix_endpoints(self, jwt_client, role, method, endpoint, payload, expected_status):
        """Matrix test to ensure correct permission enforcement across roles."""
        client = jwt_client(role, username=f"rbac_{role}_{method}")
        
        if method == "get":
            response = client.get(endpoint)
        else:
            response = client.post(endpoint, payload, format="json")

        assert response.status_code == expected_status, (
            f"Failed: Role '{role}' accessing '{method.upper()} {endpoint}' "
            f"returned {response.status_code}, expected {expected_status}. Response: {response.content}"
        )

    def test_unauthenticated_requests_return_401(self, api_client):
        """Verify all protected endpoints reject anonymous clients with 401 Unauthorized."""
        endpoints = [
            ("/api/enquiry/", "get"),
            ("/api/enquiry/create/", "post"),
            ("/api/appointment/", "get"),
            ("/api/appointment/create/", "post"),
            ("/api/feedback/", "get"),
            ("/api/feedback/create/", "post"),
            ("/api/director/revenue/", "get"),
            ("/api/director/dashboard/", "get"),
            ("/api/admin/logs/", "get"),
            ("/api/auth/me/", "get")
        ]
        
        for endpoint, method in endpoints:
            if method == "get":
                response = api_client.get(endpoint)
            else:
                response = api_client.post(endpoint, {}, format="json")
            
            assert response.status_code == status.HTTP_401_UNAUTHORIZED, (
                f"Expected 401 for anonymous access to {endpoint}, got {response.status_code}"
            )
