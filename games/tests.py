from datetime import date, time
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from clubs.models import Club, Division, Team
from cover_requests.models import CoverRequest
from events.models import Event, EventRefereeAssignment
from users.models import RefereeAvailability, User
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

    def test_opportunity_feed_includes_open_event_items(self):
        Event.objects.create(
            start_date=date(2026, 5, 20),
            end_date=date(2026, 5, 22),
            venue=self.venue,
            description="Weekend tournament",
            fee_per_game="40.00",
            contact_information="events@test.local",
            referees_required=3,
        )

        response = self.client.get(reverse("opportunity-feed"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        event_items = [item for item in response.data if item["type"] == "EVENT"]
        self.assertEqual(len(event_items), 1)
        self.assertEqual(event_items[0]["game_type"], "EVENT")
        self.assertEqual(event_items[0]["status"], "OPEN")

    def test_opportunity_feed_event_type_filter_only_returns_events(self):
        Event.objects.create(
            start_date=date(2026, 5, 25),
            end_date=date(2026, 5, 27),
            venue=self.venue,
            description="Final four",
            fee_per_game="45.00",
            contact_information="events@test.local",
            referees_required=2,
        )

        response = self.client.get(reverse("opportunity-feed"), {"type": "EVENT"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data), 0)
        self.assertTrue(all(item["type"] == "EVENT" for item in response.data))

    def test_opportunity_feed_excludes_events_joined_by_authenticated_referee(self):
        event = Event.objects.create(
            start_date=date(2026, 5, 30),
            end_date=date(2026, 5, 31),
            venue=self.venue,
            description="Already joined event",
            fee_per_game="50.00",
            contact_information="events@test.local",
            referees_required=4,
        )
        EventRefereeAssignment.objects.create(
            event=event,
            referee=self.requesting_referee,
        )

        self.client.force_authenticate(user=self.requesting_user)
        response = self.client.get(reverse("opportunity-feed"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        event_ids = [item["id"] for item in response.data if item["type"] == "EVENT"]
        self.assertNotIn(event.id, event_ids)


class RefereeEarningsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.user = User.objects.create_user(
            email="earnings@example.com",
            password="password123",
            first_name="Earning",
            last_name="Ref",
            bipin_number="5001",
            home_address="Dublin 1",
            home_lat=53.3498,
            home_lon=-6.2603,
        )
        self.referee = self.user.referee_profile
        self.referee.grade = "GRADE_2"
        self.referee.save(update_fields=["grade"])

        club_home = Club.objects.create(name="Leinster Lions")
        club_away = Club.objects.create(name="Munster Meteors")
        division = Division.objects.create(name="Senior", gender="M")
        home_team = Team.objects.create(club=club_home, division=division)
        away_team = Team.objects.create(club=club_away, division=division)

        self.venue = Venue.objects.create(
            name="City Arena",
            lat=53.35,
            lon=-6.2,
            club=club_home,
        )

        game_1 = Game.objects.create(
            game_type=Game.GameType.DOA,
            payment_type=Game.PaymentType.CLAIM,
            division=division,
            date=date(2026, 3, 12),
            time=time(11, 0),
            venue=self.venue,
            home_team=home_team,
            away_team=away_team,
            created_by=self.user,
        )

        game_2 = Game.objects.create(
            game_type=Game.GameType.DOA,
            payment_type=Game.PaymentType.CLAIM,
            division=division,
            date=date(2026, 3, 12),
            time=time(14, 0),
            venue=self.venue,
            home_team=home_team,
            away_team=away_team,
            created_by=self.user,
        )

        self.assignment_1 = RefereeAssignment.objects.create(
            game=game_1,
            referee=self.referee,
            role=RefereeAssignment.Role.UMPIRE_1,
        )

        self.assignment_2 = RefereeAssignment.objects.create(
            game=game_2,
            referee=self.referee,
            role=RefereeAssignment.Role.UMPIRE_2,
        )

    def test_earnings_api_calculates_back_to_back_same_venue_mileage_once(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse("referee-earnings"), {"period": "all"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["totals"]["games_count"], 2)

        items = response.data["items"]
        self.assertEqual(len(items), 2)

        first_item = items[0]
        second_item = items[1]

        self.assertEqual(first_item["is_back_to_back_same_venue"], False)
        self.assertEqual(second_item["is_back_to_back_same_venue"], True)
        self.assertGreater(Decimal(first_item["mileage_km"]), Decimal("0.00"))
        self.assertEqual(Decimal(second_item["mileage_km"]), Decimal("0.00"))

        self.assertEqual(Decimal(first_item["base_fee"]), Decimal("25.00"))
        self.assertEqual(Decimal(second_item["base_fee"]), Decimal("25.00"))


class AppointedUploadAvailabilityValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.uploader = User.objects.create_user(
            email="doa.admin@test.com",
            password="password123",
            first_name="Doa",
            last_name="Admin",
            bipin_number="7001",
            account_type=User.AccountType.DOA,
            doa_approved=True,
            bipin_verified=True,
        )

        self.referee_user = User.objects.create_user(
            email="assigned.ref@test.com",
            password="password123",
            first_name="Assigned",
            last_name="Referee",
            bipin_number="7002",
        )
        self.referee_profile = self.referee_user.referee_profile
        self.referee_profile.grade = "GRADE_2"
        self.referee_profile.save(update_fields=["grade"])

        self.club_home = Club.objects.create(name="Northside Hawks")
        self.club_away = Club.objects.create(name="Southside Stars")
        self.division = Division.objects.create(
            name="U18",
            gender="M",
            requires_appointed_referees=True,
        )
        self.home_team = Team.objects.create(club=self.club_home, division=self.division)
        self.away_team = Team.objects.create(club=self.club_away, division=self.division)
        self.venue = Venue.objects.create(name="Main Arena", club=self.club_home)

        # Monday availability window for the assigned referee.
        RefereeAvailability.objects.create(
            referee=self.referee_profile,
            day_of_week="MON",
            start_time=time(19, 0),
            end_time=time(20, 0),
        )

        self.client.force_authenticate(user=self.uploader)

    def _payload(self, *, game_time: str):
        return {
            "game_type": Game.GameType.DOA,
            "payment_type": Game.PaymentType.CLAIM,
            "division": self.division.id,
            "date": "2026-04-06",  # Monday
            "time": game_time,
            "venue": self.venue.id,
            "home_team": self.home_team.id,
            "away_team": self.away_team.id,
            "appointed_assignments": [
                {
                    "role": RefereeAssignment.Role.CREW_CHIEF,
                    "referee": self.referee_profile.id,
                }
            ],
        }

    def test_appointed_upload_rejects_out_of_window_start_time(self):
        response = self.client.post(
            reverse("non-appointed-game-upload"),
            self._payload(game_time="18:00"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("time", response.data)

    def test_appointed_upload_rejects_unavailable_referee_assignment(self):
        response = self.client.post(
            reverse("non-appointed-game-upload"),
            self._payload(game_time="21:00"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("appointed_assignments", response.data)


class SharedAppointedUploadsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.doa_user_one = User.objects.create_user(
            email="doa.one@test.com",
            password="password123",
            first_name="Doa",
            last_name="One",
            bipin_number="9101",
            account_type=User.AccountType.DOA,
            doa_approved=True,
            bipin_verified=True,
        )
        self.doa_user_two = User.objects.create_user(
            email="doa.two@test.com",
            password="password123",
            first_name="Doa",
            last_name="Two",
            bipin_number="9102",
            account_type=User.AccountType.DOA,
            doa_approved=True,
            bipin_verified=True,
        )

        club_home = Club.objects.create(name="Shared Home Club")
        club_away = Club.objects.create(name="Shared Away Club")
        self.division = Division.objects.create(
            name="U17",
            gender="M",
            requires_appointed_referees=True,
        )
        self.home_team = Team.objects.create(club=club_home, division=self.division)
        self.away_team = Team.objects.create(club=club_away, division=self.division)
        self.venue = Venue.objects.create(name="Shared Arena", club=club_home)

        self.shared_game = Game.objects.create(
            game_type=Game.GameType.DOA,
            payment_type=Game.PaymentType.CLAIM,
            division=self.division,
            date=date(2026, 4, 11),
            time=time(12, 0),
            venue=self.venue,
            home_team=self.home_team,
            away_team=self.away_team,
            created_by=self.doa_user_one,
        )

    def test_doa_accounts_see_shared_appointed_uploads(self):
        self.client.force_authenticate(user=self.doa_user_two)
        response = self.client.get(reverse("my-uploaded-games"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        uploaded_ids = [item["id"] for item in response.data]
        self.assertIn(self.shared_game.id, uploaded_ids)

    def test_doa_account_can_edit_and_delete_shared_appointed_upload(self):
        self.client.force_authenticate(user=self.doa_user_two)
        update_payload = {
            "game_type": Game.GameType.DOA,
            "payment_type": Game.PaymentType.CLAIM,
            "division": self.division.id,
            "date": "2026-04-11",
            "time": "13:00",
            "venue": self.venue.id,
            "home_team": self.home_team.id,
            "away_team": self.away_team.id,
        }

        update_response = self.client.patch(
            reverse("my-uploaded-game-update", kwargs={"pk": self.shared_game.id}),
            update_payload,
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)

        self.shared_game.refresh_from_db()
        self.assertEqual(self.shared_game.time, time(13, 0))

        delete_response = self.client.delete(
            reverse("my-uploaded-game-delete", kwargs={"pk": self.shared_game.id})
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Game.objects.filter(pk=self.shared_game.id).exists())
