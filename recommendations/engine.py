from __future__ import annotations

import math
from collections import Counter
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Mapping

from django.db import transaction
from django.db.models import Count, F, Q
from django.utils import timezone

from cover_requests.models import CoverRequest
from events.models import Event, EventRefereeAssignment
from games.models import NonAppointedSlot, RefereeAssignment
from recommendations.models import RecommendationSnapshot
from users.appointed_availability import (
    day_code_for_date,
)
from users.models import RefereeProfile, User


EARTH_RADIUS_KM = 6371.0

WEIGHTS = {
    "distance": 0.35,
    "time_fit": 0.20,
    "type_preference": 0.20,
    "venue_division": 0.15,
    "urgency": 0.10,
}

TYPE_LABEL = {
    "NON_APPOINTED_SLOT": "games",
    "COVER_REQUEST": "cover requests",
    "EVENT": "events",
}


def _to_decimal_score(value: float) -> Decimal:
    return Decimal(str(round(value, 2))).quantize(Decimal("0.01"))


def _parse_date_param(value: str | None) -> date | None:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_KM * c


def _to_hour_decimal(value: time) -> float:
    return value.hour + (value.minute / 60.0)


def _clamp_score(value: float) -> float:
    if value < 0:
        return 0.0
    if value > 100:
        return 100.0
    return float(round(value, 2))


def _build_user_history(profile: RefereeProfile) -> dict[str, Any]:
    day_counts: Counter[str] = Counter()
    hour_values: list[float] = []
    type_counts: Counter[str] = Counter()
    venue_counts: Counter[int] = Counter()
    division_counts: Counter[str] = Counter()

    claimed_slots = (
        NonAppointedSlot.objects.select_related("game")
        .filter(claimed_by=profile)
        .exclude(game__date__isnull=True)
    )

    for slot in claimed_slots:
        game = slot.game
        if not game:
            continue
        type_counts["NON_APPOINTED_SLOT"] += 1
        day_counts[day_code_for_date(game.date)] += 1
        hour_values.append(_to_hour_decimal(game.time))
        if game.venue_id:
            venue_counts[game.venue_id] += 1
        if game.division:
            division_counts[str(game.division)] += 1

    appointed_assignments = (
        RefereeAssignment.objects.select_related("game")
        .filter(referee=profile)
        .exclude(game__date__isnull=True)
    )
    for assignment in appointed_assignments:
        game = assignment.game
        if not game:
            continue
        day_counts[day_code_for_date(game.date)] += 1
        hour_values.append(_to_hour_decimal(game.time))
        if game.venue_id:
            venue_counts[game.venue_id] += 1
        if game.division:
            division_counts[str(game.division)] += 1

    cover_claims = (
        CoverRequest.objects.select_related("game")
        .filter(
            replaced_by=profile,
            status__in=[CoverRequest.Status.CLAIMED, CoverRequest.Status.APPROVED],
        )
    )
    for cover in cover_claims:
        game = cover.game
        if not game:
            continue
        type_counts["COVER_REQUEST"] += 1
        day_counts[day_code_for_date(game.date)] += 1
        hour_values.append(_to_hour_decimal(game.time))
        if game.venue_id:
            venue_counts[game.venue_id] += 1
        if game.division:
            division_counts[str(game.division)] += 1

    event_assignments = (
        EventRefereeAssignment.objects.select_related("event")
        .filter(referee=profile)
    )
    for assignment in event_assignments:
        event = assignment.event
        if not event:
            continue
        type_counts["EVENT"] += 1
        day_counts[day_code_for_date(event.start_date)] += 1
        if event.venue_id:
            venue_counts[event.venue_id] += 1

    average_hour = (sum(hour_values) / len(hour_values)) if hour_values else None

    return {
        "day_counts": day_counts,
        "average_hour": average_hour,
        "type_counts": type_counts,
        "venue_counts": venue_counts,
        "division_counts": division_counts,
    }


