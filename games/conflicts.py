"""Shared schedule-conflict helpers for referee claim/join flows."""

from __future__ import annotations

from datetime import date, time
from typing import Any

from .models import Game, NonAppointedSlot, RefereeAssignment


def _build_game_title(game: Game) -> str:
    """Return a compact game title for conflict dialogs."""
    home_name = (
        game.home_team.club.name
        if game.home_team and getattr(game.home_team, "club", None)
        else "Home Team"
    )
    away_name = (
        game.away_team.club.name
        if game.away_team and getattr(game.away_team, "club", None)
        else "Away Team"
    )
    return f"{home_name} vs {away_name}"


def _serialize_game_clash(
    game: Game,
    *,
    role_display: str | None = None,
    source: str = "GAME",
) -> dict[str, Any]:
    """Serialize a game commitment into a frontend-friendly clash payload."""
    return {
        "game_id": game.id,
        "title": _build_game_title(game),
        "date": game.date,
        "time": game.time,
        "venue_name": game.venue.name if game.venue else None,
        "division_name": game.division.name if game.division else None,
        "role_display": role_display,
        "source": source,
    }


def _append_unique_game_clash(
    clashes: list[dict[str, Any]],
    seen_game_ids: set[int],
    payload: dict[str, Any],
) -> None:
    """Keep one clash entry per game to avoid duplicate rows across sources."""
    game_id = payload.get("game_id")
    if not isinstance(game_id, int):
        return
    if game_id in seen_game_ids:
        return
    seen_game_ids.add(game_id)
    clashes.append(payload)


def _sorted_game_clashes(clashes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        clashes,
        key=lambda item: (
            item.get("date"),
            item.get("time"),
            str(item.get("title") or ""),
        ),
    )


def get_referee_game_datetime_clashes(
    referee_profile,
    game_date: date,
    game_time: time,
    *,
    exclude_game_id: int | None = None,
) -> list[dict[str, Any]]:
    """
    Return referee game commitments that match the same date+time.

    Used when a referee tries to claim/take another game. This is a hard clash.
    """
    from cover_requests.models import CoverRequest

    clashes: list[dict[str, Any]] = []
    seen_game_ids: set[int] = set()

    assignments = (
        RefereeAssignment.objects.select_related(
            "game",
            "game__venue",
            "game__division",
            "game__home_team__club",
            "game__away_team__club",
        )
        .filter(
            referee=referee_profile,
            game__date=game_date,
            game__time=game_time,
        )
        .exclude(game__status=Game.Status.CANCELLED)
    )
    if exclude_game_id:
        assignments = assignments.exclude(game_id=exclude_game_id)

    for assignment in assignments:
        _append_unique_game_clash(
            clashes,
            seen_game_ids,
            _serialize_game_clash(
                assignment.game,
                role_display=assignment.get_role_display(),
                source="ASSIGNMENT",
            ),
        )

    claimed_slots = (
        NonAppointedSlot.objects.select_related(
            "game",
            "game__venue",
            "game__division",
            "game__home_team__club",
            "game__away_team__club",
        )
        .filter(
            claimed_by=referee_profile,
            is_active=True,
            status=NonAppointedSlot.Status.CLAIMED,
            game__date=game_date,
            game__time=game_time,
        )
        .exclude(game__status=Game.Status.CANCELLED)
    )
    if exclude_game_id:
        claimed_slots = claimed_slots.exclude(game_id=exclude_game_id)

    for slot in claimed_slots:
        _append_unique_game_clash(
            clashes,
            seen_game_ids,
            _serialize_game_clash(
                slot.game,
                role_display=slot.get_role_display(),
                source="CLAIMED_SLOT",
            ),
        )

    claimed_covers = (
        CoverRequest.objects.select_related(
            "game",
            "game__venue",
            "game__division",
            "game__home_team__club",
            "game__away_team__club",
            "referee_slot",
        )
        .filter(
            replaced_by=referee_profile,
            status__in=[CoverRequest.Status.CLAIMED, CoverRequest.Status.APPROVED],
            game__date=game_date,
            game__time=game_time,
        )
        .exclude(game__status=Game.Status.CANCELLED)
    )
    if exclude_game_id:
        claimed_covers = claimed_covers.exclude(game_id=exclude_game_id)

    for cover_request in claimed_covers:
        role_display = (
            cover_request.referee_slot.get_role_display()
            if cover_request.referee_slot
            else None
        )
        _append_unique_game_clash(
            clashes,
            seen_game_ids,
            _serialize_game_clash(
                cover_request.game,
                role_display=role_display,
                source="COVER_CLAIM",
            ),
        )

    return _sorted_game_clashes(clashes)


