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
from users.models import RefereeProfile

from .models import ExpenseRecord


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
        today = timezone.localdate()
        start_date = None
        end_date = None

        if period == "month":
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
        elif period == "year":
            try:
                year = int(request.query_params.get("year", today.year))
            except (TypeError, ValueError):
                return Response(
                    {"detail": "year must be a valid number."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            start_date = date(year, 1, 1)
            end_date = date(year, 12, 31)
        elif period != "all":
            return Response(
                {"detail": "period must be one of: month, year, all."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignments = (
            RefereeAssignment.objects.select_related(
                "game",
                "game__venue",
                "game__home_team__club",
                "game__away_team__club",
            )
            .filter(
                referee=referee_profile,
                game__game_type=Game.GameType.DOA,
                game__payment_type=Game.PaymentType.CLAIM,
            )
            .order_by("game__date", "game__time", "id")
        )

        base_fee_doa = Decimal("25.00")
        rate_per_km = Decimal("0.31")

        base_fee_total = Decimal("0.00")
        travel_total = Decimal("0.00")
        mileage_km_total = Decimal("0.00")
        total_claim_amount = Decimal("0.00")
        missing_distance_games = 0

        items = []
        previous_date = None
        previous_venue_id = None
        computed_assignment_ids = []

        for assignment in assignments:
            game = assignment.game
            venue = game.venue
            computed_assignment_ids.append(assignment.id)

            is_back_to_back_same_venue = (
                previous_date == game.date
                and previous_venue_id == game.venue_id
                and game.venue_id is not None
            )

            base_fee = base_fee_doa
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
                    home_lat = request.user.home_lat
                    home_lon = request.user.home_lon
                    venue_lat = venue.lat if venue else None
                    venue_lon = venue.lon if venue else None

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

            in_period = (
                period == "all"
                or (start_date is not None and end_date is not None and start_date <= game.date <= end_date)
            )

            if in_period:
                if missing_distance_data:
                    missing_distance_games += 1

                base_fee_total += base_fee
                travel_total += travel_amount
                mileage_km_total += mileage_km
                total_claim_amount += total

                items.append(
                    {
                        "assignment_id": assignment.id,
                        "game_id": game.id,
                        "date": game.date,
                        "time": game.time,
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
                )

            previous_date = game.date
            previous_venue_id = game.venue_id

        ExpenseRecord.objects.filter(referee=referee_profile).exclude(
            assignment_id__in=computed_assignment_ids
        ).delete()

        payload = {
            "home": {
                "home_address": request.user.home_address,
                "home_lat": request.user.home_lat,
                "home_lon": request.user.home_lon,
            },
            "rules": {
                "base_fee_doa": str(base_fee_doa),
                "rate_per_km": str(rate_per_km),
                "included_games": "Appointed DOA games only",
                "excluded_expenses": ["tolls", "taxis", "parking"],
            },
            "period": period,
            "totals": {
                "games_count": len(items),
                "base_fee_total": str(base_fee_total.quantize(Decimal("0.01"))),
                "travel_total": str(travel_total.quantize(Decimal("0.01"))),
                "mileage_km_total": str(mileage_km_total.quantize(Decimal("0.01"))),
                "total_claim_amount": str(total_claim_amount.quantize(Decimal("0.01"))),
                "missing_distance_games": missing_distance_games,
            },
            "items": items,
        }

        return Response(payload, status=status.HTTP_200_OK)