def _build_candidates(
    user: User,
    profile: RefereeProfile,
    query_params: Mapping[str, Any],
) -> list[dict[str, Any]]:
    today = timezone.localdate()
    now_time = timezone.localtime().time().replace(second=0, microsecond=0)

    non_appointed_slots = (
        NonAppointedSlot.objects.select_related(
            "game",
            "game__venue",
            "game__division",
            "game__home_team__club",
            "game__away_team__club",
            "posted_by",
            "claimed_by__user",
        )
        .filter(
            is_active=True,
            status=NonAppointedSlot.Status.OPEN,
        )
        .filter(
            Q(game__date__gt=today)
            | Q(game__date=today, game__time__gte=now_time)
        )
        .exclude(claimed_by=profile)
        .exclude(game__referee_assignments__referee=profile)
        .order_by("game__date", "game__time", "created_at")
        .distinct()
    )

    cover_requests = (
        CoverRequest.objects.select_related(
            "game",
            "game__venue",
            "game__division",
            "game__home_team__club",
            "game__away_team__club",
            "requested_by",
            "replaced_by__user",
            "referee_slot",
            "referee_slot__referee__user",
        )
        .filter(status=CoverRequest.Status.PENDING)
        .filter(
            Q(game__date__gt=today)
            | Q(game__date=today, game__time__gte=now_time)
        )
        .exclude(requested_by=user)
        .exclude(referee_slot__referee=profile)
        .exclude(replaced_by=profile)
        .order_by("game__date", "game__time", "created_at")
    )

    events = (
        Event.objects.select_related("venue")
        .filter(end_date__gte=today)
        .exclude(referee_assignments__referee=profile)
        .annotate(joined_referees_count=Count("referee_assignments"))
        .filter(Q(referees_required=0) | Q(joined_referees_count__lt=F("referees_required")))
        .order_by("start_date")
    )

    date_filter_raw = query_params.get("date")
    date_filter = _parse_date_param(date_filter_raw)
    venue_id = query_params.get("venue")
    role = query_params.get("role")
    game_type = query_params.get("game_type")
    opportunity_type = query_params.get("type")

    if date_filter:
        non_appointed_slots = non_appointed_slots.filter(game__date=date_filter)
        cover_requests = cover_requests.filter(game__date=date_filter)
        events = events.filter(start_date__lte=date_filter, end_date__gte=date_filter)

    if venue_id:
        non_appointed_slots = non_appointed_slots.filter(game__venue_id=venue_id)
        cover_requests = cover_requests.filter(game__venue_id=venue_id)
        events = events.filter(venue_id=venue_id)

    if role:
        non_appointed_slots = non_appointed_slots.filter(role=role)
        cover_requests = cover_requests.filter(referee_slot__role=role)

    if game_type:
        if game_type == "EVENT":
            non_appointed_slots = non_appointed_slots.none()
            cover_requests = cover_requests.none()
        else:
            non_appointed_slots = non_appointed_slots.filter(game__game_type=game_type)
            cover_requests = cover_requests.filter(game__game_type=game_type)
            events = events.none()

    items: list[dict[str, Any]] = []

    if opportunity_type in (None, "", "NON_APPOINTED_SLOT"):
        for slot in non_appointed_slots:
            game = slot.game
            venue = game.venue
            division = game.division

            items.append(
                {
                    "type": "NON_APPOINTED_SLOT",
                    "id": slot.id,
                    "game_id": game.id,
                    "game_type": game.game_type,
                    "game_type_display": game.get_game_type_display(),
                    "date": game.date,
                    "time": game.time,
                    "venue_id": venue.id if venue else None,
                    "venue_name": venue.name if venue else None,
                    "lat": venue.lat if venue else None,
                    "lng": venue.lon if venue else None,
                    "home_team_name": str(game.home_team) if game.home_team else None,
                    "away_team_name": str(game.away_team) if game.away_team else None,
                    "division_name": division.name if division else None,
                    "division_gender": getattr(division, "gender", None) if division else None,
                    "payment_type": game.payment_type,
                    "payment_type_display": (
                        game.get_payment_type_display() if game.payment_type else None
                    ),
                    "role": slot.role,
                    "role_display": slot.get_role_display(),
                    "status": slot.status,
                    "status_display": slot.get_status_display(),
                    "posted_by_name": slot.posted_by.get_full_name() if slot.posted_by else None,
                    "claimed_by_name": None,
                    "requested_by_name": None,
                    "original_referee_name": None,
                    "replaced_by_name": None,
                    "description": slot.description,
                    "reason": "",
                    "event_end_date": None,
                    "fee_per_game": None,
                    "referees_required": None,
                    "joined_referees_count": None,
                    "slots_left": None,
                    "created_at": slot.created_at,
                    "_division_key": str(division) if division else None,
                }
            )

    if opportunity_type in (None, "", "COVER_REQUEST"):
        for cover in cover_requests:
            game = cover.game
            venue = game.venue
            division = game.division
            original_referee = cover.referee_slot.referee if cover.referee_slot else None

            items.append(
                {
                    "type": "COVER_REQUEST",
                    "id": cover.id,
                    "game_id": game.id,
                    "game_type": game.game_type,
                    "game_type_display": game.get_game_type_display(),
                    "date": game.date,
                    "time": game.time,
                    "venue_id": venue.id if venue else None,
                    "venue_name": venue.name if venue else None,
                    "lat": venue.lat if venue else None,
                    "lng": venue.lon if venue else None,
                    "home_team_name": str(game.home_team) if game.home_team else None,
                    "away_team_name": str(game.away_team) if game.away_team else None,
                    "division_name": division.name if division else None,
                    "division_gender": getattr(division, "gender", None) if division else None,
                    "payment_type": game.payment_type,
                    "payment_type_display": (
                        game.get_payment_type_display() if game.payment_type else None
                    ),
                    "role": cover.referee_slot.role if cover.referee_slot else None,
                    "role_display": (
                        cover.referee_slot.get_role_display() if cover.referee_slot else None
                    ),
                    "status": cover.status,
                    "status_display": cover.get_status_display(),
                    "posted_by_name": None,
                    "claimed_by_name": None,
                    "requested_by_name": cover.requested_by.get_full_name() if cover.requested_by else None,
                    "original_referee_name": (
                        original_referee.user.get_full_name()
                        if original_referee and original_referee.user
                        else None
                    ),
                    "replaced_by_name": (
                        cover.replaced_by.user.get_full_name()
                        if cover.replaced_by and cover.replaced_by.user
                        else None
                    ),
                    "description": "",
                    "reason": cover.reason,
                    "event_end_date": None,
                    "fee_per_game": None,
                    "referees_required": None,
                    "joined_referees_count": None,
                    "slots_left": None,
                    "created_at": cover.created_at,
                    "_division_key": str(division) if division else None,
                }
            )

    if opportunity_type in (None, "", "EVENT"):
        for event in events:
            venue = event.venue
            slots_left = None
            status_value = "OPEN"
            status_display = "Open"

            if event.referees_required > 0:
                slots_left = max(event.referees_required - event.joined_referees_count, 0)
                if slots_left <= 0:
                    status_value = "FULL"
                    status_display = "Full"

            items.append(
                {
                    "type": "EVENT",
                    "id": event.id,
                    "game_id": event.id,
                    "game_type": "EVENT",
                    "game_type_display": "Event",
                    "date": event.start_date,
                    "time": time(0, 0),
                    "venue_id": venue.id if venue else None,
                    "venue_name": venue.name if venue else None,
                    "lat": venue.lat if venue else None,
                    "lng": venue.lon if venue else None,
                    "home_team_name": None,
                    "away_team_name": None,
                    "division_name": None,
                    "division_gender": None,
                    "payment_type": None,
                    "payment_type_display": None,
                    "role": None,
                    "role_display": None,
                    "status": status_value,
                    "status_display": status_display,
                    "posted_by_name": None,
                    "claimed_by_name": None,
                    "requested_by_name": None,
                    "original_referee_name": None,
                    "replaced_by_name": None,
                    "description": event.description,
                    "reason": "",
                    "event_end_date": event.end_date,
                    "fee_per_game": event.fee_per_game,
                    "referees_required": event.referees_required,
                    "joined_referees_count": event.joined_referees_count,
                    "slots_left": slots_left,
                    "created_at": timezone.make_aware(
                        datetime.combine(event.start_date, time.min)
                    ),
                    "_division_key": None,
                }
            )

    return items


