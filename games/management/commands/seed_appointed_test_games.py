from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta, time

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from clubs.models import Division, Team
from games.models import Game, RefereeAssignment
from users.models import RefereeProfile, User
from venues.models import Venue


@dataclass
class SeedResult:
    games_created: int = 0
    games_updated: int = 0
    assignments_created: int = 0
    assignments_updated: int = 0


def _allowed_start_times(game_date):
    # Monday-Friday: 19:00-22:00 start window
    # Saturday/Sunday: 10:00-22:00 start window
    if game_date.weekday() <= 4:
        return [
            time(19, 0),
            time(19, 30),
            time(20, 0),
            time(20, 30),
            time(21, 0),
        ]
    return [
        time(10, 0),
        time(12, 0),
        time(14, 0),
        time(16, 0),
        time(18, 0),
        time(20, 0),
    ]


def _pick_ref(pool, seed, excluded_ids=None):
    excluded_ids = excluded_ids or set()
    if not pool:
        raise CommandError("No referees available in the requested pool.")
    start = seed % len(pool)
    for offset in range(len(pool)):
        candidate = pool[(start + offset) % len(pool)]
        if candidate.id not in excluded_ids:
            return candidate
    raise CommandError("Unable to select a referee (all candidates excluded).")


class Command(BaseCommand):
    help = (
        "Seed appointed DOA/NL test games with assignments.\n"
        "Rules enforced:\n"
        "- INTRO cannot be Crew Chief\n"
        "- INTRO cannot be assigned to NL games"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--doa-count",
            type=int,
            default=12,
            help="Number of DOA games to seed (default: 12).",
        )
        parser.add_argument(
            "--nl-count",
            type=int,
            default=8,
            help="Number of NL games to seed (default: 8).",
        )

    def _get_or_create_uploader(self, email: str, account_type: str, first_name: str) -> User:
        uploader = User.objects.filter(email=email).first()
        if uploader is None:
            uploader = User.objects.create_user(
                email=email,
                password="RefTest123!",
                first_name=first_name,
                last_name="uploader",
            )
        changed = False
        if uploader.account_type != account_type:
            uploader.account_type = account_type
            changed = True
        if not uploader.doa_approved:
            uploader.doa_approved = True
            changed = True
        if not uploader.bipin_verified:
            uploader.bipin_verified = True
            changed = True
        if not uploader.is_active:
            uploader.is_active = True
            changed = True
        if changed:
            uploader.save(
                update_fields=[
                    "account_type",
                    "doa_approved",
                    "bipin_verified",
                    "is_active",
                ]
            )
        return uploader

    def _upsert_assignment(self, game: Game, role: str, referee: RefereeProfile, result: SeedResult):
        assignment, created = RefereeAssignment.objects.get_or_create(
            game=game,
            role=role,
            defaults={"referee": referee},
        )
        if created:
            result.assignments_created += 1
            return
        if assignment.referee_id != referee.id:
            assignment.referee = referee
            assignment.save(update_fields=["referee"])
            result.assignments_updated += 1

    @transaction.atomic
    def handle(self, *args, **options):
        doa_count = max(int(options["doa_count"]), 0)
        nl_count = max(int(options["nl_count"]), 0)

        if doa_count == 0 and nl_count == 0:
            self.stdout.write("Nothing to seed (both counts are zero).")
            return

        venues = list(Venue.objects.all().order_by("id"))
        if not venues:
            raise CommandError("No venues found. Add venues first.")

        appointed_divisions = list(
            Division.objects.filter(requires_appointed_referees=True, is_active=True).order_by("id")
        )
        if not appointed_divisions:
            raise CommandError(
                "No appointed divisions found. Set requires_appointed_referees=True on at least one division."
            )

        division_teams = []
        for division in appointed_divisions:
            teams = list(
                Team.objects.filter(division=division, is_active=True)
                .select_related("club")
                .order_by("club__name", "id")
            )
            if len(teams) >= 2:
                division_teams.append((division, teams))

        if not division_teams:
            raise CommandError("No appointed division has at least two active teams.")

        all_referees = list(
            RefereeProfile.objects.select_related("user")
            .filter(
                user__account_type=User.AccountType.REFEREE,
                user__is_active=True,
            )
            .order_by("user__email")
        )
        non_intro_referees = [profile for profile in all_referees if profile.grade != "INTRO"]

        if len(non_intro_referees) < 2:
            raise CommandError("Need at least two non-INTRO referees to seed appointed games.")
        if len(all_referees) < 2:
            raise CommandError("Need at least two referee profiles to seed appointed games.")

        doa_uploader = self._get_or_create_uploader(
            email="doa.seed@refereepoint.test",
            account_type=User.AccountType.DOA,
            first_name="doa_seed",
        )
        nl_uploader = self._get_or_create_uploader(
            email="nl.seed@refereepoint.test",
            account_type=User.AccountType.NL,
            first_name="nl_seed",
        )

        base_date = timezone.localdate() + timedelta(days=2)
        doa_result = SeedResult()
        nl_result = SeedResult()

        def seed_for_game_type(game_type: str, count: int, creator: User, allow_intro_umpire: bool, result: SeedResult):
            for index in range(count):
                fixture_date = base_date + timedelta(days=index * 2 + (0 if game_type == Game.GameType.DOA else 1))
                start_times = _allowed_start_times(fixture_date)
                fixture_time = start_times[index % len(start_times)]

                division, teams = division_teams[index % len(division_teams)]
                home_team = teams[index % len(teams)]
                away_team = teams[(index + 1) % len(teams)]
                if home_team.id == away_team.id:
                    away_team = teams[(index + 2) % len(teams)]
                venue = venues[(index + (2 if game_type == Game.GameType.NL else 0)) % len(venues)]

                defaults = {
                    "division": division,
                    "payment_type": Game.PaymentType.CLAIM,
                    "status": Game.Status.FULLY_ASSIGNED,
                    "created_by": creator,
                }
                game, created = Game.objects.get_or_create(
                    game_type=game_type,
                    date=fixture_date,
                    time=fixture_time,
                    venue=venue,
                    home_team=home_team,
                    away_team=away_team,
                    defaults=defaults,
                )

                if created:
                    result.games_created += 1
                else:
                    changed = False
                    if game.division_id != division.id:
                        game.division = division
                        changed = True
                    if game.payment_type != Game.PaymentType.CLAIM:
                        game.payment_type = Game.PaymentType.CLAIM
                        changed = True
                    if game.status != Game.Status.FULLY_ASSIGNED:
                        game.status = Game.Status.FULLY_ASSIGNED
                        changed = True
                    if game.created_by_id != creator.id:
                        game.created_by = creator
                        changed = True
                    if changed:
                        game.save(update_fields=["division", "payment_type", "status", "created_by"])
                        result.games_updated += 1

                crew_chief = _pick_ref(non_intro_referees, seed=index)
                umpire_pool = all_referees if allow_intro_umpire else non_intro_referees
                umpire_one = _pick_ref(
                    umpire_pool,
                    seed=index + 5,
                    excluded_ids={crew_chief.id},
                )

                self._upsert_assignment(
                    game=game,
                    role=RefereeAssignment.Role.CREW_CHIEF,
                    referee=crew_chief,
                    result=result,
                )
                self._upsert_assignment(
                    game=game,
                    role=RefereeAssignment.Role.UMPIRE_1,
                    referee=umpire_one,
                    result=result,
                )

                game.referee_assignments.filter(role=RefereeAssignment.Role.UMPIRE_2).delete()

        seed_for_game_type(
            game_type=Game.GameType.DOA,
            count=doa_count,
            creator=doa_uploader,
            allow_intro_umpire=True,
            result=doa_result,
        )
        seed_for_game_type(
            game_type=Game.GameType.NL,
            count=nl_count,
            creator=nl_uploader,
            allow_intro_umpire=False,
            result=nl_result,
        )

        intro_nl_assignments = RefereeAssignment.objects.filter(
            game__game_type=Game.GameType.NL,
            referee__grade="INTRO",
        ).count()
        intro_cc_assignments = RefereeAssignment.objects.filter(
            role=RefereeAssignment.Role.CREW_CHIEF,
            referee__grade="INTRO",
        ).count()
        if intro_nl_assignments or intro_cc_assignments:
            raise CommandError(
                "Rule violation detected after seeding: "
                f"intro_nl={intro_nl_assignments}, intro_crew_chief={intro_cc_assignments}"
            )

        self.stdout.write(self.style.SUCCESS("DOA/NL appointed test games seeded successfully."))
        self.stdout.write(
            "DOA games created/updated: "
            f"{doa_result.games_created}/{doa_result.games_updated} | "
            "assignments created/updated: "
            f"{doa_result.assignments_created}/{doa_result.assignments_updated}"
        )
        self.stdout.write(
            "NL games created/updated: "
            f"{nl_result.games_created}/{nl_result.games_updated} | "
            "assignments created/updated: "
            f"{nl_result.assignments_created}/{nl_result.assignments_updated}"
        )
        self.stdout.write(
            "Rule check passed: INTRO as Crew Chief = 0, INTRO on NL = 0."
        )
