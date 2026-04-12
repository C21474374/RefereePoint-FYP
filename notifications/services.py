from __future__ import annotations

from typing import Iterable

from django.db.models import Q
from django.utils import timezone

from events.models import Event, EventRefereeAssignment
from games.models import Game, NonAppointedSlot, RefereeAssignment
from users.models import User

from .models import UserNotification


MANAGER_NOTIFICATION_ROLES = {
    User.AccountType.CLUB,
    User.AccountType.SCHOOL,
    User.AccountType.COLLEGE,
}


def _display_user_name(user: User | None) -> str:
    if not user:
        return "Someone"
    full_name = user.get_full_name().strip()
    return full_name or user.email


def _display_team_name(team) -> str:
    if not team:
        return "TBD"
    club = getattr(team, "club", None)
    if club and getattr(club, "name", None):
        return club.name
    return str(team)


def _display_game_label(game: Game) -> str:
    home_name = _display_team_name(game.home_team)
    away_name = _display_team_name(game.away_team)
    return f"{home_name} vs {away_name}"


def _display_game_time(game: Game) -> str:
    if not game.time:
        return "Time TBC"
    return game.time.strftime("%H:%M")


def create_user_notification(
    *,
    recipient: User | None,
    notification_type: str,
    title: str,
    message: str,
    link_path: str = "",
    actor: User | None = None,
    metadata: dict | None = None,
    dedupe_key: str | None = None,
):
    if not recipient or not recipient.is_active:
        return None
    if actor and recipient.id == actor.id:
        return None

    payload = {
        "actor": actor,
        "notification_type": notification_type,
        "title": title[:180],
        "message": message,
        "link_path": link_path,
        "metadata": metadata or {},
        "is_read": False,
    }

    if dedupe_key:
        notification, _ = UserNotification.objects.get_or_create(
            recipient=recipient,
            dedupe_key=dedupe_key[:180],
            defaults=payload,
        )
        return notification

    return UserNotification.objects.create(
        recipient=recipient,
        dedupe_key=None,
        **payload,
    )


def create_notifications_for_users(
    *,
    recipients: Iterable[User],
    notification_type: str,
    title: str,
    message: str,
    link_path: str = "",
    actor: User | None = None,
    metadata: dict | None = None,
    dedupe_key_prefix: str | None = None,
):
    created = []
    for recipient in recipients:
        dedupe_key = (
            f"{dedupe_key_prefix}:{recipient.id}" if dedupe_key_prefix else None
        )
        notification = create_user_notification(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            link_path=link_path,
            actor=actor,
            metadata=metadata,
            dedupe_key=dedupe_key,
        )
        if notification:
            created.append(notification)
    return created


def _admin_notification_recipients():
    return User.objects.filter(is_active=True).filter(
        Q(is_staff=True)
        | Q(
            account_type__in=[User.AccountType.DOA, User.AccountType.NL],
            doa_approved=True,
        )
    )


def notify_account_pending_for_admins(new_account: User, actor: User | None = None):
    title = "Account approval pending"
    display_name = _display_user_name(new_account)
    message = f"{display_name} registered as {new_account.get_account_type_display()} and is waiting for approval."
    return create_notifications_for_users(
        recipients=_admin_notification_recipients(),
        notification_type=UserNotification.NotificationType.ACCOUNT_APPROVAL,
        title=title,
        message=message,
        link_path="/account-approvals",
        actor=actor,
        metadata={
            "pending_user_id": new_account.id,
            "account_type": new_account.account_type,
        },
        dedupe_key_prefix=f"pending-account:{new_account.id}",
    )


def notify_cover_request_created_for_admins(cover_request, actor_user: User | None = None):
    game_label = _display_game_label(cover_request.game)
    title = "New cover request"
    message = (
        f"{_display_user_name(cover_request.requested_by)} requested cover for "
        f"{game_label} ({cover_request.game.date} { _display_game_time(cover_request.game)})."
    )
    return create_notifications_for_users(
        recipients=_admin_notification_recipients(),
        notification_type=UserNotification.NotificationType.COVER_REQUEST_ADMIN,
        title=title,
        message=message,
        link_path="/cover-requests",
        actor=actor_user,
        metadata={
            "cover_request_id": cover_request.id,
            "game_id": cover_request.game_id,
        },
        dedupe_key_prefix=f"admin-cover-request:{cover_request.id}",
    )


