"""Serializers for cover request reads and creation validation."""

from rest_framework import serializers

from .models import CoverRequest
from games.serializers import GameSerializer, RefereeAssignmentSerializer
from users.models import RefereeProfile


class CoverRequestSerializer(serializers.ModelSerializer):
    """Read serializer with expanded game/assignment/referee display fields."""
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    requested_by_name = serializers.CharField(
        source="requested_by.get_full_name",
        read_only=True
    )
    approver_name = serializers.CharField(
        source="approver.get_full_name",
        read_only=True
    )

    replaced_by_name = serializers.CharField(
        source="replaced_by.user.get_full_name",
        read_only=True
    )
    replaced_by_grade = serializers.CharField(
        source="replaced_by.grade",
        read_only=True
    )

    game_details = GameSerializer(source="game", read_only=True)
    referee_slot_details = RefereeAssignmentSerializer(
        source="referee_slot",
        read_only=True
    )

    role = serializers.CharField(source="referee_slot.role", read_only=True)
    role_display = serializers.CharField(
        source="referee_slot.get_role_display",
        read_only=True
    )

    original_referee_id = serializers.IntegerField(
        source="original_referee.id",
        read_only=True
    )
    original_referee_name = serializers.CharField(
        source="original_referee.user.get_full_name",
        read_only=True
    )
    original_referee_grade = serializers.CharField(
        source="original_referee.grade",
        read_only=True
    )

    class Meta:
        model = CoverRequest
        fields = [
            "id",
            "game",
            "game_details",
            "requested_by",
            "requested_by_name",
            "referee_slot",
            "referee_slot_details",
            "role",
            "role_display",
            "original_referee",
            "original_referee_id",
            "original_referee_name",
            "original_referee_grade",
            "replaced_by",
            "replaced_by_name",
            "replaced_by_grade",
            "status",
            "status_display",
            "approver",
            "approver_name",
            "reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "created_at",
            "updated_at",
            "status_display",
            "requested_by_name",
            "approver_name",
            "replaced_by_name",
            "replaced_by_grade",
            "game_details",
            "referee_slot_details",
            "role",
            "role_display",
            "original_referee",
            "original_referee_id",
            "original_referee_name",
            "original_referee_grade",
        ]


class CoverRequestCreateSerializer(serializers.ModelSerializer):
    """Write serializer for requesting cover on an owned assignment."""
    class Meta:
        model = CoverRequest
        fields = [
            "game",
            "referee_slot",
            "reason",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        referee_slot = attrs.get("referee_slot")
        game = attrs.get("game")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication is required.")

        if not RefereeProfile.objects.filter(user=request.user).exists():
            raise serializers.ValidationError("Only referees can create cover requests.")

        if referee_slot.game_id != game.id:
            raise serializers.ValidationError(
                {"referee_slot": "This assignment does not belong to the selected game."}
            )

        if referee_slot.referee.user_id != request.user.id:
            raise serializers.ValidationError(
                {
                    "referee_slot": (
                        "You can only create a cover request for your own assignment."
                    )
                }
            )

        existing_open_request = CoverRequest.objects.filter(
            referee_slot=referee_slot,
            status__in=[
                CoverRequest.Status.PENDING,
                CoverRequest.Status.CLAIMED,
            ],
        ).exists()

        if existing_open_request:
            raise serializers.ValidationError(
                {
                    "referee_slot": (
                        "There is already an active cover request for this assignment."
                    )
                }
            )

        return attrs

    def create(self, validated_data):
        request = self.context["request"]

        return CoverRequest.objects.create(
            requested_by=request.user,
            original_referee=validated_data["referee_slot"].referee,
            status=CoverRequest.Status.PENDING,
            **validated_data,
        )
