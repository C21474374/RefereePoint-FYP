from datetime import date

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from clubs.models import Club
from users.models import User
from venues.models import Venue

from .models import Event, EventRefereeAssignment


class EventJoinLeaveAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        club = Club.objects.create(name="Dublin Tournaments Club")
        venue = Venue.objects.create(name="National Tournament Centre", club=club)

        self.ref_user_1 = User.objects.create_user(
            email="ref1@example.com",
            password="password123",
            first_name="Ref",
            last_name="One",
            bipin_number="3001",
        )
        self.ref_1 = self.ref_user_1.referee_profile

        self.ref_user_2 = User.objects.create_user(
            email="ref2@example.com",
            password="password123",
            first_name="Ref",
            last_name="Two",
            bipin_number="3002",
        )
        self.ref_2 = self.ref_user_2.referee_profile

        self.ref_user_3 = User.objects.create_user(
            email="ref3@example.com",
            password="password123",
            first_name="Ref",
            last_name="Three",
            bipin_number="3003",
        )
        self.ref_3 = self.ref_user_3.referee_profile

        self.event = Event.objects.create(
            start_date=date(2026, 6, 1),
            end_date=date(2026, 6, 3),
            venue=venue,
            description="Summer tournament finals weekend.",
            fee_per_game="35.00",
            contact_information="events@refereepoint.test",
            referees_required=2,
            created_by=self.ref_user_1,
        )

    def test_referee_can_join_event(self):
        self.client.force_authenticate(user=self.ref_user_1)

        response = self.client.post(reverse("event-join", kwargs={"pk": self.event.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            EventRefereeAssignment.objects.filter(
                event=self.event,
                referee=self.ref_1,
            ).exists()
        )
        self.assertEqual(response.data["joined_referees_count"], 1)

    def test_event_capacity_blocks_third_referee(self):
        EventRefereeAssignment.objects.create(event=self.event, referee=self.ref_1)
        EventRefereeAssignment.objects.create(event=self.event, referee=self.ref_2)

        self.client.force_authenticate(user=self.ref_user_3)
        response = self.client.post(reverse("event-join", kwargs={"pk": self.event.pk}))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "This event is already full.")

    def test_referee_can_leave_then_other_referee_can_join(self):
        EventRefereeAssignment.objects.create(event=self.event, referee=self.ref_1)
        EventRefereeAssignment.objects.create(event=self.event, referee=self.ref_2)

        self.client.force_authenticate(user=self.ref_user_1)
        leave_response = self.client.post(reverse("event-leave", kwargs={"pk": self.event.pk}))
        self.assertEqual(leave_response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            EventRefereeAssignment.objects.filter(
                event=self.event,
                referee=self.ref_1,
            ).exists()
        )

        self.client.force_authenticate(user=self.ref_user_3)
        join_response = self.client.post(reverse("event-join", kwargs={"pk": self.event.pk}))
        self.assertEqual(join_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            EventRefereeAssignment.objects.filter(
                event=self.event,
                referee=self.ref_3,
            ).exists()
        )

    def test_referee_not_joined_cannot_leave(self):
        self.client.force_authenticate(user=self.ref_user_1)
        response = self.client.post(reverse("event-leave", kwargs={"pk": self.event.pk}))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "You are not assigned to this event.")

    def test_referee_can_create_event(self):
        self.client.force_authenticate(user=self.ref_user_2)
        payload = {
            "start_date": "2026-07-01",
            "end_date": "2026-07-03",
            "venue": self.event.venue_id,
            "description": "New open event",
            "fee_per_game": "30.00",
            "contact_information": "contact@example.com",
            "referees_required": 4,
        }

        response = self.client.post(reverse("event-create"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["created_by"], self.ref_user_2.id)

    def test_non_referee_cannot_create_event(self):
        non_ref_user = User.objects.create_user(
            email="noref@example.com",
            password="password123",
            first_name="No",
            last_name="Ref",
            bipin_number="3999",
        )
        non_ref_user.referee_profile.delete()

        self.client.force_authenticate(user=non_ref_user)
        payload = {
            "start_date": "2026-07-01",
            "end_date": "2026-07-03",
            "venue": self.event.venue_id,
            "description": "Should fail",
            "fee_per_game": "30.00",
            "contact_information": "contact@example.com",
            "referees_required": 4,
        }

        response = self.client.post(reverse("event-create"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["detail"], "Only referees can create events.")

    def test_creator_can_update_and_delete_event(self):
        self.client.force_authenticate(user=self.ref_user_1)

        update_response = self.client.patch(
            reverse("event-update", kwargs={"pk": self.event.pk}),
            {"description": "Updated description"},
            format="json",
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["description"], "Updated description")

        delete_response = self.client.delete(
            reverse("event-delete", kwargs={"pk": self.event.pk})
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Event.objects.filter(pk=self.event.pk).exists())

    def test_other_referee_cannot_update_or_delete_event(self):
        self.client.force_authenticate(user=self.ref_user_2)

        update_response = self.client.patch(
            reverse("event-update", kwargs={"pk": self.event.pk}),
            {"description": "Hacked description"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_403_FORBIDDEN)

        delete_response = self.client.delete(
            reverse("event-delete", kwargs={"pk": self.event.pk})
        )
        self.assertEqual(delete_response.status_code, status.HTTP_403_FORBIDDEN)