def _compute_item_score(
    item: dict[str, Any],
    user: User,
    history: dict[str, Any],
    now_local: datetime,
) -> tuple[float, list[str]]:
    reasons: list[str] = []

    distance_km = None
    distance_score = 50.0
    if (
        user.home_lat is not None
        and user.home_lon is not None
        and item.get("lat") is not None
        and item.get("lng") is not None
    ):
        distance_km = _haversine_km(
            float(user.home_lat),
            float(user.home_lon),
            float(item["lat"]),
            float(item["lng"]),
        )
        distance_score = _clamp_score(100.0 - min(distance_km, 100.0))

    day_counts: Counter[str] = history["day_counts"]
    average_hour: float | None = history["average_hour"]
    day_score = 0.5
    hour_score = 0.5

    item_date: date = item["date"]
    day_code = day_code_for_date(item_date)
    if day_counts:
        max_day_count = max(day_counts.values())
        if max_day_count > 0:
            day_score = day_counts.get(day_code, 0) / max_day_count

    if item["type"] != "EVENT":
        item_time: time = item["time"]
        if average_hour is not None:
            diff = abs(_to_hour_decimal(item_time) - average_hour)
            hour_score = max(0.0, 1.0 - (diff / 6.0))
    time_fit_score = _clamp_score(100.0 * ((0.6 * day_score) + (0.4 * hour_score)))

    type_counts: Counter[str] = history["type_counts"]
    type_preference_score = 50.0
    if type_counts:
        max_type_count = max(type_counts.values())
        type_count = type_counts.get(item["type"], 0)
        if type_count > 0 and max_type_count > 0:
            type_preference_score = _clamp_score(100.0 * (type_count / max_type_count))
        else:
            type_preference_score = 30.0

    venue_counts: Counter[int] = history["venue_counts"]
    division_counts: Counter[str] = history["division_counts"]

    venue_score = 50.0
    if venue_counts and item.get("venue_id"):
        max_venue_count = max(venue_counts.values())
        venue_count = venue_counts.get(item["venue_id"], 0)
        if venue_count > 0 and max_venue_count > 0:
            venue_score = _clamp_score(100.0 * (venue_count / max_venue_count))
        else:
            venue_score = 35.0

    division_key = item.get("_division_key")
    division_score = 50.0
    if division_counts and division_key:
        max_division_count = max(division_counts.values())
        division_count = division_counts.get(division_key, 0)
        if division_count > 0 and max_division_count > 0:
            division_score = _clamp_score(100.0 * (division_count / max_division_count))
        else:
            division_score = 35.0

    venue_division_score = _clamp_score((0.6 * venue_score) + (0.4 * division_score))

    urgency_score = 50.0
    if item["type"] == "COVER_REQUEST":
        item_time: time = item["time"]
        item_dt = timezone.make_aware(datetime.combine(item["date"], item_time))
        hours_until = (item_dt - now_local).total_seconds() / 3600
        if hours_until <= 6:
            urgency_score = 100.0
        elif hours_until <= 24:
            urgency_score = 90.0
        elif hours_until <= 48:
            urgency_score = 75.0
        elif hours_until <= 72:
            urgency_score = 60.0
        elif hours_until <= 120:
            urgency_score = 40.0
        else:
            urgency_score = 20.0

    final_score = _clamp_score(
        (WEIGHTS["distance"] * distance_score)
        + (WEIGHTS["time_fit"] * time_fit_score)
        + (WEIGHTS["type_preference"] * type_preference_score)
        + (WEIGHTS["venue_division"] * venue_division_score)
        + (WEIGHTS["urgency"] * urgency_score)
    )

    if distance_score >= 75:
        if distance_km is not None:
            reasons.append(f"Near home ({distance_km:.1f} km)")
        else:
            reasons.append("Near home")

    if time_fit_score >= 70:
        reasons.append("Matches your usual time/day")

    if type_preference_score >= 70:
        reasons.append(f"You often take {TYPE_LABEL.get(item['type'], 'similar opportunities')}")

    if venue_division_score >= 70:
        if item.get("venue_id") and venue_counts.get(item["venue_id"], 0) > 0:
            reasons.append("Familiar venue")
        elif division_key and division_counts.get(division_key, 0) > 0:
            reasons.append("Familiar division")

    if item["type"] == "COVER_REQUEST" and urgency_score >= 85:
        reasons.append("Urgent cover request")

    if item["type"] != "EVENT" and item["date"] == now_local.date():
        reasons.append("Today opportunity")

    if not reasons:
        reasons.append("Good overall match")

    return final_score, reasons[:3]


