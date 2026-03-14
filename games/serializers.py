from rest_framework import serializers
from .models import Game, RefereeAssignment


class GameSerializer(serializers.ModelSerializer):
    venue_name = serializers.CharField(source="venue.name", read_only=True)
    lat = serializers.FloatField(source="venue.lat", read_only=True)
    lng = serializers.FloatField(source="venue.lon", read_only=True)

    home_team_name = serializers.CharField(source="home_team.club.name", read_only=True)
    away_team_name = serializers.CharField(source="away_team.club.name", read_only=True)

    division_name = serializers.CharField(source="division.name", read_only=True)
    division_gender = serializers.CharField(source="division.gender", read_only=True)
    division_display = serializers.CharField(source="division", read_only=True)

    game_type_display = serializers.CharField(source="get_game_type_display", read_only=True)

    class Meta:
        model = Game
        fields = [
            "id",
            "game_type",
            "game_type_display",
            "division",
            "division_name",
            "division_gender",
            "division_display",
            "date",
            "time",
            "venue",
            "venue_name",
            "lat",
            "lng",
            "home_team",
            "home_team_name",
            "away_team",
            "away_team_name",
        ]


class RefereeAssignmentSerializer(serializers.ModelSerializer):
    referee_name = serializers.CharField(source="referee.user.get_full_name", read_only=True)
    referee_bipin = serializers.CharField(source="referee.user.bipin_number", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = RefereeAssignment
        fields = [
            "id",
            "game",
            "referee",
            "referee_name",
            "referee_bipin",
            "role",
            "role_display",
        ]