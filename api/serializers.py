from rest_framework import serializers
from users.models import User, RefereeProfile
from games.models import Game, GameCategory, Competition, Team, CoverRequest, Event


# -----------------------
# USER SERIALIZER
# (safe – no password)
# -----------------------

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = ['id']


# -----------------------
# REFEREE PROFILE SERIALIZER
# -----------------------

class RefereeProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = RefereeProfile
        fields = '__all__'


# -----------------------
# GAME SERIALIZER
# -----------------------

class GameSerializer(serializers.ModelSerializer):

    crew_chief = RefereeProfileSerializer(read_only=True)
    umpire1 = RefereeProfileSerializer(read_only=True)
    umpire2 = RefereeProfileSerializer(read_only=True)

    uploaded_by = UserSerializer(read_only=True)

    class Meta:
        model = Game
        fields = '__all__'


# -----------------------
# COVER REQUEST SERIALIZER
# -----------------------

class CoverRequestSerializer(serializers.ModelSerializer):
    referee = RefereeProfileSerializer(read_only=True)
    accepted_by = RefereeProfileSerializer(read_only=True)
    game = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = CoverRequest
        fields = '__all__'


# -----------------------
# OTHER MODELS
# -----------------------

class GameCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GameCategory
        fields = '__all__'


class CompetitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Competition
        fields = '__all__'


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = '__all__'


class EventSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)

    class Meta:
        model = Event
        fields = '__all__'
