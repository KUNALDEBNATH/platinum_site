import pytest
from rest_framework import status


@pytest.mark.django_db
class TestRoleIdentificationAndPermissions:
    def test_token_response_includes_role_and_username(self, api_client, make_user):
        make_user("director_user", "director")

        response = api_client.post(
            "/api/token/",
            {"username": "director_user", "password": "Password123"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["role"] == "director"
        assert response.data["username"] == "director_user"
        assert "access" in response.data
        assert "refresh" in response.data

    @pytest.mark.parametrize(
        ("role", "method", "path", "expected_status"),
        [
            ("director", "get", "/api/enquiry/", status.HTTP_200_OK),
            ("manager", "get", "/api/enquiry/", status.HTTP_403_FORBIDDEN),
            ("sales_executive", "get", "/api/enquiry/", status.HTTP_403_FORBIDDEN),
            ("director", "get", "/api/appointment/", status.HTTP_200_OK),
            ("manager", "get", "/api/appointment/", status.HTTP_200_OK),
            ("sales_executive", "get", "/api/appointment/", status.HTTP_403_FORBIDDEN),
            ("director", "get", "/api/feedback/", status.HTTP_200_OK),
            ("manager", "get", "/api/feedback/", status.HTTP_403_FORBIDDEN),
            ("sales_executive", "get", "/api/feedback/", status.HTTP_403_FORBIDDEN),
        ],
    )
    def test_read_endpoint_role_permissions(
        self,
        auth_client,
        role,
        method,
        path,
        expected_status,
    ):
        client = auth_client(role, username=f"{role}_{path.replace('/', '_')}")

        response = getattr(client, method)(path)

        assert response.status_code == expected_status

    @pytest.mark.parametrize(
        ("role", "path", "payload", "expected_status"),
        [
            (
                "sales_executive",
                "/api/enquiry/create/",
                {
                    "id": "ENQ-PERM-1",
                    "customer": "Role Test",
                    "vehicle": "R15",
                    "temperature": "Hot",
                    "status": "New Lead",
                    "date": "2026-05-26",
                    "source": "Walk-in",
                },
                status.HTTP_201_CREATED,
            ),
            (
                "manager",
                "/api/enquiry/create/",
                {
                    "id": "ENQ-PERM-2",
                    "customer": "Role Test",
                    "vehicle": "R15",
                    "temperature": "Hot",
                    "status": "New Lead",
                    "date": "2026-05-26",
                    "source": "Walk-in",
                },
                status.HTTP_403_FORBIDDEN,
            ),
            (
                "manager",
                "/api/appointment/create/",
                {
                    "id": "APP-PERM-1",
                    "customer": "Role Test",
                    "vehicle": "R15",
                    "status": "Scheduled",
                    "date": "2026-05-27",
                    "time": "10:00 AM",
                },
                status.HTTP_201_CREATED,
            ),
            (
                "sales_executive",
                "/api/appointment/create/",
                {
                    "id": "APP-PERM-2",
                    "customer": "Role Test",
                    "vehicle": "R15",
                    "status": "Scheduled",
                    "date": "2026-05-27",
                    "time": "10:00 AM",
                },
                status.HTTP_403_FORBIDDEN,
            ),
            (
                "sales_executive",
                "/api/feedback/create/",
                {
                    "id": "FB-PERM-1",
                    "enquiry_id": "ENQ-PERM-1",
                    "customer": "Role Test",
                    "vehicle": "R15",
                    "status": "Submitted",
                    "date": "2026-05-28",
                },
                status.HTTP_201_CREATED,
            ),
            (
                "manager",
                "/api/feedback/create/",
                {
                    "id": "FB-PERM-2",
                    "enquiry_id": "ENQ-PERM-2",
                    "customer": "Role Test",
                    "vehicle": "R15",
                    "status": "Submitted",
                    "date": "2026-05-28",
                },
                status.HTTP_403_FORBIDDEN,
            ),
        ],
    )
    def test_create_endpoint_role_permissions(
        self,
        auth_client,
        role,
        path,
        payload,
        expected_status,
    ):
        client = auth_client(role, username=f"{role}_{payload['id']}")

        response = client.post(path, payload, format="json")

        assert response.status_code == expected_status
