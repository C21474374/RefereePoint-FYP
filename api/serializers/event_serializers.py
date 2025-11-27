from rest_framework import serializers
from games.models import Event
from api.serializers.shared_serializers import UserSerializer


class EventSerializer(serializers.ModelSerializer):

    uploaded_by = UserSerializer(read_only=True)

    class Meta:
        model = Event
        fields = "__all__"
