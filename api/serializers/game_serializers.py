from rest_framework import serializers
from games.models import Game
from api.serializers.shared_serializers import (
    RefereeProfileSerializer,
    TeamSerializer,
    GameCategorySerializer,
    CompetitionSerializer,
    UserSerializer,
)


class GameSerializer(serializers.ModelSerializer):

    crew_chief = RefereeProfileSerializer(read_only=True)
    umpire1 = RefereeProfileSerializer(read_only=True)
    umpire2 = RefereeProfileSerializer(read_only=True)

    team_home = TeamSerializer(read_only=True)
    team_away = TeamSerializer(read_only=True)
    category = GameCategorySerializer(read_only=True)
    competition = CompetitionSerializer(read_only=True)

    uploaded_by = UserSerializer(read_only=True)

    class Meta:
        model = Game
        fields = "__all__"
