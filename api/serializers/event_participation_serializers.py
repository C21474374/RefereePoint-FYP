from rest_framework import serializers
from games.models import EventParticipation
from api.serializers.shared_serializers import RefereeProfileSerializer


class EventParticipationSerializer(serializers.ModelSerializer):
    referee = RefereeProfileSerializer(read_only=True)

    class Meta:
        model = EventParticipation
        fields = ["id", "referee", "status", "joined_at"]
