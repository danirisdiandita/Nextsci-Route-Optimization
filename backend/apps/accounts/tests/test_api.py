from django.test import TestCase
from rest_framework.test import APIClient

from ..models import User

TOKEN_URL = "/api/v1/auth/token/"
REFRESH_URL = "/api/v1/auth/token/refresh/"
ME_URL = "/api/v1/auth/me/"
PASSWORD = "correct-horse-battery"


class AuthApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            "driver@example.com", PASSWORD, first_name="Dee", last_name="Driver"
        )

    def obtain(self, password=PASSWORD):
        return self.client.post(
            TOKEN_URL, {"email": "driver@example.com", "password": password}, format="json"
        )

    def test_obtain_token_with_valid_credentials(self):
        response = self.obtain()
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_obtain_token_with_wrong_password(self):
        response = self.obtain(password="wrong-password")
        self.assertEqual(response.status_code, 401)

    def test_me_requires_token(self):
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, 401)

    def test_me_returns_current_user(self):
        access = self.obtain().data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {
                "id": self.user.id,
                "email": "driver@example.com",
                "first_name": "Dee",
                "last_name": "Driver",
            },
        )

    def test_refresh_returns_working_access_token(self):
        refresh = self.obtain().data["refresh"]
        response = self.client.post(REFRESH_URL, {"refresh": refresh}, format="json")
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        self.assertEqual(self.client.get(ME_URL).data["email"], "driver@example.com")


class UserManagerTests(TestCase):
    def test_create_user_lowercases_email_domain(self):
        user = User.objects.create_user("Jane.Doe@EXAMPLE.COM", PASSWORD)
        self.assertEqual(user.email, "Jane.Doe@example.com")
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_create_superuser_grants_admin_flags(self):
        admin = User.objects.create_superuser("admin@example.com", PASSWORD)
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)
