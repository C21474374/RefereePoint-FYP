# Chatgpt Prompts used to assist the creation of this file:
# Prompt1: Create Django viewsets for managing shared models like teams, game categories, competitions, and referees.

from rest_framework import viewsets
from games.models import Team, GameCategory, Competition
from users.models import RefereeProfile

from api.serializers.shared_serializers import (
    TeamSerializer,
    GameCategorySerializer,
    CompetitionSerializer,
    RefereeProfileSerializer,
)

# -----------------------------
# TEAM VIEWSET
# -----------------------------
class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.all().order_by("name")
    serializer_class = TeamSerializer


# -----------------------------
# GAME CATEGORY VIEWSET
# -----------------------------
class GameCategoryViewSet(viewsets.ModelViewSet):
    queryset = GameCategory.objects.all().order_by("name")
    serializer_class = GameCategorySerializer


# -----------------------------
# COMPETITION VIEWSET
# -----------------------------
class CompetitionViewSet(viewsets.ModelViewSet):
    queryset = Competition.objects.all().order_by("name")
    serializer_class = CompetitionSerializer


# -----------------------------
# REFEREE PROFILE VIEWSET (NEW)
# -----------------------------
class RefereeProfileViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Provides:
        GET /api/referees/       - list all
        GET /api/referees/<id>/  - retrieve one
    """

    queryset = RefereeProfile.objects.select_related("user").all()
    serializer_class = RefereeProfileSerializer
