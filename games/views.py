from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import generics, status
from django.db.models import Count, F, Q
from django.utils import timezone
from .models import Game, NonAppointedSlot, RefereeAssignment
from .serializers import (
    GameSerializer,
    NonAppointedSlotSerializer,
    RefereeAssignmentSerializer,
    NonAppointedGameUploadSerializer,
    NonAppointedGameManageSerializer,
    UploadedGameSerializer,
    OpportunityFeedItemSerializer,
)
from users.models import RefereeProfile
from cover_requests.models import CoverRequest
from events.models import Event
from notifications.services import notify_non_appointed_slot_claimed
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from datetime import datetime, time as dt_time

MANAGEABLE_UPLOAD_GAME_TYPES = [
    Game.GameType.CLUB,
    Game.GameType.SCHOOL,
    Game.GameType.COLLEGE,
    Game.GameType.FRIENDLY,
]

APPOINTED_UPLOAD_GAME_TYPES = [
    Game.GameType.DOA,
    Game.GameType.NL,
]


def _shared_appointed_game_types_for_user(user):
    allowed_types = user.get_allowed_upload_game_types()
    return [game_type for game_type in APPOINTED_UPLOAD_GAME_TYPES if game_type in allowed_types]


def _uploaded_games_queryset():
    return Game.objects.select_related(
        "venue",
        "division",
        "home_team__club",
        "away_team__club",
        "created_by",
    ).prefetch_related(
        "non_appointed_slots",
        "non_appointed_slots__claimed_by__user",
        "referee_assignments",
        "referee_assignments__referee__user",
    )


def _get_uploaded_game_for_user(user, pk):
    shared_appointed_types = _shared_appointed_game_types_for_user(user)
    return _uploaded_games_queryset().filter(
        pk=pk,
    ).filter(
        Q(
            game_type__in=MANAGEABLE_UPLOAD_GAME_TYPES,
            non_appointed_slots__posted_by=user,
        )
        | Q(
            game_type__in=shared_appointed_types,
        )
    ).first()


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfCookieAPIView(APIView):
    def get(self, request):
        return Response({"detail": "CSRF cookie set."}, status=status.HTTP_200_OK)


class GameListAPIView(generics.ListAPIView):
    serializer_class = GameSerializer

    def get_queryset(self):
        queryset = (
            Game.objects.select_related(
                "venue",
                "division",
                "home_team__club",
                "away_team__club",
                "created_by",
            )
            .prefetch_related(
                "referee_assignments",
                "non_appointed_slots",
            )
            .all()
            .order_by("date", "time")
        )

        game_type = self.request.query_params.get("game_type")
        division_id = self.request.query_params.get("division")
        date = self.request.query_params.get("date")
        venue_id = self.request.query_params.get("venue")
        status = self.request.query_params.get("status")
        payment_type = self.request.query_params.get("payment_type")

        if game_type:
            queryset = queryset.filter(game_type=game_type)

        if division_id:
            queryset = queryset.filter(division_id=division_id)

        if date:
            queryset = queryset.filter(date=date)

        if venue_id:
            queryset = queryset.filter(venue_id=venue_id)

        if status:
            queryset = queryset.filter(status=status)

        if payment_type:
            queryset = queryset.filter(payment_type=payment_type)

        return queryset


class GameDetailAPIView(generics.RetrieveAPIView):
    queryset = (
        Game.objects.select_related(
            "venue",
            "division",
            "home_team__club",
            "away_team__club",
            "created_by",
        )
        .prefetch_related(
            "referee_assignments__referee__user",
            "non_appointed_slots__claimed_by__user",
            "non_appointed_slots__posted_by",
        )
        .all()
    )
    serializer_class = GameSerializer


class RefereeAssignmentListAPIView(generics.ListAPIView):
    serializer_class = RefereeAssignmentSerializer

    def get_queryset(self):
        queryset = (
            RefereeAssignment.objects.select_related(
                "game",
                "game__venue",
                "game__division",
                "game__home_team__club",
                "game__away_team__club",
                "referee__user",
            )
            .all()
            .order_by("game__date", "game__time", "role")
        )

        game_id = self.request.query_params.get("game_id")
        referee_id = self.request.query_params.get("referee_id")
        role = self.request.query_params.get("role")

        if game_id:
            queryset = queryset.filter(game_id=game_id)

        if referee_id:
            queryset = queryset.filter(referee_id=referee_id)

        if role:
            queryset = queryset.filter(role=role)

        return queryset


