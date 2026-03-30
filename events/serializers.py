from rest_framework import serializers

from .models import Event


class EventRefereeSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="referee.id")
    user_id = serializers.IntegerField(source="referee.user.id")
    name = serializers.CharField(source="referee.user.get_full_name")
    grade = serializers.CharField(source="referee.grade")


class EventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source="get_event_type_display", read_only=True)
    venue_name = serializers.CharField(source="venue.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    joined_referees_count = serializers.SerializerMethodField()
    slots_left = serializers.SerializerMethodField()
    current_user_joined = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()
    joined_referees = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id",
            "event_type",
            "event_type_display",
            "start_date",
            "end_date",
            "venue",
            "venue_name",
            "created_by",
            "created_by_name",
            "description",
            "fee_per_game",
            "contact_information",
            "referees_required",
            "joined_referees_count",
            "slots_left",
            "current_user_joined",
            "can_manage",
            "joined_referees",
        ]

    def get_joined_referees_count(self, obj: Event) -> int:
        return obj.referee_assignments.count()

    def get_slots_left(self, obj: Event):
        if obj.referees_required <= 0:
            return None
        return max(obj.referees_required - obj.referee_assignments.count(), 0)

    def get_current_user_joined(self, obj: Event) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        if not hasattr(request.user, "referee_profile"):
            return False

        return obj.referee_assignments.filter(
            referee=request.user.referee_profile
        ).exists()

    def get_joined_referees(self, obj: Event):
        assignments = obj.referee_assignments.select_related("referee__user")
        return EventRefereeSerializer(assignments, many=True).data

    def get_can_manage(self, obj: Event) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return request.user.is_staff or obj.created_by_id == request.user.id


class EventCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = [
            "start_date",
            "end_date",
            "venue",
            "description",
            "fee_per_game",
            "contact_information",
            "referees_required",
        ]

    def validate(self, attrs):
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")

        if self.instance:
            if start_date is None:
                start_date = self.instance.start_date
            if end_date is None:
                end_date = self.instance.end_date

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "End date cannot be before start date."}
            )

        fee_per_game = attrs.get("fee_per_game")
        if fee_per_game is not None and fee_per_game < 0:
            raise serializers.ValidationError(
                {"fee_per_game": "Fee per game cannot be negative."}
            )

        referees_required = attrs.get("referees_required")
        if referees_required is not None and referees_required < 0:
            raise serializers.ValidationError(
                {"referees_required": "Referees required cannot be negative."}
            )

        return attrs
