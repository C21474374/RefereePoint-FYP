# Chatgpt Prompts used to assist the creation of this file:
# Prompt1: Create Django serializers for cover requests including referee and game details.

from rest_framework import serializers
from games.models import CoverRequest
from api.serializers.shared_serializers import RefereeProfileSerializer
from api.serializers.game_serializers import GameSerializer


class CoverRequestSerializer(serializers.ModelSerializer):

    referee = RefereeProfileSerializer(read_only=True)
    accepted_by = RefereeProfileSerializer(read_only=True)
    game = GameSerializer(read_only=True)

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