class NonAppointedSlotListAPIView(generics.ListAPIView):
    serializer_class = NonAppointedSlotSerializer

    def get_queryset(self):
        queryset = (
            NonAppointedSlot.objects.select_related(
                "game",
                "game__venue",
                "game__division",
                "game__home_team__club",
                "game__away_team__club",
                "posted_by",
                "claimed_by__user",
            )
            .all()
            .order_by("game__date", "game__time", "role")
        )

        game_id = self.request.query_params.get("game_id")
        venue_id = self.request.query_params.get("venue")
        role = self.request.query_params.get("role")
        status = self.request.query_params.get("status")
        is_active = self.request.query_params.get("is_active")
        date = self.request.query_params.get("date")
        game_type = self.request.query_params.get("game_type")

        if game_id:
            queryset = queryset.filter(game_id=game_id)

        if venue_id:
            queryset = queryset.filter(game__venue_id=venue_id)

        if role:
            queryset = queryset.filter(role=role)

    

        if status:
            queryset = queryset.filter(status=status)

        if is_active is not None:
            if is_active.lower() == "true":
                queryset = queryset.filter(is_active=True)
            elif is_active.lower() == "false":
                queryset = queryset.filter(is_active=False)

        if date:
            queryset = queryset.filter(game__date=date)

        if game_type:
            queryset = queryset.filter(game__game_type=game_type)

        return queryset


class NonAppointedSlotDetailAPIView(generics.RetrieveAPIView):
    queryset = (
        NonAppointedSlot.objects.select_related(
            "game",
            "game__venue",
            "game__division",
            "game__home_team__club",
            "game__away_team__club",
            "posted_by",
            "claimed_by__user",
        )
        .all()
    )
    serializer_class = NonAppointedSlotSerializer

class ClaimNonAppointedSlotAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            slot = NonAppointedSlot.objects.select_related(
                "game",
                "claimed_by",
            ).get(pk=pk)
        except NonAppointedSlot.DoesNotExist:
            return Response(
                {"detail": "Slot not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if slot.status != NonAppointedSlot.Status.OPEN:
            return Response(
                {"detail": "This slot is no longer available."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            referee = RefereeProfile.objects.get(user=request.user)
        except RefereeProfile.DoesNotExist:
            return Response(
                {"detail": "Only referees can claim games."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if slot.role == NonAppointedSlot.Role.CREW_CHIEF:
            if referee.grade == "INTRO":
                return Response(
                    {"detail": "Intro referees cannot claim Crew Chief."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        slot.claimed_by = referee
        slot.status = NonAppointedSlot.Status.CLAIMED
        slot.claimed_at = timezone.now()

        slot.save()
        try:
            notify_non_appointed_slot_claimed(slot, actor_user=request.user)
        except Exception:
            pass

        serializer = NonAppointedSlotSerializer(slot)

        return Response(serializer.data, status=status.HTTP_200_OK)


class NonAppointedGameUploadAPIView(generics.CreateAPIView):
    serializer_class = NonAppointedGameUploadSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        game = serializer.save()

        output_serializer = GameSerializer(game, context={"request": request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


class MyUploadedGamesAPIView(generics.ListAPIView):
    serializer_class = UploadedGameSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        shared_appointed_types = _shared_appointed_game_types_for_user(self.request.user)
        return (
            _uploaded_games_queryset()
            .filter(
                Q(
                    game_type__in=MANAGEABLE_UPLOAD_GAME_TYPES,
                    non_appointed_slots__posted_by=self.request.user,
                )
                | Q(
                    game_type__in=shared_appointed_types,
                )
            )
            .distinct()
            .order_by("date", "time")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class MyUploadedGameUpdateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        game = _get_uploaded_game_for_user(request.user, pk)
        if not game:
            return Response(
                {"detail": "Uploaded game not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = NonAppointedGameManageSerializer(
            game,
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        updated_game = serializer.save()

        output_serializer = UploadedGameSerializer(
            updated_game,
            context={"request": request},
        )
        return Response(output_serializer.data, status=status.HTTP_200_OK)


class MyUploadedGameDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        game = _get_uploaded_game_for_user(request.user, pk)
        if not game:
            return Response(
                {"detail": "Uploaded game not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        foreign_slots = game.non_appointed_slots.exclude(posted_by=request.user)
        if foreign_slots.exists():
            return Response(
                {
                    "detail": (
                        "You can only delete uploads where all opportunity slots "
                        "were created by you."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        claimed_slots = game.non_appointed_slots.filter(
            is_active=True,
            status=NonAppointedSlot.Status.CLAIMED,
        )
        if claimed_slots.exists():
            return Response(
                {"detail": "You cannot delete this game while one or more slots are claimed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        game.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OpportunityFeedAPIView(APIView):
    """
    Combined opportunities feed for the frontend.

    Includes:
    - Non-appointed slots
    - Cover requests
    """

    def get(self, request):
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
            .order_by("game__date", "game__time", "created_at")
        )
        today = timezone.localdate()

        CoverRequest.objects.filter(
            status__in=[CoverRequest.Status.PENDING, CoverRequest.Status.CLAIMED],
            game__date__lt=today,
        ).update(
            status=CoverRequest.Status.REJECTED,
            replaced_by=None,
            updated_at=timezone.now(),
        )

        events = (
            Event.objects.select_related("venue")
            .filter(end_date__gte=today)
            .order_by("start_date")
        )
        referee_profile = None
        if request.user.is_authenticated:
            referee_profile = RefereeProfile.objects.filter(user=request.user).first()
            if referee_profile:
                events = events.exclude(referee_assignments__referee=referee_profile)

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
            .filter(game__date__gte=today)
            .order_by("game__date", "game__time", "created_at")
        )

        date = request.query_params.get("date")
        venue_id = request.query_params.get("venue")
        role = request.query_params.get("role")
        game_type = request.query_params.get("game_type")

        opportunity_type = request.query_params.get("type")

        if date:
            non_appointed_slots = non_appointed_slots.filter(game__date=date)
            cover_requests = cover_requests.filter(game__date=date)
            events = events.filter(start_date__lte=date, end_date__gte=date)

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

        events = events.annotate(joined_referees_count=Count("referee_assignments"))
        events = events.filter(
            Q(referees_required=0) | Q(joined_referees_count__lt=F("referees_required"))
        )


        items = []

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
                        "home_team_name": (
                            game.home_team.club.name
                            if game.home_team and game.home_team.club
                            else None
                        ),
                        "away_team_name": (
                            game.away_team.club.name
                            if game.away_team and game.away_team.club
                            else None
                        ),
                        "division_name": division.name if division else None,
                        "division_gender": getattr(division, "gender", None) if division else None,
                        "payment_type": game.payment_type,
                        "payment_type_display": game.get_payment_type_display() if game.payment_type else None,
                        "role": slot.role,
                        "role_display": slot.get_role_display(),
                        "status": slot.status,
                        "status_display": slot.get_status_display(),
                        "posted_by_name": slot.posted_by.get_full_name() if slot.posted_by else None,
                        "claimed_by_name": (
                            slot.claimed_by.user.get_full_name()
                            if slot.claimed_by and slot.claimed_by.user
                            else None
                        ),
                        "requested_by_name": None,
                        "original_referee_name": None,
                        "replaced_by_name": None,
                        "description": slot.description,
                        "reason": "",
                        "created_at": slot.created_at,
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
                        "home_team_name": (
                            game.home_team.club.name
                            if game.home_team and game.home_team.club
                            else None
                        ),
                        "away_team_name": (
                            game.away_team.club.name
                            if game.away_team and game.away_team.club
                            else None
                        ),
                        "division_name": division.name if division else None,
                        "division_gender": getattr(division, "gender", None) if division else None,
                        "payment_type": game.payment_type,
                        "payment_type_display": game.get_payment_type_display() if game.payment_type else None,
                        "role": cover.referee_slot.role if cover.referee_slot else None,
                        "role_display": cover.referee_slot.get_role_display() if cover.referee_slot else None,
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
                        "time": dt_time(0, 0),
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
                            datetime.combine(event.start_date, dt_time.min)
                        ),
                    }
                )

        items.sort(
            key=lambda item: (
                item["date"],
                item["time"],
                item["created_at"],
            )
        )

        serializer = OpportunityFeedItemSerializer(items, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class UploadGameAvailabilityView(APIView):
    """
    Check whether a game already exists and which referee sides are still available.

    Matching game rule:
    same home_team + away_team + venue + date + time
    """

    def get(self, request):
        home_team = request.query_params.get("home_team")
        away_team = request.query_params.get("away_team")
        venue = request.query_params.get("venue")
        date = request.query_params.get("date")
        time = request.query_params.get("time")

        if not all([home_team, away_team, venue, date, time]):
            return Response(
                {
                    "detail": "home_team, away_team, venue, date, and time are required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        game_type = request.query_params.get("game_type")

        if not all([home_team, away_team, venue, date, time, game_type]):
            return Response(
                {
                    "detail": "home_team, away_team, venue, date, time, and game_type are required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        game = Game.objects.filter(
            home_team_id=home_team,
            away_team_id=away_team,
            venue_id=venue,
            date=date,
            time=time,
            game_type=game_type,
        ).first()

        if not game:
            return Response(
                {
                    "exists": False,
                    "game_id": None,
                    "home_available": True,
                    "away_available": True,
                    "existing_roles": [],
                    "message": "No matching game exists yet."
                }
            )

        existing_roles = list(
            game.non_appointed_slots.filter(
                is_active=True,
                status__in=[
                    NonAppointedSlot.Status.OPEN,
                    NonAppointedSlot.Status.CLAIMED,
                ],
            ).values_list("role", flat=True)
        )

        # home request maps to CREW_CHIEF
        # away request maps to UMPIRE_1
        home_available = NonAppointedSlot.Role.CREW_CHIEF not in existing_roles
        away_available = NonAppointedSlot.Role.UMPIRE_1 not in existing_roles

        return Response(
            {
                "exists": True,
                "game_id": game.id,
                "home_available": home_available,
                "away_available": away_available,
                "existing_roles": existing_roles,
                "message": "Matching game found."
            }
        )
    
class MyClaimedGamesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            referee = RefereeProfile.objects.get(user=request.user)
        except RefereeProfile.DoesNotExist:
            return Response(
                {"detail": "Referee profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        slots = (
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
                claimed_by=referee,
                is_active=True,
                status=NonAppointedSlot.Status.CLAIMED,
            )
            .order_by("game__date", "game__time")
        )

        serializer = NonAppointedSlotSerializer(slots, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
