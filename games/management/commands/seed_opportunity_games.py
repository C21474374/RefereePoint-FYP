from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta, time

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from clubs.models import Division, Team
from games.models import Game, NonAppointedSlot
from users.models import User
from venues.models import Venue


@dataclass
class SeedStats:
    games_created: int = 0
    games_updated: int = 0
    slots_created: int = 0
    slots_reopened: int = 0


def _ensure_uploader(
    *,
    email: str,
    account_type: str,
    first_name: str,
    last_name: str,
    bipin_number: str,
) -> User:
    user = User.objects.filter(email=email).first()
    if user is None:
        user = User.objects.create_user(
            email=email,
            password="RefTest123!",
            first_name=first_name,
            last_name=last_name,
        )

    changed = False
    if user.account_type != account_type:
        user.account_type = account_type
        changed = True
    if user.first_name != first_name:
        user.first_name = first_name
        changed = True
    if user.last_name != last_name:
        user.last_name = last_name
        changed = True
    if user.bipin_number != bipin_number:
        user.bipin_number = bipin_number
        changed = True
    if not user.bipin_verified:
        user.bipin_verified = True
        changed = True
    if not user.doa_approved:
        user.doa_approved = True
        changed = True
    if not user.is_active:
        user.is_active = True
        changed = True

    if changed:
        user.save(
            update_fields=[
                "account_type",
                "first_name",
                "last_name",
                "bipin_number",
                "bipin_verified",
                "doa_approved",
                "is_active",
            ]
        )
    return user


