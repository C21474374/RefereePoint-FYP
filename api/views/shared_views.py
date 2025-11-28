from rest_framework import viewsets
from games.models import Team, GameCategory, Competition
from api.serializers.shared_serializers import (
    TeamSerializer,
    GameCategorySerializer,
    CompetitionSerializer
)

class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.all().order_by("name")
    serializer_class = TeamSerializer

class GameCategoryViewSet(viewsets.ModelViewSet):
    queryset = GameCategory.objects.all().order_by("name")
    serializer_class = GameCategorySerializer

class CompetitionViewSet(viewsets.ModelViewSet):
    queryset = Competition.objects.all().order_by("name")
    serializer_class = CompetitionSerializer
