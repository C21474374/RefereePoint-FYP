from rest_framework import serializers
from games.models import Event, EventParticipation
from api.serializers.shared_serializers import UserSerializer
from api.serializers.event_participation_serializers import EventParticipationSerializer


class EventSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)

    # ADD THIS LINE
    participants = EventParticipationSerializer(many=True, read_only=True)

    class Meta:
        model = Event
        fields = "__all__"