class Command(BaseCommand):
    help = (
        "Seed CLUB/SCHOOL/COLLEGE opportunity games with OPEN non-appointed slots "
        "for referee opportunities feed."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--club-count",
            type=int,
            default=10,
            help="Number of CLUB games to seed (default: 10).",
        )
        parser.add_argument(
            "--school-count",
            type=int,
            default=8,
            help="Number of SCHOOL games to seed (default: 8).",
        )
        parser.add_argument(
            "--college-count",
            type=int,
            default=8,
            help="Number of COLLEGE games to seed (default: 8).",
        )
        parser.add_argument(
            "--start-days",
            type=int,
            default=1,
            help="How many days from today to start fixtures (default: 1).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        club_count = max(int(options["club_count"]), 0)
        school_count = max(int(options["school_count"]), 0)
        college_count = max(int(options["college_count"]), 0)
        start_days = max(int(options["start_days"]), 0)

        if club_count == 0 and school_count == 0 and college_count == 0:
            self.stdout.write("Nothing to seed. All requested counts are zero.")
            return

        venues = list(Venue.objects.order_by("id"))
        if not venues:
            raise CommandError("No venues found. Add venues first.")

        divisions = list(
            Division.objects.filter(is_active=True, requires_appointed_referees=False).order_by("id")
        )
        if not divisions:
            raise CommandError(
                "No active non-appointed divisions found. Add divisions with requires_appointed_referees=False."
            )

        division_teams: list[tuple[Division, list[Team]]] = []
        for division in divisions:
            teams = list(
                Team.objects.filter(division=division, is_active=True)
                .select_related("club")
                .order_by("club__name", "id")
            )
            if len(teams) >= 2:
                division_teams.append((division, teams))

        if not division_teams:
            raise CommandError(
                "No non-appointed division has at least two active teams. Seed teams first."
            )

        uploaders = {
            Game.GameType.CLUB: _ensure_uploader(
                email="club.seed@refereepoint.test",
                account_type=User.AccountType.CLUB,
                first_name="club_seed",
                last_name="manager",
                bipin_number="SEED-CLUB-001",
            ),
            Game.GameType.SCHOOL: _ensure_uploader(
                email="school.seed@refereepoint.test",
                account_type=User.AccountType.SCHOOL,
                first_name="school_seed",
                last_name="manager",
                bipin_number="SEED-SCHOOL-001",
            ),
            Game.GameType.COLLEGE: _ensure_uploader(
                email="college.seed@refereepoint.test",
                account_type=User.AccountType.COLLEGE,
                first_name="college_seed",
                last_name="manager",
                bipin_number="SEED-COLLEGE-001",
            ),
        }

        time_cycle = [
            time(18, 30),
            time(19, 0),
            time(19, 30),
            time(20, 0),
            time(20, 30),
            time(21, 0),
        ]
        today = timezone.localdate()
        stats = {
            Game.GameType.CLUB: SeedStats(),
            Game.GameType.SCHOOL: SeedStats(),
            Game.GameType.COLLEGE: SeedStats(),
        }

        def seed_type(game_type: str, count: int, offset_seed: int):
            uploader = uploaders[game_type]
            role_cycle = [
                [NonAppointedSlot.Role.CREW_CHIEF],
                [NonAppointedSlot.Role.UMPIRE_1],
                [NonAppointedSlot.Role.CREW_CHIEF, NonAppointedSlot.Role.UMPIRE_1],
            ]

            for index in range(count):
                fixture_date = today + timedelta(days=start_days + index + offset_seed)
                fixture_time = time_cycle[(index + offset_seed) % len(time_cycle)]
                division, teams = division_teams[(index + offset_seed) % len(division_teams)]

                home_team = teams[index % len(teams)]
                away_team = teams[(index + 1) % len(teams)]
                if home_team.id == away_team.id:
                    away_team = teams[(index + 2) % len(teams)]

                venue = venues[(index + offset_seed) % len(venues)]
                payment_type = (
                    Game.PaymentType.CASH if index % 2 == 0 else Game.PaymentType.REVOLUT
                )

                game, created = Game.objects.get_or_create(
                    game_type=game_type,
                    created_by=uploader,
                    date=fixture_date,
                    time=fixture_time,
                    venue=venue,
                    home_team=home_team,
                    away_team=away_team,
                    defaults={
                        "division": division,
                        "payment_type": payment_type,
                        "status": Game.Status.OPEN,
                    },
                )

                if created:
                    stats[game_type].games_created += 1
                else:
                    changed = False
                    if game.division_id != division.id:
                        game.division = division
                        changed = True
                    if game.payment_type != payment_type:
                        game.payment_type = payment_type
                        changed = True
                    if game.status != Game.Status.OPEN:
                        game.status = Game.Status.OPEN
                        changed = True
                    if changed:
                        game.save(update_fields=["division", "payment_type", "status"])
                        stats[game_type].games_updated += 1

                for role in role_cycle[index % len(role_cycle)]:
                    slot, slot_created = NonAppointedSlot.objects.get_or_create(
                        game=game,
                        role=role,
                        defaults={
                            "status": NonAppointedSlot.Status.OPEN,
                            "posted_by": uploader,
                            "is_active": True,
                        },
                    )
                    if slot_created:
                        stats[game_type].slots_created += 1
                        continue

                    slot_changed = False
                    if slot.posted_by_id is None:
                        slot.posted_by = uploader
                        slot_changed = True
                    if (
                        slot.status != NonAppointedSlot.Status.OPEN
                        and slot.claimed_by_id is None
                    ):
                        slot.status = NonAppointedSlot.Status.OPEN
                        slot_changed = True
                    if not slot.is_active:
                        slot.is_active = True
                        slot_changed = True
                    if slot_changed:
                        slot.save(update_fields=["posted_by", "status", "is_active", "updated_at"])
                        stats[game_type].slots_reopened += 1

        seed_type(Game.GameType.CLUB, club_count, 0)
        seed_type(Game.GameType.SCHOOL, school_count, 4)
        seed_type(Game.GameType.COLLEGE, college_count, 8)

        total_games = sum(item.games_created for item in stats.values())
        total_slots = sum(item.slots_created for item in stats.values())

        self.stdout.write(self.style.SUCCESS("Opportunity games seeded successfully."))
        for game_type in [Game.GameType.CLUB, Game.GameType.SCHOOL, Game.GameType.COLLEGE]:
            item = stats[game_type]
            self.stdout.write(
                f"{game_type}: games created/updated {item.games_created}/{item.games_updated}, "
                f"slots created/reopened {item.slots_created}/{item.slots_reopened}"
            )
        self.stdout.write(
            f"Totals: {total_games} new games, {total_slots} new open opportunity slots."
        )