def build_ranked_opportunities_for_user(
    user: User,
    profile: RefereeProfile,
    query_params: Mapping[str, Any],
) -> list[dict[str, Any]]:
    now_local = timezone.localtime()
    candidates = _build_candidates(user, profile, query_params)
    history = _build_user_history(profile)
    today = now_local.date()
    now_time = now_local.time().replace(second=0, microsecond=0)

    ranked: list[dict[str, Any]] = []
    for item in candidates:
        is_event = item["type"] == "EVENT"

        if not is_event:
            item_date: date = item["date"]
            item_time: time = item["time"]
            if item_date < today:
                continue
            if item_date == today and item_time < now_time:
                continue
            if item.get("role") == NonAppointedSlot.Role.CREW_CHIEF and profile.grade == "INTRO":
                continue
        else:
            start_date: date = item["date"]
            end_date: date = item.get("event_end_date") or start_date
            if end_date < today:
                continue

        score, reasons = _compute_item_score(
            item=item,
            user=user,
            history=history,
            now_local=now_local,
        )
        item["recommendation_score"] = score
        item["recommendation_reasons"] = reasons
        ranked.append(item)

    ranked.sort(
        key=lambda item: (
            -float(item["recommendation_score"]),
            item["date"],
            item["time"],
            item["created_at"],
        )
    )

    for index, item in enumerate(ranked):
        item["is_recommended"] = index < 5

    with transaction.atomic():
        RecommendationSnapshot.objects.filter(user=user).delete()
        RecommendationSnapshot.objects.bulk_create(
            [
                RecommendationSnapshot(
                    user=user,
                    opportunity_type=item["type"],
                    opportunity_id=item["id"],
                    score=_to_decimal_score(float(item["recommendation_score"])),
                    reasons=item.get("recommendation_reasons", []),
                )
                for item in ranked
            ]
        )

    return ranked