def notify_report_created_for_admins(report, actor_user: User | None = None):
    title = "New referee report submitted"
    game_label = _display_game_label(report.game)
    message = (
        f"{_display_user_name(report.submitted_by)} submitted a report for "
        f"{game_label} ({report.game.date})."
    )
    return create_notifications_for_users(
        recipients=_admin_notification_recipients(),
        notification_type=UserNotification.NotificationType.REPORT_ADMIN,
        title=title,
        message=message,
        link_path="/reports",
        actor=actor_user,
        metadata={
            "report_id": report.id,
            "game_id": report.game_id,
        },
        dedupe_key_prefix=f"admin-report:{report.id}",
    )


def notify_cover_request_claimed(cover_request, actor_user: User | None = None):
    recipient = cover_request.requested_by
    replacement_name = _display_user_name(
        cover_request.replaced_by.user if cover_request.replaced_by else None
    )
    game_label = _display_game_label(cover_request.game)
    message = (
        f"{replacement_name} offered to cover your request for "
        f"{game_label} ({cover_request.game.date} { _display_game_time(cover_request.game)})."
    )
    return create_user_notification(
        recipient=recipient,
        notification_type=UserNotification.NotificationType.COVER_REQUEST_STATUS,
        title="Cover request claimed",
        message=message,
        link_path="/cover-requests",
        actor=actor_user,
        metadata={
            "cover_request_id": cover_request.id,
            "status": cover_request.status,
        },
    )


def notify_cover_request_withdrawn(cover_request, actor_user: User | None = None):
    recipient = cover_request.requested_by
    game_label = _display_game_label(cover_request.game)
    message = (
        f"A referee withdrew from covering {game_label}. "
        "Your request is pending again."
    )
    return create_user_notification(
        recipient=recipient,
        notification_type=UserNotification.NotificationType.COVER_REQUEST_STATUS,
        title="Cover request back to pending",
        message=message,
        link_path="/cover-requests",
        actor=actor_user,
        metadata={
            "cover_request_id": cover_request.id,
            "status": cover_request.status,
        },
    )


def notify_cover_request_approved(cover_request, actor_user: User | None = None):
    game_label = _display_game_label(cover_request.game)
    created = []

    for recipient in [
        cover_request.requested_by,
        cover_request.replaced_by.user if cover_request.replaced_by else None,
    ]:
        notification = create_user_notification(
            recipient=recipient,
            notification_type=UserNotification.NotificationType.COVER_REQUEST_STATUS,
            title="Cover request approved",
            message=(
                f"The cover request for {game_label} was approved by admin."
            ),
            link_path="/cover-requests",
            actor=actor_user,
            metadata={
                "cover_request_id": cover_request.id,
                "status": cover_request.status,
            },
        )
        if notification:
            created.append(notification)
    return created


def notify_non_appointed_slot_claimed(slot: NonAppointedSlot, actor_user: User | None = None):
    recipient = slot.posted_by
    if not recipient or recipient.account_type not in MANAGER_NOTIFICATION_ROLES:
        return None

    claimed_user = slot.claimed_by.user if slot.claimed_by else None
    claimed_name = _display_user_name(claimed_user)
    claimed_phone = claimed_user.phone_number if claimed_user else ""
    phone_suffix = f" ({claimed_phone})" if claimed_phone else ""

    game_label = _display_game_label(slot.game)
    message = (
        f"{claimed_name}{phone_suffix} took {slot.get_role_display()} for "
        f"{game_label} ({slot.game.date} { _display_game_time(slot.game)})."
    )

    return create_user_notification(
        recipient=recipient,
        notification_type=UserNotification.NotificationType.GAME_ASSIGNMENT_ACTIVITY,
        title="Referee took your game slot",
        message=message,
        link_path="/games",
        actor=actor_user,
        metadata={
            "slot_id": slot.id,
            "game_id": slot.game_id,
            "role": slot.role,
            "status": slot.status,
        },
    )


