# Chatgpt Prompts used to assist the creation of this file:
# Prompt1: Create Django serializers for shared models like users, referees, teams, game categories, and competitions.

from rest_framework import serializers
from django.contrib.auth.models import User
from users.models import RefereeProfile
from games.models import Team, GameCategory, Competition


# USER
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]


# REFEREE
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


# TEAM
class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ["id", "name", "county"]


# CATEGORY
class GameCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GameCategory
        fields = ["id", "name", "can_ref_cancel"]



# COMPETITION
class CompetitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Competition
        fields = ["id", "name"]
