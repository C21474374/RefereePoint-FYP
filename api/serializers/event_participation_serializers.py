# Chatgpt Prompts used to assist the creation of this file:
# Prompt1: Create Django serializers for event participation including referee details.

from rest_framework import serializers
from games.models import EventParticipation
from api.serializers.shared_serializers import RefereeProfileSerializer


class EventParticipationSerializer(serializers.ModelSerializer):
    referee = RefereeProfileSerializer(read_only=True)

    class Meta:
        model = EventParticipation
        fields = ["id", "referee", "status", "joined_at"]
