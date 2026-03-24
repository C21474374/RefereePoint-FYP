from datetime import date, time

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from clubs.models import Club, Division, Team
from games.models import Game, RefereeAssignment
from users.models import RefereeProfile, User
from venues.models import Venue

from .models import CoverRequest


class CancelCoverRequestAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.requesting_user = User.objects.create_user(
            email="requester@example.com",
            password="password123",
            first_name="Request",
            last_name="Owner",
            bipin_number="1001",
        )
        self.requesting_referee = self.requesting_user.referee_profile
        self.requesting_referee.grade = "GRADE_2"
        self.requesting_referee.save(update_fields=["grade"])

        self.other_user = User.objects.create_user(
            email="other@example.com",
            password="password123",
            first_name="Other",
            last_name="Ref",
            bipin_number="1002",
        )
        self.other_referee = self.other_user.referee_profile
        self.other_referee.grade = "GRADE_2"
        self.other_referee.save(update_fields=["grade"])

        club = Club.objects.create(name="Dublin Tigers")
        division = Division.objects.create(name="Senior", gender="M")
        home_team = Team.objects.create(club=club, division=division)
        away_team = Team.objects.create(
            club=Club.objects.create(name="Cork Celtics"),
            division=division,
        )
        venue = Venue.objects.create(name="National Arena", club=club)

        self.game = Game.objects.create(
            game_type=Game.GameType.DOA,
            payment_type=Game.PaymentType.CLAIM,
            division=division,
            date=date(2026, 4, 10),
            time=time(19, 30),
            venue=venue,
            home_team=home_team,
            away_team=away_team,
            created_by=self.requesting_user,
        )

        self.assignment = RefereeAssignment.objects.create(
            game=self.game,
            referee=self.requesting_referee,
            role=RefereeAssignment.Role.UMPIRE_1,
        )

    def create_cover_request(self, **overrides):
        payload = {
            "game": self.game,
            "requested_by": self.requesting_user,
            "referee_slot": self.assignment,
            "original_referee": self.requesting_referee,
            "status": CoverRequest.Status.PENDING,
            "reason": "Can't make it",
        }
        payload.update(overrides)
        return CoverRequest.objects.create(**payload)

    def test_creator_can_cancel_pending_cover_request(self):
        cover_request = self.create_cover_request()
        self.client.force_authenticate(user=self.requesting_user)

        response = self.client.delete(
            reverse("cover-request-cancel", kwargs={"pk": cover_request.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CoverRequest.objects.filter(pk=cover_request.pk).exists())

    def test_other_user_cannot_cancel_someone_elses_cover_request(self):
        cover_request = self.create_cover_request()
        self.client.force_authenticate(user=self.other_user)

        response = self.client.delete(
            reverse("cover-request-cancel", kwargs={"pk": cover_request.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(CoverRequest.objects.filter(pk=cover_request.pk).exists())

    def test_creator_cannot_cancel_non_pending_cover_request(self):
        cover_request = self.create_cover_request(
            status=CoverRequest.Status.CLAIMED,
            replaced_by=self.other_referee,
        )
        self.client.force_authenticate(user=self.requesting_user)

        response = self.client.delete(
            reverse("cover-request-cancel", kwargs={"pk": cover_request.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(CoverRequest.objects.filter(pk=cover_request.pk).exists())

    def test_claiming_referee_can_cancel_claimed_request_back_to_pending(self):
        cover_request = self.create_cover_request(
            status=CoverRequest.Status.CLAIMED,
            replaced_by=self.other_referee,
        )
        self.client.force_authenticate(user=self.other_user)

        response = self.client.post(
            reverse("cover-request-withdraw", kwargs={"pk": cover_request.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cover_request.refresh_from_db()
        self.assertEqual(cover_request.status, CoverRequest.Status.PENDING)
        self.assertIsNone(cover_request.replaced_by)

    def test_non_claiming_referee_cannot_cancel_claimed_request(self):
        cover_request = self.create_cover_request(
            status=CoverRequest.Status.CLAIMED,
            replaced_by=self.other_referee,
        )
        self.client.force_authenticate(user=self.requesting_user)

        response = self.client.post(
            reverse("cover-request-withdraw", kwargs={"pk": cover_request.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        cover_request.refresh_from_db()
        self.assertEqual(cover_request.status, CoverRequest.Status.CLAIMED)
        self.assertEqual(cover_request.replaced_by, self.other_referee)

    def test_claiming_referee_cannot_cancel_after_admin_approval(self):
        admin_user = User.objects.create_user(
            email="admin@example.com",
            password="password123",
            first_name="Admin",
            last_name="User",
            bipin_number="1003",
            is_staff=True,
        )

        cover_request = self.create_cover_request(
            status=CoverRequest.Status.APPROVED,
            replaced_by=self.other_referee,
            approver=admin_user,
        )
        self.client.force_authenticate(user=self.other_user)

        response = self.client.post(
            reverse("cover-request-withdraw", kwargs={"pk": cover_request.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        cover_request.refresh_from_db()
        self.assertEqual(cover_request.status, CoverRequest.Status.APPROVED)
        self.assertEqual(cover_request.replaced_by, self.other_referee)
