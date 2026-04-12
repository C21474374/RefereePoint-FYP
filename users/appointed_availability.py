from __future__ import annotations

from datetime import date, datetime, time, timedelta

from django.db import transaction
from django.utils import timezone

from .models import RefereeAvailability, RefereeProfile

DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
DAY_LABELS = {
    "MON": "Monday",
    "TUE": "Tuesday",
    "WED": "Wednesday",
    "THU": "Thursday",
    "FRI": "Friday",
    "SAT": "Saturday",
    "SUN": "Sunday",
}
WEEKDAY_CODES = {"MON", "TUE", "WED", "THU", "FRI"}

WEEKDAY_WINDOW = (time(19, 0), time(22, 0))
WEEKEND_WINDOW = (time(10, 0), time(22, 0))
DAY_CODE_BY_WEEKDAY_INDEX = {
    0: "MON",
    1: "TUE",
    2: "WED",
    3: "THU",
    4: "FRI",
    5: "SAT",
    6: "SUN",
}


def _window_for_day(day_of_week: str) -> tuple[time, time]:
    if day_of_week in WEEKDAY_CODES:
        return WEEKDAY_WINDOW
    return WEEKEND_WINDOW


def day_code_for_date(value: date) -> str:
    return DAY_CODE_BY_WEEKDAY_INDEX[value.weekday()]


def day_label_for_date(value: date) -> str:
    return DAY_LABELS[day_code_for_date(value)]


def game_start_window_for_date(value: date) -> tuple[time, time]:
    return _window_for_day(day_code_for_date(value))


def is_game_time_within_allowed_window(game_date: date, game_time: time) -> bool:
    window_start, window_end = game_start_window_for_date(game_date)
    return window_start <= game_time <= window_end


def _time_to_hhmm(value: time) -> str:
    return value.strftime("%H:%M")


def _parse_time_value(value) -> time | None:
    if value in (None, ""):
        return None

    if isinstance(value, time):
        return value.replace(second=0, microsecond=0)

    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        for fmt in ("%H:%M", "%H:%M:%S"):
            try:
                parsed = datetime.strptime(raw, fmt).time()
                return parsed.replace(second=0, microsecond=0)
            except ValueError:
                continue

    return None


def _first_day_next_month(from_date: date | None = None) -> date:
    base = from_date or timezone.localdate()
    first_this_month = base.replace(day=1)
    after_32 = first_this_month + timedelta(days=32)
    return after_32.replace(day=1)


def next_month_start_iso(from_date: date | None = None) -> str:
    return _first_day_next_month(from_date).isoformat()


def validate_appointed_availability_payload(payload) -> list[dict]:
    if payload is None:
        payload = []

    if not isinstance(payload, list):
        raise ValueError("Availability payload must be a list.")

    incoming_by_day: dict[str, dict] = {}
    for raw_entry in payload:
        if not isinstance(raw_entry, dict):
            raise ValueError("Each availability entry must be an object.")

        day_of_week = str(raw_entry.get("day_of_week", "")).strip().upper()
        if day_of_week not in DAY_ORDER:
            raise ValueError(f"Invalid day_of_week '{day_of_week}'.")
        if day_of_week in incoming_by_day:
            raise ValueError(f"Duplicate availability entry for {DAY_LABELS[day_of_week]}.")
        incoming_by_day[day_of_week] = raw_entry

    normalized: list[dict] = []
    for day_of_week in DAY_ORDER:
        raw = incoming_by_day.get(day_of_week, {})
        available = bool(raw.get("available", False))

        if not available:
            normalized.append(
                {
                    "day_of_week": day_of_week,
                    "available": False,
                    "start_time": "",
                    "end_time": "",
                }
            )
            continue

        start_time = _parse_time_value(raw.get("start_time"))
        end_time = _parse_time_value(raw.get("end_time"))
        if not start_time or not end_time:
            raise ValueError(
                f"{DAY_LABELS[day_of_week]} availability requires start_time and end_time."
            )
        if start_time >= end_time:
            raise ValueError(
                f"{DAY_LABELS[day_of_week]} start_time must be before end_time."
            )

        window_start, window_end = _window_for_day(day_of_week)
        if start_time < window_start or end_time > window_end:
            raise ValueError(
                (
                    f"{DAY_LABELS[day_of_week]} availability must be within "
                    f"{_time_to_hhmm(window_start)}-{_time_to_hhmm(window_end)}."
                )
            )

        normalized.append(
            {
                "day_of_week": day_of_week,
                "available": True,
                "start_time": _time_to_hhmm(start_time),
                "end_time": _time_to_hhmm(end_time),
            }
        )

    return normalized


def _to_response_entry(day_of_week: str, available: bool, start_time: str, end_time: str) -> dict:
    window_start, window_end = _window_for_day(day_of_week)
    return {
        "day_of_week": day_of_week,
        "day_label": DAY_LABELS[day_of_week],
        "available": available,
        "start_time": start_time,
        "end_time": end_time,
        "window_start": _time_to_hhmm(window_start),
        "window_end": _time_to_hhmm(window_end),
    }


