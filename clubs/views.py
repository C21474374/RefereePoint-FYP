from __future__ import annotations

from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from games.models import Game
from users.models import User

from .models import Club, Division, Team


def _json_error(message: str, status_code: int) -> JsonResponse:
    return JsonResponse({"error": message}, status=status_code)


def _to_bool(value: object, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _is_configure_admin(user: User) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    return (
        user.account_type in {User.AccountType.DOA, User.AccountType.NL}
        and user.doa_approved
    )


def _club_to_dict(club: Club) -> dict:
    return {
        "id": club.id,
        "name": club.name,
    }


def _division_to_dict(division: Division) -> dict:
    return {
        "id": division.id,
        "name": division.name,
        "gender": division.gender,
        "requires_appointed_referees": division.requires_appointed_referees,
        "display": str(division),
        "is_active": division.is_active,
    }


def _team_to_dict(team: Team) -> dict:
    return {
        "id": team.id,
        "club_id": team.club_id,
        "club_name": team.club.name,
        "division_id": team.division_id,
        "division_name": str(team.division),
        "is_active": team.is_active,
    }


def _upcoming_games_queryset():
    today = timezone.localdate()
    return Game.objects.filter(date__gte=today).exclude(
        status__in=[Game.Status.CANCELLED, Game.Status.COMPLETED]
    )


def list_clubs(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    clubs = Club.objects.all().order_by("name")
    data = [_club_to_dict(c) for c in clubs]
    return JsonResponse(data, safe=False)


def club_detail(request, club_id):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    try:
        club = Club.objects.get(pk=club_id)
    except Club.DoesNotExist:
        return _json_error("Club not found", 404)

    return JsonResponse(_club_to_dict(club))


def list_divisions(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    include_inactive = _to_bool(request.GET.get("include_inactive"), default=False)

    divisions = Division.objects.all()
    if not include_inactive:
        divisions = divisions.filter(is_active=True)

    divisions = divisions.order_by("name", "gender")
    data = [_division_to_dict(d) for d in divisions]
    return JsonResponse(data, safe=False)


def division_detail(request, division_id):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    try:
        division = Division.objects.get(pk=division_id)
    except Division.DoesNotExist:
        return _json_error("Division not found", 404)

    return JsonResponse(_division_to_dict(division))


def list_teams(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    include_inactive = _to_bool(request.GET.get("include_inactive"), default=False)
    teams = Team.objects.select_related("club", "division").all()

    if not include_inactive:
        teams = teams.filter(is_active=True, division__is_active=True)

    club_id = request.GET.get("club_id")
    if club_id:
        teams = teams.filter(club_id=club_id)

    division_id = request.GET.get("division_id")
    if division_id:
        teams = teams.filter(division_id=division_id)

    teams = teams.order_by("club__name", "division__name", "division__gender")
    data = [_team_to_dict(t) for t in teams]
    return JsonResponse(data, safe=False)


def team_detail(request, team_id):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    try:
        team = Team.objects.select_related("club", "division").get(pk=team_id)
    except Team.DoesNotExist:
        return _json_error("Team not found", 404)

    return JsonResponse(_team_to_dict(team))


class ConfigureBootstrapAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_configure_admin(request.user):
            return Response(
                {"detail": "Only DOA/NL admins can access configuration."},
                status=status.HTTP_403_FORBIDDEN,
            )

        clubs = Club.objects.all().order_by("name")
        divisions = Division.objects.all().order_by("name", "gender")
        teams = Team.objects.select_related("club", "division").order_by(
            "club__name",
            "division__name",
            "division__gender",
        )

        return Response(
            {
                "clubs": [_club_to_dict(item) for item in clubs],
                "divisions": [_division_to_dict(item) for item in divisions],
                "teams": [_team_to_dict(item) for item in teams],
            },
            status=status.HTTP_200_OK,
        )


class ConfigureDivisionsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _is_configure_admin(request.user):
            return Response(
                {"detail": "Only DOA/NL admins can create divisions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        name = str(request.data.get("name") or "").strip()
        if not name:
            return Response(
                {"detail": "Division name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        gender = str(request.data.get("gender") or "").strip().upper()
        valid_genders = {choice[0] for choice in Division.GENDER_CHOICES}
        if gender not in valid_genders:
            return Response(
                {"detail": "Division gender must be M or F."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        requires_appointed = _to_bool(
            request.data.get("requires_appointed_referees"),
            default=False,
        )

        duplicate = Division.objects.filter(
            name__iexact=name,
            gender=gender,
        ).exists()
        if duplicate:
            return Response(
                {"detail": "A division with this name and gender already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        division = Division.objects.create(
            name=name,
            gender=gender,
            requires_appointed_referees=requires_appointed,
            is_active=True,
        )
        return Response(_division_to_dict(division), status=status.HTTP_201_CREATED)


class ConfigureDivisionDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, division_id: int):
        if not _is_configure_admin(request.user):
            return Response(
                {"detail": "Only DOA/NL admins can update divisions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            division = Division.objects.get(pk=division_id)
        except Division.DoesNotExist:
            return Response({"detail": "Division not found."}, status=status.HTTP_404_NOT_FOUND)

        name = str(request.data.get("name") or division.name).strip()
        if not name:
            return Response(
                {"detail": "Division name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        gender = str(request.data.get("gender") or division.gender).strip().upper()
        valid_genders = {choice[0] for choice in Division.GENDER_CHOICES}
        if gender not in valid_genders:
            return Response(
                {"detail": "Division gender must be M or F."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        requires_appointed = _to_bool(
            request.data.get("requires_appointed_referees"),
            default=division.requires_appointed_referees,
        )
        next_active = _to_bool(request.data.get("is_active"), default=division.is_active)

        duplicate = Division.objects.filter(
            name__iexact=name,
            gender=gender,
        ).exclude(pk=division.pk)
        if duplicate.exists():
            return Response(
                {"detail": "A division with this name and gender already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if division.is_active and not next_active:
            if _upcoming_games_queryset().filter(division=division).exists():
                return Response(
                    {
                        "detail": (
                            "You cannot deactivate this division while upcoming games use it."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        division.name = name
        division.gender = gender
        division.requires_appointed_referees = requires_appointed
        division.is_active = next_active
        division.save(
            update_fields=[
                "name",
                "gender",
                "requires_appointed_referees",
                "is_active",
            ]
        )
        return Response(_division_to_dict(division), status=status.HTTP_200_OK)


class ConfigureTeamsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _is_configure_admin(request.user):
            return Response(
                {"detail": "Only DOA/NL admins can create teams."},
                status=status.HTTP_403_FORBIDDEN,
            )

        club_id = request.data.get("club_id")
        division_id = request.data.get("division_id")
        if not club_id or not division_id:
            return Response(
                {"detail": "club_id and division_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        club = Club.objects.filter(pk=club_id).first()
        if not club:
            return Response(
                {"detail": "Selected club does not exist."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        division = Division.objects.filter(pk=division_id).first()
        if not division:
            return Response(
                {"detail": "Selected division does not exist."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not division.is_active:
            return Response(
                {"detail": "Selected division is inactive."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        duplicate = Team.objects.filter(club=club, division=division).first()
        if duplicate:
            return Response(
                {
                    "detail": (
                        "A team for this club and division already exists. "
                        "Edit/reactivate the existing one instead."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        team = Team.objects.create(
            club=club,
            division=division,
            is_active=True,
        )
        team = Team.objects.select_related("club", "division").get(pk=team.pk)
        return Response(_team_to_dict(team), status=status.HTTP_201_CREATED)


class ConfigureTeamDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, team_id: int):
        if not _is_configure_admin(request.user):
            return Response(
                {"detail": "Only DOA/NL admins can update teams."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            team = Team.objects.select_related("club", "division").get(pk=team_id)
        except Team.DoesNotExist:
            return Response({"detail": "Team not found."}, status=status.HTTP_404_NOT_FOUND)

        club = team.club
        division = team.division

        if "club_id" in request.data:
            club_id = request.data.get("club_id")
            club = Club.objects.filter(pk=club_id).first()
            if not club:
                return Response(
                    {"detail": "Selected club does not exist."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if "division_id" in request.data:
            division_id = request.data.get("division_id")
            division = Division.objects.filter(pk=division_id).first()
            if not division:
                return Response(
                    {"detail": "Selected division does not exist."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not division.is_active:
                return Response(
                    {"detail": "Selected division is inactive."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        next_active = _to_bool(request.data.get("is_active"), default=team.is_active)

        duplicate = Team.objects.filter(club=club, division=division).exclude(pk=team.pk)
        if duplicate.exists():
            return Response(
                {"detail": "A team for this club and division already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if team.is_active and not next_active:
            if _upcoming_games_queryset().filter(
                Q(home_team=team) | Q(away_team=team)
            ).exists():
                return Response(
                    {
                        "detail": (
                            "You cannot deactivate this team while upcoming games use it."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if next_active and not division.is_active:
            return Response(
                {
                    "detail": (
                        "You cannot activate a team while its division is inactive."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        team.club = club
        team.division = division
        team.is_active = next_active
        team.save(update_fields=["club", "division", "is_active"])
        team = Team.objects.select_related("club", "division").get(pk=team.pk)
        return Response(_team_to_dict(team), status=status.HTTP_200_OK)
