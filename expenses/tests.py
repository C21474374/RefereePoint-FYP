from datetime import date, time
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from clubs.models import Club, Division, Team
from games.models import Game, RefereeAssignment
from users.models import User
from venues.models import Venue

from .models import ExpenseRecord, MonthlyEarningsSnapshot


class ExpensesAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.user = User.objects.create_user(
            email="expense-test@example.com",
            password="password123",
            first_name="Expense",
            last_name="Tester",
            bipin_number="9001",
            home_address="Dublin 1",
            home_lat=53.3498,
            home_lon=-6.2603,
        )
        self.referee = self.user.referee_profile
        self.referee.grade = "GRADE_2"
        self.referee.save(update_fields=["grade"])

        club_home = Club.objects.create(name="Home Club")
        club_away = Club.objects.create(name="Away Club")
        division = Division.objects.create(name="Senior", gender="M")
        home_team = Team.objects.create(club=club_home, division=division)
        away_team = Team.objects.create(club=club_away, division=division)
        venue = Venue.objects.create(name="Main Arena", lat=53.35, lon=-6.2, club=club_home)

        game = Game.objects.create(
            game_type=Game.GameType.DOA,
            payment_type=Game.PaymentType.CLAIM,
            division=division,
            date=date(2024, 3, 20),
            time=time(18, 30),
            venue=venue,
            home_team=home_team,
            away_team=away_team,
            created_by=self.user,
        )

        self.assignment = RefereeAssignment.objects.create(
            game=game,
            referee=self.referee,
            role=RefereeAssignment.Role.UMPIRE_1,
        )

        nl_game = Game.objects.create(
            game_type=Game.GameType.NL,
            payment_type=Game.PaymentType.CLAIM,
            division=division,
            date=date(2024, 3, 22),
            time=time(20, 0),
            venue=venue,
            home_team=home_team,
            away_team=away_team,
            created_by=self.user,
        )

        self.nl_assignment = RefereeAssignment.objects.create(
            game=nl_game,
            referee=self.referee,
            role=RefereeAssignment.Role.CREW_CHIEF,
        )

    def test_earnings_api_persists_expense_record(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            reverse("referee-earnings"),
            {"period": "month", "game_type": "DOA", "year": 2024, "month": 3},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(ExpenseRecord.objects.count(), 1)

        record = ExpenseRecord.objects.get(assignment=self.assignment)
        self.assertEqual(record.base_fee, Decimal("25.00"))
        self.assertEqual(record.total_amount, Decimal(response.data["items"][0]["total"]))

    def test_earnings_api_separates_doa_and_nl(self):
        self.client.force_authenticate(user=self.user)

        doa_response = self.client.get(
            reverse("referee-earnings"),
            {"period": "month", "game_type": "DOA", "year": 2024, "month": 3},
        )
        nl_response = self.client.get(
            reverse("referee-earnings"),
            {"period": "month", "game_type": "NL", "year": 2024, "month": 3},
        )

        self.assertEqual(doa_response.status_code, status.HTTP_200_OK)
        self.assertEqual(nl_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(doa_response.data["items"]), 1)
        self.assertEqual(len(nl_response.data["items"]), 1)

        self.assertEqual(doa_response.data["items"][0]["assignment_id"], self.assignment.id)
        self.assertEqual(nl_response.data["items"][0]["assignment_id"], self.nl_assignment.id)

    def test_elapsed_month_creates_snapshot(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            reverse("referee-earnings"),
            {"period": "month", "game_type": "DOA", "year": 2024, "month": 3},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        snapshot = MonthlyEarningsSnapshot.objects.get(
            referee=self.referee,
            game_type=Game.GameType.DOA,
            year=2024,
            month=3,
        )
        self.assertEqual(snapshot.games_count, 1)
        self.assertEqual(
            snapshot.total_claim_amount,
            Decimal(response.data["totals"]["total_claim_amount"]),
        )
        self.assertTrue(response.data["selected_month"]["is_finalized"])
