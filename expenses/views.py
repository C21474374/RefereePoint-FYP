import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from math import atan2, cos, radians, sin, sqrt

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from games.models import Game, RefereeAssignment
from users.access import has_admin_approval_scope
from users.geocoding import geocode_address
from users.models import RefereeProfile

from .models import ExpenseRecord, MonthlyEarningsSnapshot, MonthlyPaymentApproval


def _haversine_km(lat1, lon1, lat2, lon2):
    earth_radius_km = 6371.0
    lat1_rad, lon1_rad, lat2_rad, lon2_rad = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    a = sin(dlat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return earth_radius_km * c


def _parse_year_month(request):
    today = timezone.localdate()
    try:
        year = int(request.query_params.get("year", today.year))
        month = int(request.query_params.get("month", today.month))
    except (TypeError, ValueError):
        return None, None, Response(
            {"detail": "year and month must be valid numbers."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if month < 1 or month > 12:
        return None, None, Response(
            {"detail": "month must be between 1 and 12."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return year, month, None


def _resolve_admin_game_type(request):
    requested_game_type = str(request.query_params.get("game_type", "")).upper()
    if not requested_game_type:
        requested_game_type = str(request.data.get("game_type", "")).upper()

    if requested_game_type and requested_game_type not in {Game.GameType.DOA, Game.GameType.NL}:
        return None, None, Response(
            {"detail": "game_type must be one of: DOA, NL."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if request.user.is_staff:
        selected = requested_game_type or Game.GameType.DOA
        return selected, [Game.GameType.DOA, Game.GameType.NL], None

    if not has_admin_approval_scope(request.user):
        return None, None, Response(
            {"detail": "Only approved DOA/NL admins can access admin earnings."},
            status=status.HTTP_403_FORBIDDEN,
        )

    account_type = str(request.user.account_type or "").upper()
    if account_type not in {Game.GameType.DOA, Game.GameType.NL}:
        return None, None, Response(
            {"detail": "Only DOA or NL account types can access admin earnings."},
            status=status.HTTP_403_FORBIDDEN,
        )

    allowed_game_types = [account_type]

    if requested_game_type:
        if requested_game_type != account_type:
            return None, None, Response(
                {"detail": "You can only view earnings for your admin role type."},
                status=status.HTTP_403_FORBIDDEN,
            )
    selected = account_type

    return selected, allowed_game_types, None


def _resolve_home_coordinates(user):
    home_lat = user.home_lat
    home_lon = user.home_lon

    if (home_lat is None or home_lon is None) and user.home_address:
        geocoded_home = geocode_address(user.home_address)
        if geocoded_home:
            home_lat, home_lon = geocoded_home
            user.home_lat = home_lat
            user.home_lon = home_lon
            user.save(update_fields=["home_lat", "home_lon"])

    return home_lat, home_lon


def _resolve_venue_coordinates(venue, geocoded_venues):
    if venue is None:
        return None, None

    venue_lat = venue.lat
    venue_lon = venue.lon

    if (venue_lat is None or venue_lon is None) and venue.address:
        cached = geocoded_venues.get(venue.id)
        if cached is None:
            query = f"{venue.name} {venue.address}".strip()
            cached = geocode_address(query)
            geocoded_venues[venue.id] = cached
        if cached:
            venue_lat, venue_lon = cached
            venue.lat = venue_lat
            venue.lon = venue_lon
            venue.save(update_fields=["lat", "lon"])

    return venue_lat, venue_lon


def _quantized_decimal(value):
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _calculate_referee_month_totals(referee_profile, game_type, year, month):
    """Calculate monthly totals for one referee and appointed game type."""
    today = timezone.localdate()
    requested_month_has_elapsed = (year, month) < (today.year, today.month)
    snapshot = MonthlyEarningsSnapshot.objects.filter(
        referee=referee_profile,
        game_type=game_type,
        year=year,
        month=month,
    ).first()

    if snapshot and requested_month_has_elapsed:
        return {
            "games_count": snapshot.games_count,
            "total_claim_amount": _quantized_decimal(snapshot.total_claim_amount),
            "is_finalized": True,
        }

    start_date = date(year, month, 1)
    end_date = date(year, month, calendar.monthrange(year, month)[1])

    assignments = (
        RefereeAssignment.objects.select_related("game", "game__venue")
        .filter(
            referee=referee_profile,
            game__game_type=game_type,
            game__payment_type=Game.PaymentType.CLAIM,
            game__date__range=(start_date, end_date),
        )
        .order_by("game__date", "game__time", "id")
    )

    if not assignments.exists():
        return {
            "games_count": 0,
            "total_claim_amount": Decimal("0.00"),
            "is_finalized": False,
        }

    base_fee = Decimal("25.00")
    rate_per_km = Decimal("0.31")
    home_lat, home_lon = _resolve_home_coordinates(referee_profile.user)
    geocoded_venues = {}

    previous_date = None
    previous_venue_id = None
    games_count = 0
    total_claim_amount = Decimal("0.00")

    for assignment in assignments:
        game = assignment.game
        games_count += 1
        travel_amount = Decimal("0.00")

        is_back_to_back_same_venue = (
            previous_date == game.date
            and previous_venue_id == game.venue_id
            and game.venue_id is not None
        )

        if not is_back_to_back_same_venue:
            if (
                assignment.travel_mode == RefereeAssignment.TravelMode.PUBLIC_TRANSPORT
                and assignment.public_transport_fare is not None
            ):
                travel_amount = _quantized_decimal(assignment.public_transport_fare)
            else:
                venue_lat, venue_lon = _resolve_venue_coordinates(game.venue, geocoded_venues)
                if (
                    home_lat is not None
                    and home_lon is not None
                    and venue_lat is not None
                    and venue_lon is not None
                ):
                    raw_distance = _haversine_km(home_lat, home_lon, venue_lat, venue_lon)
                    mileage_km = _quantized_decimal(str(raw_distance))
                    travel_amount = _quantized_decimal(mileage_km * rate_per_km)

        total_claim_amount += _quantized_decimal(base_fee + travel_amount)
        previous_date = game.date
        previous_venue_id = game.venue_id

    return {
        "games_count": games_count,
        "total_claim_amount": _quantized_decimal(total_claim_amount),
        "is_finalized": False,
    }


def _build_available_months(game_type, year, month):
    month_keys = {(year, month)}

    assignment_dates = RefereeAssignment.objects.filter(
        game__game_type=game_type,
        game__payment_type=Game.PaymentType.CLAIM,
    ).values_list("game__date", flat=True)
    for game_date in assignment_dates:
        month_keys.add((game_date.year, game_date.month))

    snapshots = MonthlyEarningsSnapshot.objects.filter(game_type=game_type).values_list(
        "year",
        "month",
    )
    for snapshot_year, snapshot_month in snapshots:
        month_keys.add((snapshot_year, snapshot_month))

    approvals = MonthlyPaymentApproval.objects.filter(game_type=game_type).values_list(
        "year",
        "month",
    )
    for approval_year, approval_month in approvals:
        month_keys.add((approval_year, approval_month))

    return [
        {
            "year": month_year,
            "month": month_number,
            "value": f"{month_year}-{str(month_number).zfill(2)}",
            "label": f"{calendar.month_abbr[month_number]} {month_year}",
        }
        for month_year, month_number in sorted(month_keys, reverse=True)
    ]


class RefereeEarningsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        referee_profile = RefereeProfile.objects.filter(user=request.user).first()
        if not referee_profile:
            return Response(
                {"detail": "Only referees can view earnings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        period = request.query_params.get("period", "month").lower()
        if period != "month":
            return Response(
                {"detail": "Earnings are monthly only. Use period=month with year and month."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        game_type = str(request.query_params.get("game_type", Game.GameType.DOA)).upper()
        if game_type not in {Game.GameType.DOA, Game.GameType.NL}:
            return Response(
                {"detail": "game_type must be one of: DOA, NL."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.localdate()
        try:
            year = int(request.query_params.get("year", today.year))
            month = int(request.query_params.get("month", today.month))
        except (TypeError, ValueError):
            return Response(
                {"detail": "year and month must be valid numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if month < 1 or month > 12:
            return Response(
                {"detail": "month must be between 1 and 12."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        month_end = calendar.monthrange(year, month)[1]
        start_date = date(year, month, 1)
        end_date = date(year, month, month_end)
        requested_month_has_elapsed = (year, month) < (today.year, today.month)

        assignments = (
            RefereeAssignment.objects.select_related(
                "game",
                "game__venue",
                "game__home_team__club",
                "game__away_team__club",
            )
            .filter(
                referee=referee_profile,
                game__game_type=game_type,
                game__payment_type=Game.PaymentType.CLAIM,
            )
            .order_by("game__date", "game__time", "id")
        )

        home_lat = request.user.home_lat
        home_lon = request.user.home_lon
        if (
            home_lat is None
            or home_lon is None
        ) and request.user.home_address:
            geocoded_home = geocode_address(request.user.home_address)
            if geocoded_home:
                home_lat, home_lon = geocoded_home
                request.user.home_lat = home_lat
                request.user.home_lon = home_lon
                request.user.save(update_fields=["home_lat", "home_lon"])

        base_fee_by_game_type = {
            Game.GameType.DOA: Decimal("25.00"),
            Game.GameType.NL: Decimal("25.00"),
        }
        base_fee_for_type = base_fee_by_game_type[game_type]
        rate_per_km = Decimal("0.31")

        def _empty_bucket():
            return {
                "games_count": 0,
                "base_fee_total": Decimal("0.00"),
                "travel_total": Decimal("0.00"),
                "mileage_km_total": Decimal("0.00"),
                "total_claim_amount": Decimal("0.00"),
                "missing_distance_games": 0,
                "items": [],
            }

        monthly_buckets: dict[tuple[int, int], dict] = {}
        selected_bucket = _empty_bucket()

        previous_date = None
        previous_venue_id = None
        computed_assignment_ids = []
        geocoded_venues = {}

        for assignment in assignments:
            game = assignment.game
            venue = game.venue
            computed_assignment_ids.append(assignment.id)

            is_back_to_back_same_venue = (
                previous_date == game.date
                and previous_venue_id == game.venue_id
                and game.venue_id is not None
            )

            base_fee = base_fee_for_type
            mileage_km = Decimal("0.00")
            travel_amount = Decimal("0.00")
            travel_source = ExpenseRecord.TravelSource.MILEAGE
            missing_distance_data = False

            if is_back_to_back_same_venue:
                travel_source = ExpenseRecord.TravelSource.BACK_TO_BACK_SAME_VENUE
            else:
                if (
                    assignment.travel_mode == RefereeAssignment.TravelMode.PUBLIC_TRANSPORT
                    and assignment.public_transport_fare is not None
                ):
                    travel_source = ExpenseRecord.TravelSource.PUBLIC_TRANSPORT
                    travel_amount = assignment.public_transport_fare.quantize(
                        Decimal("0.01"),
                        rounding=ROUND_HALF_UP,
                    )
                else:
                    venue_lat = venue.lat if venue else None
                    venue_lon = venue.lon if venue else None
                    if (
                        venue is not None
                        and (venue_lat is None or venue_lon is None)
                        and venue.address
                    ):
                        cached = geocoded_venues.get(venue.id)
                        if cached is None:
                            query = f"{venue.name} {venue.address}".strip()
                            cached = geocode_address(query)
                            geocoded_venues[venue.id] = cached
                        if cached:
                            venue_lat, venue_lon = cached
                            venue.lat = venue_lat
                            venue.lon = venue_lon
                            venue.save(update_fields=["lat", "lon"])

                    if (
                        home_lat is not None
                        and home_lon is not None
                        and venue_lat is not None
                        and venue_lon is not None
                    ):
                        raw_distance = _haversine_km(home_lat, home_lon, venue_lat, venue_lon)
                        mileage_km = Decimal(str(raw_distance)).quantize(
                            Decimal("0.01"),
                            rounding=ROUND_HALF_UP,
                        )
                        travel_amount = (mileage_km * rate_per_km).quantize(
                            Decimal("0.01"),
                            rounding=ROUND_HALF_UP,
                        )
                    else:
                        missing_distance_data = True

            total = (base_fee + travel_amount).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )

            item = {
                "assignment_id": assignment.id,
                "game_id": game.id,
                "date": game.date.isoformat(),
                "time": game.time.strftime("%H:%M:%S"),
                "venue_name": venue.name if venue else None,
                "home_team_name": str(game.home_team) if game.home_team else None,
                "away_team_name": str(game.away_team) if game.away_team else None,
                "role": assignment.role,
                "role_display": assignment.get_role_display(),
                "game_type": game.game_type,
                "game_type_display": game.get_game_type_display(),
                "base_fee": str(base_fee),
                "travel_mode": assignment.travel_mode,
                "travel_mode_display": assignment.get_travel_mode_display(),
                "travel_source": travel_source,
                "mileage_km": str(mileage_km),
                "travel_amount": str(travel_amount),
                "public_transport_fare": (
                    str(assignment.public_transport_fare)
                    if assignment.public_transport_fare is not None
                    else None
                ),
                "is_back_to_back_same_venue": is_back_to_back_same_venue,
                "total": str(total),
            }

            ExpenseRecord.objects.update_or_create(
                assignment=assignment,
                defaults={
                    "game": game,
                    "referee": referee_profile,
                    "base_fee": base_fee,
                    "travel_mode": assignment.travel_mode,
                    "travel_source": travel_source,
                    "mileage_km": mileage_km,
                    "travel_amount": travel_amount,
                    "public_transport_fare": assignment.public_transport_fare,
                    "is_back_to_back_same_venue": is_back_to_back_same_venue,
                    "missing_distance_data": missing_distance_data,
                    "total_amount": total,
                },
            )

            bucket_key = (game.date.year, game.date.month)
            bucket = monthly_buckets.setdefault(bucket_key, _empty_bucket())
            bucket["games_count"] += 1
            bucket["base_fee_total"] += base_fee
            bucket["travel_total"] += travel_amount
            bucket["mileage_km_total"] += mileage_km
            bucket["total_claim_amount"] += total
            if missing_distance_data:
                bucket["missing_distance_games"] += 1
            bucket["items"].append(item)

            if start_date <= game.date <= end_date:
                selected_bucket["games_count"] += 1
                selected_bucket["base_fee_total"] += base_fee
                selected_bucket["travel_total"] += travel_amount
                selected_bucket["mileage_km_total"] += mileage_km
                selected_bucket["total_claim_amount"] += total
                if missing_distance_data:
                    selected_bucket["missing_distance_games"] += 1
                selected_bucket["items"].append(item)

            previous_date = game.date
            previous_venue_id = game.venue_id

        ExpenseRecord.objects.filter(
            referee=referee_profile,
            game__game_type=game_type,
        ).exclude(
            assignment_id__in=computed_assignment_ids
        ).delete()

        # Automatically finalize elapsed months (previous months) for later viewing.
        for (bucket_year, bucket_month), bucket in monthly_buckets.items():
            if (bucket_year, bucket_month) >= (today.year, today.month):
                continue
            MonthlyEarningsSnapshot.objects.get_or_create(
                referee=referee_profile,
                game_type=game_type,
                year=bucket_year,
                month=bucket_month,
                defaults={
                    "games_count": bucket["games_count"],
                    "base_fee_total": bucket["base_fee_total"].quantize(Decimal("0.01")),
                    "travel_total": bucket["travel_total"].quantize(Decimal("0.01")),
                    "mileage_km_total": bucket["mileage_km_total"].quantize(Decimal("0.01")),
                    "total_claim_amount": bucket["total_claim_amount"].quantize(Decimal("0.01")),
                    "missing_distance_games": bucket["missing_distance_games"],
                    "items_snapshot": bucket["items"],
                },
            )

        selected_snapshot = MonthlyEarningsSnapshot.objects.filter(
            referee=referee_profile,
            game_type=game_type,
            year=year,
            month=month,
        ).first()

        if selected_snapshot and requested_month_has_elapsed:
            output_games_count = selected_snapshot.games_count
            output_base_fee_total = selected_snapshot.base_fee_total
            output_travel_total = selected_snapshot.travel_total
            output_mileage_total = selected_snapshot.mileage_km_total
            output_total_claim_amount = selected_snapshot.total_claim_amount
            output_missing_distance = selected_snapshot.missing_distance_games
            output_items = selected_snapshot.items_snapshot or []
        else:
            output_games_count = selected_bucket["games_count"]
            output_base_fee_total = selected_bucket["base_fee_total"]
            output_travel_total = selected_bucket["travel_total"]
            output_mileage_total = selected_bucket["mileage_km_total"]
            output_total_claim_amount = selected_bucket["total_claim_amount"]
            output_missing_distance = selected_bucket["missing_distance_games"]
            output_items = selected_bucket["items"]

        snapshot_lookup = {
            (snapshot.year, snapshot.month): snapshot
            for snapshot in MonthlyEarningsSnapshot.objects.filter(
                referee=referee_profile,
                game_type=game_type,
            )
        }
        available_month_keys = set(monthly_buckets.keys()) | set(snapshot_lookup.keys()) | {(year, month)}
        available_months = [
            {
                "year": month_year,
                "month": month_number,
                "value": f"{month_year}-{str(month_number).zfill(2)}",
                "label": f"{calendar.month_abbr[month_number]} {month_year}",
                "is_finalized": (month_year, month_number) in snapshot_lookup,
            }
            for month_year, month_number in sorted(available_month_keys, reverse=True)
        ]

        game_type_display = (
            "National League" if game_type == Game.GameType.NL else "DOA"
        )

        payload = {
            "home": {
                "home_address": request.user.home_address,
                "home_lat": request.user.home_lat,
                "home_lon": request.user.home_lon,
            },
            "rules": {
                "game_type": game_type,
                "game_type_display": game_type_display,
                "base_fee": str(base_fee_for_type),
                "rate_per_km": str(rate_per_km),
                "included_games": f"Appointed {game_type_display} games only",
                "excluded_expenses": ["tolls", "taxis", "parking"],
            },
            "period": period,
            "selected_month": {
                "year": year,
                "month": month,
                "value": f"{year}-{str(month).zfill(2)}",
                "label": f"{calendar.month_name[month]} {year}",
                "is_finalized": requested_month_has_elapsed and selected_snapshot is not None,
            },
            "available_months": available_months,
            "totals": {
                "games_count": output_games_count,
                "base_fee_total": str(output_base_fee_total.quantize(Decimal("0.01"))),
                "travel_total": str(output_travel_total.quantize(Decimal("0.01"))),
                "mileage_km_total": str(output_mileage_total.quantize(Decimal("0.01"))),
                "total_claim_amount": str(output_total_claim_amount.quantize(Decimal("0.01"))),
                "missing_distance_games": output_missing_distance,
            },
            "items": output_items,
        }

        return Response(payload, status=status.HTTP_200_OK)


class AdminMonthlyEarningsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        game_type, allowed_game_types, error_response = _resolve_admin_game_type(request)
        if error_response:
            return error_response

        year, month, month_error_response = _parse_year_month(request)
        if month_error_response:
            return month_error_response

        confirmations = (
            MonthlyPaymentApproval.objects.select_related("referee", "referee__user", "confirmed_by")
            .filter(game_type=game_type, year=year, month=month)
            .order_by("referee__user__first_name", "referee__user__last_name", "referee__id")
        )
        confirmations_by_referee_id = {item.referee_id: item for item in confirmations}

        pending_payments = []
        approved_payments = []

        referees = RefereeProfile.objects.select_related("user").all().order_by(
            "user__first_name",
            "user__last_name",
            "id",
        )

        for referee in referees:
            totals = _calculate_referee_month_totals(referee, game_type, year, month)
            confirmation = confirmations_by_referee_id.get(referee.id)
            referee_name = referee.user.get_full_name().strip() or referee.user.email

            if confirmation:
                approved_payments.append(
                    {
                        "payment_id": confirmation.id,
                        "referee_id": referee.id,
                        "referee_name": referee_name,
                        "referee_email": referee.user.email,
                        "referee_phone": referee.user.phone_number,
                        "games_count": confirmation.games_count,
                        "total_claim_amount": str(
                            _quantized_decimal(confirmation.total_claim_amount)
                        ),
                        "confirmed_at": confirmation.confirmed_at,
                        "confirmed_by_name": (
                            confirmation.confirmed_by.get_full_name().strip()
                            if confirmation.confirmed_by
                            else None
                        ),
                    }
                )
                continue

            if totals["games_count"] <= 0:
                continue

            pending_payments.append(
                {
                    "referee_id": referee.id,
                    "referee_name": referee_name,
                    "referee_email": referee.user.email,
                    "referee_phone": referee.user.phone_number,
                    "games_count": totals["games_count"],
                    "total_claim_amount": str(_quantized_decimal(totals["total_claim_amount"])),
                    "is_finalized": totals["is_finalized"],
                }
            )

        game_type_display = "National League" if game_type == Game.GameType.NL else "DOA"
        available_months = _build_available_months(game_type, year, month)
        selected_value = f"{year}-{str(month).zfill(2)}"

        return Response(
            {
                "game_type": game_type,
                "game_type_display": game_type_display,
                "allowed_game_types": allowed_game_types,
                "selected_month": {
                    "year": year,
                    "month": month,
                    "value": selected_value,
                    "label": f"{calendar.month_name[month]} {year}",
                },
                "available_months": available_months,
                "pending_payments": pending_payments,
                "approved_payments": approved_payments,
            },
            status=status.HTTP_200_OK,
        )


class ConfirmAdminMonthlyPaymentAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        game_type, _, error_response = _resolve_admin_game_type(request)
        if error_response:
            return error_response

        try:
            referee_id = int(request.data.get("referee_id"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "referee_id must be a valid number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            year = int(request.data.get("year"))
            month = int(request.data.get("month"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "year and month must be valid numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if month < 1 or month > 12:
            return Response(
                {"detail": "month must be between 1 and 12."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        referee = RefereeProfile.objects.select_related("user").filter(pk=referee_id).first()
        if not referee:
            return Response(
                {"detail": "Referee not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        totals = _calculate_referee_month_totals(referee, game_type, year, month)
        if totals["games_count"] <= 0:
            return Response(
                {"detail": "No monthly earnings found for this referee."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        approval, _ = MonthlyPaymentApproval.objects.update_or_create(
            referee=referee,
            game_type=game_type,
            year=year,
            month=month,
            defaults={
                "games_count": totals["games_count"],
                "total_claim_amount": _quantized_decimal(totals["total_claim_amount"]),
                "confirmed_by": request.user,
                "confirmed_at": timezone.now(),
            },
        )

        return Response(
            {
                "payment_id": approval.id,
                "referee_id": referee.id,
                "referee_name": referee.user.get_full_name().strip() or referee.user.email,
                "year": year,
                "month": month,
                "game_type": game_type,
                "games_count": approval.games_count,
                "total_claim_amount": str(_quantized_decimal(approval.total_claim_amount)),
                "confirmed_at": approval.confirmed_at,
            },
            status=status.HTTP_200_OK,
        )
