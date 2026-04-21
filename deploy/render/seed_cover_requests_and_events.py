"""Seed cover-request and event opportunities in a target database.

Usage:
  python manage.py shell -c "exec(open('deploy/render/seed_cover_requests_and_events.py').read())"
"""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from cover_requests.models import CoverRequest
from events.models import Event
from games.models import Game, RefereeAssignment
from users.models import User
from venues.models import Venue


SEED_TAG = "[Render Seed]"


def ensure_manager_user(*, email: str, account_type: str, first_name: str, last_name: str) -> User:
    user = User.objects.filter(email=email).first()
    if user is None:
        user = User.objects.create_user(
            email=email,
            password="RefTest123!",
            first_name=first_name,
            last_name=last_name,
        )

    update_fields: set[str] = set()
    if user.account_type != account_type:
        user.account_type = account_type
        update_fields.add("account_type")
    if user.first_name != first_name:
        user.first_name = first_name
        update_fields.add("first_name")
    if user.last_name != last_name:
        user.last_name = last_name
        update_fields.add("last_name")
    if not user.is_active:
        user.is_active = True
        update_fields.add("is_active")
    if not user.doa_approved:
        user.doa_approved = True
        update_fields.add("doa_approved")

    if account_type in {User.AccountType.CLUB, User.AccountType.DOA, User.AccountType.NL}:
        if not user.bipin_verified:
            user.bipin_verified = True
            update_fields.add("bipin_verified")

    if account_type in {User.AccountType.SCHOOL, User.AccountType.COLLEGE}:
        if not user.verification_id_photo:
            user.verification_id_photo = "verification_ids/testing-bypass.png"
            update_fields.add("verification_id_photo")
        if not user.organization_name:
            user.organization_name = f"{first_name.title()} Seed Organisation"
            update_fields.add("organization_name")
        if not user.institution_head_phone:
            user.institution_head_phone = "0000000000"
            update_fields.add("institution_head_phone")

    if update_fields:
        user.save(update_fields=sorted(update_fields))

    return user


@transaction.atomic
def run() -> None:
    today = timezone.localdate()
    venues = list(Venue.objects.order_by("id")[:16])
    if not venues:
        raise RuntimeError("No venues found; cannot seed events/cover requests.")

    club_user = ensure_manager_user(
        email="club.events.seed@refereepoint.test",
        account_type=User.AccountType.CLUB,
        first_name="club_events_seed",
        last_name="manager",
    )
    school_user = ensure_manager_user(
        email="school.events.seed@refereepoint.test",
        account_type=User.AccountType.SCHOOL,
        first_name="school_events_seed",
        last_name="manager",
    )
    college_user = ensure_manager_user(
        email="college.events.seed@refereepoint.test",
        account_type=User.AccountType.COLLEGE,
        first_name="college_events_seed",
        last_name="manager",
    )

    event_created = 0
    event_updated = 0
    event_target_count = 12
    event_type_cycle = [
        (Event.EventType.CLUB, club_user),
        (Event.EventType.SCHOOL, school_user),
        (Event.EventType.COLLEGE, college_user),
    ]

    for index in range(event_target_count):
        event_type, created_by = event_type_cycle[index % len(event_type_cycle)]
        venue = venues[index % len(venues)]
        start_date = today + timedelta(days=2 + (index * 2))
        end_date = start_date + timedelta(days=1 if index % 4 == 0 else 0)
        referees_required = 2 + (index % 3)
        description = (
            f"{SEED_TAG} {event_type.title()} opportunity event #{index + 1} "
            f"({start_date.isoformat()})"
        )

        event, created = Event.objects.get_or_create(
            event_type=event_type,
            start_date=start_date,
            end_date=end_date,
            venue=venue,
            description=description,
            defaults={
                "fee_per_game": "25.00",
                "contact_information": "seed-events@refereepoint.test",
                "referees_required": referees_required,
                "created_by": created_by,
            },
        )
        if created:
            event_created += 1
            continue

        changed = False
        if event.referees_required != referees_required:
            event.referees_required = referees_required
            changed = True
        if event.created_by_id != created_by.id:
            event.created_by = created_by
            changed = True
        if not event.contact_information:
            event.contact_information = "seed-events@refereepoint.test"
            changed = True
        if changed:
            event.save(
                update_fields=[
                    "referees_required",
                    "created_by",
                    "contact_information",
                ]
            )
            event_updated += 1

    cover_created = 0
    cover_target_count = 10
    assignment_candidates = (
        RefereeAssignment.objects.select_related("game", "referee__user")
        .filter(
            game__date__gte=today,
            game__game_type__in=[Game.GameType.DOA, Game.GameType.NL],
            referee__user__account_type=User.AccountType.REFEREE,
        )
        .exclude(
            cover_requests__status__in=[
                CoverRequest.Status.PENDING,
                CoverRequest.Status.CLAIMED,
            ]
        )
        .order_by("game__date", "game__time", "id")
    )

    for assignment in assignment_candidates:
        if cover_created >= cover_target_count:
            break

        if assignment.game.date < today:
            continue

        requested_by = assignment.referee.user
        reason = f"{SEED_TAG} cover request for opportunity/testing."

        cover = CoverRequest(
            game=assignment.game,
            requested_by=requested_by,
            referee_slot=assignment,
            original_referee=assignment.referee,
            status=CoverRequest.Status.PENDING,
            reason=reason,
        )
        try:
            cover.save()
        except Exception:
            continue
        cover_created += 1

    pending_cover_count = CoverRequest.objects.filter(
        status=CoverRequest.Status.PENDING,
        game__date__gte=today,
    ).count()
    open_event_count = Event.objects.filter(end_date__gte=today).count()

    print("Seed complete:")
    print(f"  Events created/updated: {event_created}/{event_updated}")
    print(f"  Cover requests created: {cover_created}")
    print(f"  Pending future cover requests total: {pending_cover_count}")
    print(f"  Open/future events total: {open_event_count}")


run()