def notify_event_joined(event: Event, referee_user: User | None = None):
    recipient = event.created_by
    if not recipient or recipient.account_type not in MANAGER_NOTIFICATION_ROLES:
        return None

    venue_name = event.venue.name if event.venue else "Venue TBC"
    message = (
        f"{_display_user_name(referee_user)} joined your event at {venue_name} "
        f"({event.start_date} to {event.end_date})."
    )
    return create_user_notification(
        recipient=recipient,
        notification_type=UserNotification.NotificationType.EVENT_ASSIGNMENT_ACTIVITY,
        title="Referee joined your event",
        message=message,
        link_path="/events",
        actor=referee_user,
        metadata={
            "event_id": event.id,
        },
    )


def notify_event_left(event: Event, referee_user: User | None = None):
    recipient = event.created_by
    if not recipient or recipient.account_type not in MANAGER_NOTIFICATION_ROLES:
        return None

    venue_name = event.venue.name if event.venue else "Venue TBC"
    message = (
        f"{_display_user_name(referee_user)} left your event at {venue_name} "
        f"({event.start_date} to {event.end_date})."
    )
    return create_user_notification(
        recipient=recipient,
        notification_type=UserNotification.NotificationType.EVENT_ASSIGNMENT_ACTIVITY,
        title="Referee left your event",
        message=message,
        link_path="/events",
        actor=referee_user,
        metadata={
            "event_id": event.id,
        },
    )


def ensure_referee_daily_reminders_for_user(user: User):
    referee_profile = getattr(user, "referee_profile", None)
    if not referee_profile:
        return

    today = timezone.localdate()
    today_key = today.isoformat()

    appointed_assignments = RefereeAssignment.objects.select_related(
        "game",
        "game__venue",
        "game__home_team__club",
        "game__away_team__club",
    ).filter(
        referee=referee_profile,
        game__date=today,
    )

    for assignment in appointed_assignments:
        game = assignment.game
        venue_name = game.venue.name if game.venue else "Venue TBC"
        create_user_notification(
            recipient=user,
            notification_type=UserNotification.NotificationType.GAME_REMINDER,
            title="Game reminder for today",
            message=(
                f"{_display_game_label(game)} at { _display_game_time(game)} "
                f"({assignment.get_role_display()}) - {venue_name}."
            ),
            link_path="/dashboard",
            metadata={
                "game_id": game.id,
                "role": assignment.role,
                "date": today_key,
            },
            dedupe_key=f"reminder-appointed:{today_key}:{assignment.id}",
        )

    claimed_slots = NonAppointedSlot.objects.select_related(
        "game",
        "game__venue",
        "game__home_team__club",
        "game__away_team__club",
    ).filter(
        claimed_by=referee_profile,
        is_active=True,
        status=NonAppointedSlot.Status.CLAIMED,
        game__date=today,
    )

    for slot in claimed_slots:
        game = slot.game
        venue_name = game.venue.name if game.venue else "Venue TBC"
        create_user_notification(
            recipient=user,
            notification_type=UserNotification.NotificationType.GAME_REMINDER,
            title="Game reminder for today",
            message=(
                f"{_display_game_label(game)} at { _display_game_time(game)} "
                f"({slot.get_role_display()}) - {venue_name}."
            ),
            link_path="/dashboard",
            metadata={
                "game_id": game.id,
                "slot_id": slot.id,
                "role": slot.role,
                "date": today_key,
            },
            dedupe_key=f"reminder-slot:{today_key}:{slot.id}",
        )

    event_assignments = EventRefereeAssignment.objects.select_related(
        "event",
        "event__venue",
    ).filter(
        referee=referee_profile,
        event__start_date__lte=today,
        event__end_date__gte=today,
    )

    for assignment in event_assignments:
        event = assignment.event
        venue_name = event.venue.name if event.venue else "Venue TBC"
        create_user_notification(
            recipient=user,
            notification_type=UserNotification.NotificationType.EVENT_REMINDER,
            title="Event reminder for today",
            message=(
                f"You are assigned to an event at {venue_name} "
                f"({event.start_date} to {event.end_date})."
            ),
            link_path="/dashboard",
            metadata={
                "event_id": event.id,
                "date": today_key,
            },
            dedupe_key=f"reminder-event:{today_key}:{event.id}",
        )
