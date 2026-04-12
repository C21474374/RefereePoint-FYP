from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from games.models import Game, NonAppointedSlot, RefereeAssignment
from games.serializers import GameSerializer
from users.models import RefereeProfile

from .models import GameReport


def _is_referee_on_game(*, referee_profile_id: int, game_id: int):
    appointed_exists = RefereeAssignment.objects.filter(
        game_id=game_id,
        referee_id=referee_profile_id,
    ).exists()

    non_appointed_exists = NonAppointedSlot.objects.filter(
        game_id=game_id,
        claimed_by_id=referee_profile_id,
        status__in=[
            NonAppointedSlot.Status.CLAIMED,
            NonAppointedSlot.Status.CLOSED,
        ],
    ).exists()

    return appointed_exists or non_appointed_exists


class ReportableGameSerializer(serializers.Serializer):
    game_id = serializers.IntegerField()
    game_details = GameSerializer()
    roles = serializers.ListField(
        child=serializers.CharField(),
    )
    roles_display = serializers.ListField(
        child=serializers.CharField(),
    )
    has_report = serializers.BooleanField()
    report_id = serializers.IntegerField(allow_null=True)
    report_status = serializers.CharField(allow_null=True)
    report_status_display = serializers.CharField(allow_null=True)
    report_submitted_at = serializers.DateTimeField(allow_null=True)


class GameReportSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    game_details = GameSerializer(source="game", read_only=True)
    referee_name = serializers.CharField(
        source="referee.user.get_full_name",
        read_only=True,
    )
    referee_grade = serializers.CharField(
        source="referee.get_grade_display",
        read_only=True,
    )
    submitted_by_name = serializers.CharField(
        source="submitted_by.get_full_name",
        read_only=True,
    )
    reviewed_by_name = serializers.CharField(
        source="reviewed_by.get_full_name",
        read_only=True,
    )

    class Meta:
        model = GameReport
        fields = [
            "id",
            "game",
            "game_details",
            "referee",
            "referee_name",
            "referee_grade",
            "submitted_by",
            "submitted_by_name",
            "match_no",
            "incident_time",
            "people_involved_no_1",
            "people_involved_name_1",
            "people_involved_no_2",
            "people_involved_name_2",
            "people_involved_other",
            "incident_details",
            "action_taken",
            "signed_by",
            "signed_date",
            "status",
            "status_display",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "referee",
            "submitted_by",
            "submitted_by_name",
            "status",
            "status_display",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "created_at",
            "updated_at",
            "game_details",
        ]


class GameReportCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameReport
        fields = [
            "game",
            "match_no",
            "incident_time",
            "people_involved_no_1",
            "people_involved_name_1",
            "people_involved_no_2",
            "people_involved_name_2",
            "people_involved_other",
            "incident_details",
            "action_taken",
            "signed_by",
            "signed_date",
        ]

    def validate_game(self, value: Game):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication is required.")

        referee_profile = RefereeProfile.objects.filter(user=request.user).first()
        if not referee_profile:
            raise serializers.ValidationError("Only referees can submit reports.")

        today = timezone.localdate()
        earliest_allowed = today - timedelta(days=7)

        if value.date > today:
            raise serializers.ValidationError(
                "Reports can only be submitted for games that already took place."
            )

        if value.date < earliest_allowed:
            raise serializers.ValidationError(
                "Reports can only be submitted within 7 days of the game date."
            )

        if not _is_referee_on_game(
            referee_profile_id=referee_profile.id,
            game_id=value.id,
        ):
            raise serializers.ValidationError(
                "You can only report games where you were assigned."
            )

        if GameReport.objects.filter(
            game=value,
            referee=referee_profile,
        ).exists():
            raise serializers.ValidationError(
                "You have already submitted a report for this game."
            )

        self.context["referee_profile"] = referee_profile
        return value

    def create(self, validated_data):
        request = self.context["request"]
        referee_profile = self.context["referee_profile"]

        signed_by = (validated_data.get("signed_by") or "").strip()
        if not signed_by:
            full_name = request.user.get_full_name().strip()
            validated_data["signed_by"] = full_name or request.user.email

        if not validated_data.get("signed_date"):
            validated_data["signed_date"] = timezone.localdate()

        return GameReport.objects.create(
            referee=referee_profile,
            submitted_by=request.user,
            status=GameReport.Status.PENDING,
            **validated_data,
        )
