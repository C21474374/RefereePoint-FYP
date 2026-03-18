from rest_framework import serializers
from .models import User, RefereeProfile


class RefereeProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = RefereeProfile
        fields = ['id', 'grade']


class CurrentUserSerializer(serializers.ModelSerializer):
    referee_profile = RefereeProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'phone_number',
            'bipin_number',
            'referee_profile',
        ]