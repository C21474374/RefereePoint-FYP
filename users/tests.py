from datetime import time
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import RefereeAvailability, User


class UpdateHomeLocationViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="geo@test.com",
            password="password123",
            first_name="Geo",
            last_name="Tester",
            bipin_number="1111",
        )

    @patch("users.views.geocode_address")
    def test_patch_geocodes_address_when_coordinates_not_provided(self, geocode_mock):
        geocode_mock.return_value = (53.3498, -6.2603)
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            reverse("update_home_location"),
            {
                "home_address": "D01 F5P2",
                "home_lat": None,
                "home_lon": None,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.home_address, "D01 F5P2")
        self.assertEqual(self.user.home_lat, 53.3498)
        self.assertEqual(self.user.home_lon, -6.2603)

    @patch("users.views.geocode_address")
    def test_patch_saves_address_with_warning_when_cannot_be_geocoded(self, geocode_mock):
        geocode_mock.return_value = None
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            reverse("update_home_location"),
            {
                "home_address": "Unknown location",
                "home_lat": None,
                "home_lon": None,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("geocode_warning", response.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.home_address, "Unknown location")
        self.assertIsNone(self.user.home_lat)
        self.assertIsNone(self.user.home_lon)

    @patch("users.views.geocode_address")
    def test_patch_keeps_existing_coordinates_when_geocoding_fails(self, geocode_mock):
        geocode_mock.return_value = None
        self.user.home_address = "Old Address"
        self.user.home_lat = 53.1
        self.user.home_lon = -6.1
        self.user.save(update_fields=["home_address", "home_lat", "home_lon"])

        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            reverse("update_home_location"),
            {
                "home_address": "New Address",
                "home_lat": None,
                "home_lon": None,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("geocode_warning", response.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.home_address, "New Address")
        self.assertEqual(self.user.home_lat, 53.1)
        self.assertEqual(self.user.home_lon, -6.1)


class ListRefereesAvailabilityFilterTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.available_user = User.objects.create_user(
            email="available@test.com",
            password="password123",
            first_name="Available",
            last_name="Referee",
            bipin_number="8001",
        )
        self.unavailable_user = User.objects.create_user(
            email="unavailable@test.com",
            password="password123",
            first_name="Unavailable",
            last_name="Referee",
            bipin_number="8002",
        )

        self.available_profile = self.available_user.referee_profile
        self.unavailable_profile = self.unavailable_user.referee_profile

        # Monday schedules:
        # - available profile: 19:00-22:00
        # - unavailable profile: 21:00-22:00
        RefereeAvailability.objects.create(
            referee=self.available_profile,
            day_of_week="MON",
            start_time=time(19, 0),
            end_time=time(22, 0),
        )
        RefereeAvailability.objects.create(
            referee=self.unavailable_profile,
            day_of_week="MON",
            start_time=time(21, 0),
            end_time=time(22, 0),
        )

    def test_list_referees_filters_by_game_date_and_time(self):
        response = self.client.get(
            reverse("list_referees"),
            {"game_date": "2026-04-06", "game_time": "20:00"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        returned_ids = {item["id"] for item in payload}
        self.assertIn(self.available_profile.id, returned_ids)
        self.assertNotIn(self.unavailable_profile.id, returned_ids)

    def test_list_referees_requires_both_date_and_time_when_filtering(self):
        response = self.client.get(
            reverse("list_referees"),
            {"game_date": "2026-04-06"},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
