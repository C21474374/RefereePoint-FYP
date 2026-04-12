from datetime import time, timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from clubs.models import Club, Division, Team
from games.models import Game, NonAppointedSlot
from users.models import RefereeAvailability, User
from venues.models import Venue

from .models import RecommendationSnapshot


class RecommendedOpportunityFeedTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.ref_user = User.objects.create_user(
            email="reco-ref@test.com",
            password="password123",
            first_name="Reco",
            last_name="Ref",
            bipin_number="9101",
            home_lat=53.3498,
            home_lon=-6.2603,
        )
        self.ref_profile = self.ref_user.referee_profile
        self.ref_profile.grade = "GRADE_2"
        self.ref_profile.save(update_fields=["grade"])

        # Available Monday 19:00-22:00 (matches test game time).
        RefereeAvailability.objects.create(
            referee=self.ref_profile,
            day_of_week="MON",
            start_time=time(19, 0),
            end_time=time(22, 0),
        )

        self.poster = User.objects.create_user(
            email="poster@test.com",
            password="password123",
            first_name="Poster",
            last_name="User",
            bipin_number="9102",
            account_type=User.AccountType.CLUB,
            doa_approved=True,
            bipin_verified=True,
        )

        club_home = Club.objects.create(name="Reco Home Club")
        club_away = Club.objects.create(name="Reco Away Club")
        division = Division.objects.create(name="U16", gender="M")
        home_team = Team.objects.create(club=club_home, division=division)
        away_team = Team.objects.create(club=club_away, division=division)

        today = timezone.localdate()
        days_until_monday = (0 - today.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7
        game_date = today + timedelta(days=days_until_monday)

        near_venue = Venue.objects.create(
            name="Near Venue",
            lat=53.3500,
            lon=-6.2610,
            club=club_home,
        )
        far_venue = Venue.objects.create(
            name="Far Venue",
            lat=52.2600,
            lon=-7.1100,
            club=club_home,
        )

        near_game = Game.objects.create(
            game_type=Game.GameType.CLUB,
            payment_type=Game.PaymentType.CASH,
            division=division,
            date=game_date,
            time=time(20, 0),
            venue=near_venue,
            home_team=home_team,
            away_team=away_team,
            created_by=self.poster,
        )
        far_game = Game.objects.create(
            game_type=Game.GameType.CLUB,
            payment_type=Game.PaymentType.CASH,
            division=division,
            date=game_date,
            time=time(20, 0),
            venue=far_venue,
            home_team=home_team,
            away_team=away_team,
            created_by=self.poster,
        )

        self.near_slot = NonAppointedSlot.objects.create(
            game=near_game,
            role=NonAppointedSlot.Role.UMPIRE_1,
            posted_by=self.poster,
            status=NonAppointedSlot.Status.OPEN,
            is_active=True,
        )
        self.far_slot = NonAppointedSlot.objects.create(
            game=far_game,
            role=NonAppointedSlot.Role.UMPIRE_1,
            posted_by=self.poster,
            status=NonAppointedSlot.Status.OPEN,
            is_active=True,
        )

    def test_recommendation_feed_ranks_opportunities_and_saves_snapshots(self):
        self.client.force_authenticate(user=self.ref_user)
        response = self.client.get(reverse("recommended-opportunity-feed"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data
        items = payload["items"]

        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["id"], self.near_slot.id)
        self.assertGreaterEqual(items[0]["recommendation_score"], items[1]["recommendation_score"])
        self.assertIsInstance(items[0]["recommendation_reasons"], list)
        self.assertTrue(items[0]["is_recommended"])

        snapshots = RecommendationSnapshot.objects.filter(user=self.ref_user)
        self.assertEqual(snapshots.count(), 2)

    def test_recommendation_feed_does_not_hide_all_items_without_availability_config(self):
        RefereeAvailability.objects.filter(referee=self.ref_profile).delete()
        self.client.force_authenticate(user=self.ref_user)

        response = self.client.get(reverse("recommended-opportunity-feed"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data["items"]), 1)
