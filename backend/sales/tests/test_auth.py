import pytest
from rest_framework import status
from django.contrib.auth import get_user_model

@pytest.mark.django_db
class TestAuthenticationAPI:

    def test_token_obtain_happy_path(self, api_client, make_user):
        """Verify obtaining JWT tokens with valid credentials returns expected properties."""
        username = "auth_test_user"
        password = "Password123"
        make_user(username, "sales_executive", password=password)

        payload = {"username": username, "password": password}
        response = api_client.post("/api/token/", payload, format="json")
        
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert "refresh" in response.data
        assert response.data["role"] == "sales_executive"
        assert response.data["username"] == username

    def test_token_obtain_invalid_credentials(self, api_client, make_user):
        """Obtaining JWT tokens with an invalid password should return 401 Unauthorized."""
        username = "auth_test_user"
        make_user(username, "sales_executive", password="Password123")

        payload = {"username": username, "password": "WrongPassword"}
        response = api_client.post("/api/token/", payload, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_token_obtain_missing_fields(self, api_client):
        """Obtaining JWT tokens with missing required fields should return 400 Bad Request."""
        payload = {"username": "auth_test_user"}
        response = api_client.post("/api/token/", payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password" in response.data

    def test_token_obtain_empty_body(self, api_client):
        """Obtaining JWT tokens with an empty body should return 400 Bad Request."""
        response = api_client.post("/api/token/", {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_token_refresh_happy_path(self, api_client, make_user):
        """Refreshing a valid refresh token should yield a new access token."""
        username = "refresh_test_user"
        password = "Password123"
        make_user(username, "manager", password=password)

        # Obtain refresh token first
        obtain_payload = {"username": username, "password": password}
        obtain_res = api_client.post("/api/token/", obtain_payload, format="json")
        refresh_token = obtain_res.data["refresh"]

        refresh_payload = {"refresh": refresh_token}
        response = api_client.post("/api/token/refresh/", refresh_payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data

    def test_token_refresh_invalid_token(self, api_client):
        """Refreshing with an invalid token should return 401 Unauthorized."""
        payload = {"refresh": "invalid_refresh_token_string"}
        response = api_client.post("/api/token/refresh/", payload, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_token_refresh_missing_token(self, api_client):
        """Refreshing with a missing token should return 400 Bad Request."""
        response = api_client.post("/api/token/refresh/", {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_auth_me_happy_path(self, jwt_client):
        """Accessing profile endpoint with a valid JWT token should succeed."""
        client = jwt_client("director", username="director_me")
        response = client.get("/api/auth/me/")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["username"] == "director_me"
        assert response.data["role"] == "director"

    def test_auth_me_unauthorized(self, api_client):
        """Accessing profile endpoint without authorization should return 401 Unauthorized."""
        response = api_client.get("/api/auth/me/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_user_registration_happy_path(self, api_client):
        """Registering a new user with valid fields should return 201 Created."""
        payload = {
            "username": "new_reg_user",
            "password": "Password123",
            "email": "new_reg@test.com",
            "first_name": "New",
            "last_name": "User",
            "role": "sales_executive"
        }
        response = api_client.post("/api/register/", payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["username"] == "new_reg_user"
        assert "password" not in response.data

    def test_user_registration_duplicate_username(self, api_client, make_user):
        """Registering with an existing username should return 400 Bad Request."""
        make_user("existing_user", "sales_executive")

        payload = {
            "username": "existing_user",
            "password": "Password123",
            "email": "new@test.com",
            "role": "sales_executive"
        }
        response = api_client.post("/api/register/", payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "username" in response.data

    def test_user_registration_missing_fields(self, api_client):
        """Registering without username or password should return 400 Bad Request."""
        payload = {
            "email": "missing@test.com",
            "role": "sales_executive"
        }
        response = api_client.post("/api/register/", payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "username" in response.data
        assert "password" in response.data
