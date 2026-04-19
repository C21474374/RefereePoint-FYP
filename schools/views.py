from __future__ import annotations

from django.http import JsonResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.access import has_admin_approval_scope
from users.models import User

from .models import School, SchoolDivision, SchoolTeam


def _json_error(message: str, status_code: int) -> JsonResponse:
    return JsonResponse({"error": message}, status=status_code)


def _to_bool(value: object, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _is_configure_admin(user: User) -> bool:
    return has_admin_approval_scope(user)


def _school_to_dict(school: School) -> dict:
    return {
        "id": school.id,
        "name": school.name,
    }


def _division_to_dict(division: SchoolDivision) -> dict:
    return {
        "id": division.id,
        "name": division.name,
        "gender": division.gender,
        "requires_appointed_referees": division.requires_appointed_referees,
        "display": str(division),
        "is_active": division.is_active,
    }


def _team_to_dict(team: SchoolTeam) -> dict:
    return {
        "id": team.id,
        "school_id": team.school_id,
        "school_name": team.school.name,
        "division_id": team.division_id,
        "division_name": str(team.division),
        "is_active": team.is_active,
    }


def list_schools(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    schools = School.objects.all().order_by("name")
    data = [_school_to_dict(item) for item in schools]
    return JsonResponse(data, safe=False)


def school_detail(request, school_id: int):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    try:
        school = School.objects.get(pk=school_id)
    except School.DoesNotExist:
        return _json_error("School not found", 404)

    return JsonResponse(_school_to_dict(school))


def list_divisions(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    include_inactive = _to_bool(request.GET.get("include_inactive"), default=False)

    divisions = SchoolDivision.objects.all()
    if not include_inactive:
        divisions = divisions.filter(is_active=True)

    divisions = divisions.order_by("name", "gender")
    data = [_division_to_dict(item) for item in divisions]
    return JsonResponse(data, safe=False)


def division_detail(request, division_id: int):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    try:
        division = SchoolDivision.objects.get(pk=division_id)
    except SchoolDivision.DoesNotExist:
        return _json_error("Division not found", 404)

    return JsonResponse(_division_to_dict(division))


def list_teams(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    include_inactive = _to_bool(request.GET.get("include_inactive"), default=False)
    teams = SchoolTeam.objects.select_related("school", "division").all()

    if not include_inactive:
        teams = teams.filter(is_active=True, division__is_active=True)

    school_id = request.GET.get("school_id")
    if school_id:
        teams = teams.filter(school_id=school_id)

    division_id = request.GET.get("division_id")
    if division_id:
        teams = teams.filter(division_id=division_id)

    teams = teams.order_by("school__name", "division__name", "division__gender")
    data = [_team_to_dict(item) for item in teams]
    return JsonResponse(data, safe=False)


def team_detail(request, team_id: int):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)

    try:
        team = SchoolTeam.objects.select_related("school", "division").get(pk=team_id)
    except SchoolTeam.DoesNotExist:
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

        schools = School.objects.all().order_by("name")
        divisions = SchoolDivision.objects.all().order_by("name", "gender")
        teams = SchoolTeam.objects.select_related("school", "division").order_by(
            "school__name",
            "division__name",
            "division__gender",
        )

        return Response(
            {
                "schools": [_school_to_dict(item) for item in schools],
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
        valid_genders = {choice[0] for choice in SchoolDivision.GENDER_CHOICES}
        if gender not in valid_genders:
            return Response(
                {"detail": "Division gender must be M or F."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        requires_appointed = _to_bool(
            request.data.get("requires_appointed_referees"),
            default=False,
        )

        duplicate = SchoolDivision.objects.filter(name__iexact=name, gender=gender).exists()
        if duplicate:
            return Response(
                {"detail": "A division with this name and gender already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        division = SchoolDivision.objects.create(
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
            division = SchoolDivision.objects.get(pk=division_id)
        except SchoolDivision.DoesNotExist:
            return Response({"detail": "Division not found."}, status=status.HTTP_404_NOT_FOUND)

        name = str(request.data.get("name") or division.name).strip()
        if not name:
            return Response(
                {"detail": "Division name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        gender = str(request.data.get("gender") or division.gender).strip().upper()
        valid_genders = {choice[0] for choice in SchoolDivision.GENDER_CHOICES}
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

        duplicate = SchoolDivision.objects.filter(name__iexact=name, gender=gender).exclude(
            pk=division.pk
        )
        if duplicate.exists():
            return Response(
                {"detail": "A division with this name and gender already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        division.name = name
        division.gender = gender
        division.requires_appointed_referees = requires_appointed
        division.is_active = next_active
        division.save(update_fields=["name", "gender", "requires_appointed_referees", "is_active"])
        return Response(_division_to_dict(division), status=status.HTTP_200_OK)


class ConfigureTeamsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _is_configure_admin(request.user):
            return Response(
                {"detail": "Only DOA/NL admins can create teams."},
                status=status.HTTP_403_FORBIDDEN,
            )

        school_id = request.data.get("school_id")
        division_id = request.data.get("division_id")
        if not school_id or not division_id:
            return Response(
                {"detail": "school_id and division_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        school = School.objects.filter(pk=school_id).first()
        if not school:
            return Response(
                {"detail": "Selected school does not exist."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        division = SchoolDivision.objects.filter(pk=division_id).first()
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

        duplicate = SchoolTeam.objects.filter(school=school, division=division).first()
        if duplicate:
            return Response(
                {
                    "detail": (
                        "A team for this school and division already exists. "
                        "Edit/reactivate the existing one instead."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        team = SchoolTeam.objects.create(school=school, division=division, is_active=True)
        team = SchoolTeam.objects.select_related("school", "division").get(pk=team.pk)
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
            team = SchoolTeam.objects.select_related("school", "division").get(pk=team_id)
        except SchoolTeam.DoesNotExist:
            return Response({"detail": "Team not found."}, status=status.HTTP_404_NOT_FOUND)

        school = team.school
        division = team.division

        if "school_id" in request.data:
            school_id = request.data.get("school_id")
            school = School.objects.filter(pk=school_id).first()
            if not school:
                return Response(
                    {"detail": "Selected school does not exist."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if "division_id" in request.data:
            division_id = request.data.get("division_id")
            division = SchoolDivision.objects.filter(pk=division_id).first()
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

        duplicate = SchoolTeam.objects.filter(school=school, division=division).exclude(pk=team.pk)
        if duplicate.exists():
            return Response(
                {"detail": "A team for this school and division already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if next_active and not division.is_active:
            return Response(
                {"detail": "You cannot activate a team while its division is inactive."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        team.school = school
        team.division = division
        team.is_active = next_active
        team.save(update_fields=["school", "division", "is_active"])
        team = SchoolTeam.objects.select_related("school", "division").get(pk=team.pk)
        return Response(_team_to_dict(team), status=status.HTTP_200_OK)