def get_referee_event_day_clashes(
    referee_profile,
    target_date: date,
    *,
    exclude_event_id: int | None = None,
) -> list[dict[str, Any]]:
    """
    Return events this referee is assigned to on a given date.

    Event conflicts are soft warnings for game claims.
    """
    from events.models import EventRefereeAssignment

    assignments = (
        EventRefereeAssignment.objects.select_related("event", "event__venue")
        .filter(
            referee=referee_profile,
            event__start_date__lte=target_date,
            event__end_date__gte=target_date,
        )
        .order_by("event__start_date", "event__end_date")
    )
    if exclude_event_id:
        assignments = assignments.exclude(event_id=exclude_event_id)

    clashes: list[dict[str, Any]] = []
    seen_event_ids: set[int] = set()
    for assignment in assignments:
        event = assignment.event
        if event.id in seen_event_ids:
            continue
        seen_event_ids.add(event.id)
        clashes.append(
            {
                "event_id": event.id,
                "title": (event.description or "").strip()
                or f"{event.get_event_type_display()} Event",
                "start_date": event.start_date,
                "end_date": event.end_date,
                "venue_name": event.venue.name if event.venue else None,
                "event_type": event.event_type,
                "event_type_display": event.get_event_type_display(),
            }
        )

    return clashes


def get_referee_game_range_clashes(
    referee_profile,
    start_date: date,
    end_date: date,
    *,
    exclude_game_id: int | None = None,
) -> list[dict[str, Any]]:
    """
    Return referee games that fall within a date range.

    Used when joining all-day events to show potentially clashing games.
    """
    from cover_requests.models import CoverRequest

    clashes: list[dict[str, Any]] = []
    seen_game_ids: set[int] = set()

    assignments = (
        RefereeAssignment.objects.select_related(
            "game",
            "game__venue",
            "game__division",
            "game__home_team__club",
            "game__away_team__club",
        )
        .filter(
            referee=referee_profile,
            game__date__range=(start_date, end_date),
        )
        .exclude(game__status=Game.Status.CANCELLED)
    )
    if exclude_game_id:
        assignments = assignments.exclude(game_id=exclude_game_id)

    for assignment in assignments:
        _append_unique_game_clash(
            clashes,
            seen_game_ids,
            _serialize_game_clash(
                assignment.game,
                role_display=assignment.get_role_display(),
                source="ASSIGNMENT",
            ),
        )

    claimed_slots = (
        NonAppointedSlot.objects.select_related(
            "game",
            "game__venue",
            "game__division",
            "game__home_team__club",
            "game__away_team__club",
        )
        .filter(
            claimed_by=referee_profile,
            is_active=True,
            status=NonAppointedSlot.Status.CLAIMED,
            game__date__range=(start_date, end_date),
        )
        .exclude(game__status=Game.Status.CANCELLED)
    )
    if exclude_game_id:
        claimed_slots = claimed_slots.exclude(game_id=exclude_game_id)

    for slot in claimed_slots:
        _append_unique_game_clash(
            clashes,
            seen_game_ids,
            _serialize_game_clash(
                slot.game,
                role_display=slot.get_role_display(),
                source="CLAIMED_SLOT",
            ),
        )

    claimed_covers = (
        CoverRequest.objects.select_related(
            "game",
            "game__venue",
            "game__division",
            "game__home_team__club",
            "game__away_team__club",
            "referee_slot",
        )
        .filter(
            replaced_by=referee_profile,
            status__in=[CoverRequest.Status.CLAIMED, CoverRequest.Status.APPROVED],
            game__date__range=(start_date, end_date),
        )
        .exclude(game__status=Game.Status.CANCELLED)
    )
    if exclude_game_id:
        claimed_covers = claimed_covers.exclude(game_id=exclude_game_id)

    for cover_request in claimed_covers:
        role_display = (
            cover_request.referee_slot.get_role_display()
            if cover_request.referee_slot
            else None
        )
        _append_unique_game_clash(
            clashes,
            seen_game_ids,
            _serialize_game_clash(
                cover_request.game,
                role_display=role_display,
                source="COVER_CLAIM",
            ),
        )

    return _sorted_game_clashes(clashes)
