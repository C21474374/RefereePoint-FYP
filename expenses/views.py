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
from users.geocoding import geocode_address
from users.models import RefereeProfile

from .models import ExpenseRecord, MonthlyEarningsSnapshot


def _haversine_km(lat1, lon1, lat2, lon2):
    earth_radius_km = 6371.0
    lat1_rad, lon1_rad, lat2_rad, lon2_rad = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    a = sin(dlat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return earth_radius_km * c


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