def _normalized_to_lookup(normalized_payload: list[dict]) -> dict[str, tuple[time, time] | None]:
    lookup: dict[str, tuple[time, time] | None] = {day: None for day in DAY_ORDER}
    for item in normalized_payload:
        day_of_week = item.get("day_of_week")
        if day_of_week not in lookup:
            continue

        available = bool(item.get("available"))
        if not available:
            lookup[day_of_week] = None
            continue

        start_time = _parse_time_value(item.get("start_time"))
        end_time = _parse_time_value(item.get("end_time"))
        if not start_time or not end_time:
            lookup[day_of_week] = None
            continue
        lookup[day_of_week] = (start_time, end_time)
    return lookup


def current_appointed_availability(profile: RefereeProfile) -> list[dict]:
    rows = RefereeAvailability.objects.filter(referee=profile)
    by_day = {row.day_of_week: row for row in rows}

    output: list[dict] = []
    for day_of_week in DAY_ORDER:
        row = by_day.get(day_of_week)
        if row:
            output.append(
                _to_response_entry(
                    day_of_week=day_of_week,
                    available=True,
                    start_time=_time_to_hhmm(row.start_time),
                    end_time=_time_to_hhmm(row.end_time),
                )
            )
        else:
            output.append(
                _to_response_entry(
                    day_of_week=day_of_week,
                    available=False,
                    start_time="",
                    end_time="",
                )
            )
    return output


def _current_appointed_availability_lookup(profile: RefereeProfile) -> dict[str, tuple[time, time] | None]:
    rows = RefereeAvailability.objects.filter(referee=profile)
    by_day = {day: None for day in DAY_ORDER}
    for row in rows:
        if row.day_of_week in by_day:
            by_day[row.day_of_week] = (row.start_time, row.end_time)
    return by_day


def effective_appointed_availability_lookup(
    profile: RefereeProfile,
    target_date: date,
) -> dict[str, tuple[time, time] | None]:
    pending_raw = profile.appointed_availability_pending or []
    pending_effective_from = profile.appointed_availability_effective_from

    if pending_effective_from and target_date >= pending_effective_from and pending_raw:
        try:
            normalized = validate_appointed_availability_payload(pending_raw)
            return _normalized_to_lookup(normalized)
        except ValueError:
            # Fall back to current schedule if pending payload is invalid.
            return _current_appointed_availability_lookup(profile)

    return _current_appointed_availability_lookup(profile)


def is_referee_available_for_game(
    profile: RefereeProfile,
    game_date: date,
    game_time: time,
) -> bool:
    day_code = day_code_for_date(game_date)
    lookup = effective_appointed_availability_lookup(profile, game_date)
    slot = lookup.get(day_code)
    if not slot:
        return False

    start_time, end_time = slot
    return start_time <= game_time <= end_time


def pending_appointed_availability(profile: RefereeProfile) -> list[dict] | None:
    raw = profile.appointed_availability_pending or []
    if not raw:
        return None

    try:
        normalized = validate_appointed_availability_payload(raw)
    except ValueError:
        return None

    return [
        _to_response_entry(
            day_of_week=item["day_of_week"],
            available=bool(item["available"]),
            start_time=item.get("start_time") or "",
            end_time=item.get("end_time") or "",
        )
        for item in normalized
    ]


@transaction.atomic
def set_current_appointed_availability(
    profile: RefereeProfile,
    normalized_payload: list[dict],
) -> None:
    by_day = {item["day_of_week"]: item for item in normalized_payload}

    for day_of_week in DAY_ORDER:
        item = by_day.get(day_of_week)
        if not item or not item.get("available"):
            RefereeAvailability.objects.filter(referee=profile, day_of_week=day_of_week).delete()
            continue

        start_time = _parse_time_value(item.get("start_time"))
        end_time = _parse_time_value(item.get("end_time"))
        if not start_time or not end_time:
            RefereeAvailability.objects.filter(referee=profile, day_of_week=day_of_week).delete()
            continue

        RefereeAvailability.objects.update_or_create(
            referee=profile,
            day_of_week=day_of_week,
            defaults={
                "start_time": start_time,
                "end_time": end_time,
            },
        )


def queue_next_month_appointed_availability(
    profile: RefereeProfile,
    normalized_payload: list[dict],
    from_date: date | None = None,
) -> date:
    effective_from = _first_day_next_month(from_date)
    profile.appointed_availability_pending = normalized_payload
    profile.appointed_availability_effective_from = effective_from
    profile.save(
        update_fields=[
            "appointed_availability_pending",
            "appointed_availability_effective_from",
        ]
    )
    return effective_from


@transaction.atomic
def apply_pending_appointed_availability_if_due(
    profile: RefereeProfile,
    on_date: date | None = None,
) -> bool:
    effective_from = profile.appointed_availability_effective_from
    if not effective_from:
        return False

    today = on_date or timezone.localdate()
    if effective_from > today:
        return False

    normalized = validate_appointed_availability_payload(
        profile.appointed_availability_pending or []
    )
    set_current_appointed_availability(profile, normalized)

    profile.appointed_availability_pending = []
    profile.appointed_availability_effective_from = None
    profile.save(
        update_fields=[
            "appointed_availability_pending",
            "appointed_availability_effective_from",
        ]
    )
    return True
