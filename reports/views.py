from datetime import timedelta

from django.db import models
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from games.models import Game, NonAppointedSlot, RefereeAssignment
from games.serializers import GameSerializer
from users.models import RefereeProfile

from .models import GameReport
from .serializers import (
    GameReportCreateSerializer,
    GameReportSerializer,
    ReportableGameSerializer,
)


def _get_referee_profile_or_403(request):
    try:
        return RefereeProfile.objects.get(user=request.user), None
    except RefereeProfile.DoesNotExist:
        return None, Response(
            {"detail": "Only referees can access reports."},
            status=status.HTTP_403_FORBIDDEN,
        )


class ReportableGamesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        referee_profile, error_response = _get_referee_profile_or_403(request)
        if error_response:
            return error_response

        today = timezone.localdate()
        earliest_allowed = today - timedelta(days=7)

        games = (
            Game.objects.select_related(
                "venue",
                "division",
                "home_team__club",
                "away_team__club",
            )
            .filter(
                date__gte=earliest_allowed,
                date__lte=today,
            )
            .filter(
                models.Q(referee_assignments__referee=referee_profile)
                | models.Q(
                    non_appointed_slots__claimed_by=referee_profile,
                    non_appointed_slots__status__in=[
                        NonAppointedSlot.Status.CLAIMED,
                        NonAppointedSlot.Status.CLOSED,
                    ],
                )
            )
            .distinct()
            .order_by("-date", "-time")
        )

        if not games:
            return Response([], status=status.HTTP_200_OK)

        game_ids = [game.id for game in games]

        roles_by_game: dict[int, list[str]] = {}
        role_display_by_game: dict[int, list[str]] = {}

        assignments = RefereeAssignment.objects.filter(
            referee=referee_profile,
            game_id__in=game_ids,
        )
        for assignment in assignments:
            roles = roles_by_game.setdefault(assignment.game_id, [])
            if assignment.role not in roles:
                roles.append(assignment.role)

            role_displays = role_display_by_game.setdefault(assignment.game_id, [])
            role_display = assignment.get_role_display()
            if role_display not in role_displays:
                role_displays.append(role_display)

        claimed_slots = NonAppointedSlot.objects.filter(
            claimed_by=referee_profile,
            game_id__in=game_ids,
            status__in=[
                NonAppointedSlot.Status.CLAIMED,
                NonAppointedSlot.Status.CLOSED,
            ],
        )
        for slot in claimed_slots:
            roles = roles_by_game.setdefault(slot.game_id, [])
            if slot.role not in roles:
                roles.append(slot.role)

            role_displays = role_display_by_game.setdefault(slot.game_id, [])
            role_display = slot.get_role_display()
            if role_display not in role_displays:
                role_displays.append(role_display)

        reports_by_game = {
            report.game_id: report
            for report in GameReport.objects.filter(
                referee=referee_profile,
                game_id__in=game_ids,
            )
        }

        items = []
        for game in games:
            existing_report = reports_by_game.get(game.id)
            items.append(
                {
                    "game_id": game.id,
                    "game_details": game,
                    "roles": roles_by_game.get(game.id, []),
                    "roles_display": role_display_by_game.get(game.id, []),
                    "has_report": existing_report is not None,
                    "report_id": existing_report.id if existing_report else None,
                    "report_status": existing_report.status if existing_report else None,
                    "report_status_display": (
                        existing_report.get_status_display() if existing_report else None
                    ),
                    "report_submitted_at": (
                        existing_report.created_at if existing_report else None
                    ),
                }
            )

        serializer = ReportableGameSerializer(items, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MyReportsAPIView(generics.ListAPIView):
    serializer_class = GameReportSerializer
    permission_classes = [IsAuthenticated]
    referee_profile = None

    def list(self, request, *args, **kwargs):
        referee_profile, error_response = _get_referee_profile_or_403(request)
        if error_response:
            return error_response

        self.referee_profile = referee_profile
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        if self.referee_profile is None:
            return GameReport.objects.none()

        return (
            GameReport.objects.select_related(
                "game",
                "game__venue",
                "game__division",
                "game__home_team__club",
                "game__away_team__club",
                "submitted_by",
                "reviewed_by",
            )
            .filter(referee=self.referee_profile)
            .order_by("-created_at")
        )


class CreateGameReportAPIView(generics.CreateAPIView):
    serializer_class = GameReportCreateSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        report = serializer.save()

        output = GameReportSerializer(report, context={"request": request})
        return Response(output.data, status=status.HTTP_201_CREATED)
