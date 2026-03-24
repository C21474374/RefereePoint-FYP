from datetime import date, time

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from clubs.models import Club, Division, Team
from cover_requests.models import CoverRequest
from users.models import User
from venues.models import Venue

from .models import Game, NonAppointedSlot, RefereeAssignment


class OpportunityFeedTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.requesting_user = User.objects.create_user(
            email="requesting@example.com",
            password="password123",
            first_name="Requesting",
            last_name="Referee",
            bipin_number="2001",
        )
        self.requesting_referee = self.requesting_user.referee_profile
        self.requesting_referee.grade = "GRADE_2"
        self.requesting_referee.save(update_fields=["grade"])

        self.club_home = Club.objects.create(name="Dublin Tigers")
        self.club_away = Club.objects.create(name="Galway Giants")
        self.division = Division.objects.create(name="Senior", gender="M")
        self.home_team = Team.objects.create(club=self.club_home, division=self.division)
        self.away_team = Team.objects.create(club=self.club_away, division=self.division)
        self.venue = Venue.objects.create(name="Tallaght Arena", club=self.club_home)

    def test_opportunity_feed_includes_cover_request_without_custom_fee(self):
        appointed_game = Game.objects.create(
            game_type=Game.GameType.DOA,
            payment_type=Game.PaymentType.CLAIM,
            division=self.division,
            date=date(2026, 5, 15),
            time=time(20, 0),
            venue=self.venue,
            home_team=self.home_team,
            away_team=self.away_team,
            created_by=self.requesting_user,
        )

        assignment = RefereeAssignment.objects.create(
            game=appointed_game,
            referee=self.requesting_referee,
            role=RefereeAssignment.Role.UMPIRE_1,
        )

        cover_request = CoverRequest.objects.create(
            game=appointed_game,
            requested_by=self.requesting_user,
            referee_slot=assignment,
            original_referee=self.requesting_referee,
            status=CoverRequest.Status.PENDING,
            reason="Unavailable",
        )

        non_appointed_game = Game.objects.create(
            game_type=Game.GameType.CLUB,
            payment_type=Game.PaymentType.CASH,
            division=self.division,
            date=date(2026, 5, 16),
            time=time(18, 30),
            venue=self.venue,
            home_team=self.home_team,
            away_team=self.away_team,
            created_by=self.requesting_user,
        )

        NonAppointedSlot.objects.create(
            game=non_appointed_game,
            role=NonAppointedSlot.Role.UMPIRE_1,
            status=NonAppointedSlot.Status.OPEN,
            posted_by=self.requesting_user,
            description="Away-side open slot",
            is_active=True,
        )

        response = self.client.get(reverse("opportunity-feed"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        cover_items = [
            item
            for item in response.data
            if item["type"] == "COVER_REQUEST" and item["id"] == cover_request.id
        ]

        self.assertEqual(len(cover_items), 1)
        self.assertNotIn("custom_fee", cover_items[0])
