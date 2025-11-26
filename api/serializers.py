from rest_framework import serializers
from django.contrib.auth.models import User

from games.models import (
    Game,
    Team,
    GameCategory,
    Competition,
    CoverRequest,
    Event
)
from users.models import RefereeProfile


# -------------------------------------------------------
# BASIC USER SERIALIZER (safe, no password)
# -------------------------------------------------------
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]


# -------------------------------------------------------
# REFEREE PROFILE SERIALIZER
# -------------------------------------------------------
class RefereeProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = RefereeProfile
        fields = [
            "id",
            "user",
            "grade",
            "experience_years",
            "phone_number",
            "county",
            "bio",
        ]


# -------------------------------------------------------
# SIMPLE SERIALIZERS FOR RELATED MODELS
# -------------------------------------------------------
class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ["id", "name", "county"]


class GameCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GameCategory
        fields = ["id", "name"]


class CompetitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Competition
        fields = ["id", "name", "can_ref_cancel"]


# -------------------------------------------------------
# GAME SERIALIZER (nested refs)
# -------------------------------------------------------
class GameSerializer(serializers.ModelSerializer):
    crew_chief = RefereeProfileSerializer(read_only=True)
    umpire1 = RefereeProfileSerializer(read_only=True)
    umpire2 = RefereeProfileSerializer(read_only=True)

    # Related foreign keys
    team_home = TeamSerializer(read_only=True)
    team_away = TeamSerializer(read_only=True)
    category = GameCategorySerializer(read_only=True)
    competition = CompetitionSerializer(read_only=True)

    uploaded_by = UserSerializer(read_only=True)

    class Meta:
        model = Game
        fields = "__all__"


# -------------------------------------------------------
# COVER REQUEST SERIALIZER
# -------------------------------------------------------
class CoverRequestSerializer(serializers.ModelSerializer):
    referee = RefereeProfileSerializer(read_only=True)
    accepted_by = RefereeProfileSerializer(read_only=True)
    game = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = CoverRequest
        fields = [
            "id",
            "game",
            "referee",
            "status",
            "accepted_by",
            "accepted_at",
            "created_at",
        ]


# -------------------------------------------------------
# EVENT SERIALIZER
# -------------------------------------------------------
class EventSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)

    class Meta:
        model = Event
        fields = "__all__"
