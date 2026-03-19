from rest_framework import serializers
from .models import Game, NonAppointedSlot, RefereeAssignment
from django.db import transaction
from users.models import RefereeProfile

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
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_type_display = serializers.CharField(source="get_payment_type_display", read_only=True)

    assigned_roles_count = serializers.IntegerField(read_only=True)
    open_non_appointed_slots_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Game
        fields = [
            "id",
            "game_type",
            "game_type_display",
            "status",
            "status_display",
            "payment_type",
            "payment_type_display",
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
            "notes",
            "original_post_text",
            "created_by",
            "assigned_roles_count",
            "open_non_appointed_slots_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "created_at",
            "updated_at",
            "assigned_roles_count",
            "open_non_appointed_slots_count",
        ]


class NonAppointedSlotSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    posted_by_name = serializers.CharField(source="posted_by.get_full_name", read_only=True)
    claimed_by_name = serializers.CharField(source="claimed_by.user.get_full_name", read_only=True)
    claimed_by_grade = serializers.CharField(source="claimed_by.grade", read_only=True)

    game_details = GameSerializer(source="game", read_only=True)

    class Meta:
        model = NonAppointedSlot
        fields = [
            "id",
            "game",
            "game_details",
            "role",
            "role_display",
            "status",
            "status_display",
            "posted_by",
            "posted_by_name",
            "claimed_by",
            "claimed_by_name",
            "claimed_by_grade",
            "description",
            "is_active",
            "claimed_at",
            "expires_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "claimed_at",
            "created_at",
            "updated_at",
        ]


class RefereeAssignmentSerializer(serializers.ModelSerializer):
    referee_name = serializers.CharField(source="referee.user.get_full_name", read_only=True)
    referee_bipin = serializers.CharField(source="referee.user.bipin_number", read_only=True)
    referee_grade = serializers.CharField(source="referee.grade", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    game_details = GameSerializer(source="game", read_only=True)

    class Meta:
        model = RefereeAssignment
        fields = [
            "id",
            "game",
            "game_details",
            "referee",
            "referee_name",
            "referee_bipin",
            "referee_grade",
            "role",
            "role_display",
        ]

class NonAppointedSlotCreateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=NonAppointedSlot.Role.choices)

    description = serializers.CharField(required=False, allow_blank=True, default="")
    expires_at = serializers.DateTimeField(required=False, allow_null=True)


class NonAppointedGameUploadSerializer(serializers.ModelSerializer):
    slots = NonAppointedSlotCreateSerializer(many=True, write_only=True)

    class Meta:
        model = Game
        fields = [
            "id",
            "game_type",
            "payment_type",
            "division",
            "date",
            "time",
            "venue",
            "home_team",
            "away_team",
            "notes",
            "original_post_text",
            "slots",
        ]

    def validate_game_type(self, value):
        if value in {Game.GameType.DOA, Game.GameType.NL}:
            raise serializers.ValidationError(
                "Referees cannot upload DOA or National League games."
            )
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        slots = attrs.get("slots", [])

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication is required.")

        if not RefereeProfile.objects.filter(user=request.user).exists():
            raise serializers.ValidationError("Only referees can upload games.")

        if not slots:
            raise serializers.ValidationError(
                {"slots": "At least one slot is required."}
            )

        if len(slots) > 2:
            raise serializers.ValidationError(
                {"slots": "A non-appointed game can have a maximum of 2 slots."}
            )

        roles = [slot["role"] for slot in slots]

        if len(set(roles)) != len(roles):
            raise serializers.ValidationError(
                {"slots": "Duplicate slot roles are not allowed."}
            )

        # valid upload combinations:
        # - [CREW_CHIEF]   -> home team requesting
        # - [UMPIRE_1]     -> away team requesting
        # - [CREW_CHIEF, UMPIRE_1] -> both needed
        valid_role_sets = [
            {NonAppointedSlot.Role.CREW_CHIEF},
            {NonAppointedSlot.Role.UMPIRE_1},
            {NonAppointedSlot.Role.CREW_CHIEF, NonAppointedSlot.Role.UMPIRE_1},
        ]

        if set(roles) not in valid_role_sets:
            raise serializers.ValidationError(
                {
                    "slots": (
                        "Valid slot combinations are: Crew Chief only, "
                        "Umpire 1 only, or both Crew Chief and Umpire 1."
                    )
                }
            )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        slots_data = validated_data.pop("slots")
        request = self.context["request"]

        matching_game = Game.objects.filter(
            home_team=validated_data.get("home_team"),
            away_team=validated_data.get("away_team"),
            venue=validated_data.get("venue"),
            date=validated_data.get("date"),
            time=validated_data.get("time"),
            game_type=validated_data.get("game_type"),
        ).first()

        if matching_game:
            game = matching_game

            existing_roles = set(
                game.non_appointed_slots.filter(
                    is_active=True,
                    status__in=[
                        NonAppointedSlot.Status.OPEN,
                        NonAppointedSlot.Status.CLAIMED,
                    ],
                ).values_list("role", flat=True)
            )

            requested_roles = [slot_data["role"] for slot_data in slots_data]

            duplicate_roles = [role for role in requested_roles if role in existing_roles]
            if duplicate_roles:
                role_labels = []
                for role in duplicate_roles:
                    if role == NonAppointedSlot.Role.CREW_CHIEF:
                        role_labels.append("Home team referee request already exists")
                    elif role == NonAppointedSlot.Role.UMPIRE_1:
                        role_labels.append("Away team referee request already exists")
                    else:
                        role_labels.append(f"{role} already exists")

                raise serializers.ValidationError(
                    {"slots": ". ".join(role_labels) + "."}
                )

            for slot_data in slots_data:
                NonAppointedSlot.objects.create(
                    game=game,
                    posted_by=request.user,
                    status=NonAppointedSlot.Status.OPEN,
                    is_active=True,
                    **slot_data,
                )

            return game

        game = Game.objects.create(
            created_by=request.user,
            status=Game.Status.OPEN,
            **validated_data,
        )

        for slot_data in slots_data:
            NonAppointedSlot.objects.create(
                game=game,
                posted_by=request.user,
                status=NonAppointedSlot.Status.OPEN,
                is_active=True,
                **slot_data,
            )

        return game

class OpportunityFeedItemSerializer(serializers.Serializer):
    type = serializers.CharField()
    id = serializers.IntegerField()

    game_id = serializers.IntegerField()
    game_type = serializers.CharField()
    game_type_display = serializers.CharField()

    date = serializers.DateField()
    time = serializers.TimeField()

    venue_id = serializers.IntegerField(allow_null=True)
    venue_name = serializers.CharField(allow_null=True)
    lat = serializers.FloatField(allow_null=True)
    lng = serializers.FloatField(allow_null=True)

    home_team_name = serializers.CharField(allow_null=True)
    away_team_name = serializers.CharField(allow_null=True)

    division_name = serializers.CharField(allow_null=True)
    division_gender = serializers.CharField(allow_null=True)

    payment_type = serializers.CharField(allow_null=True)
    payment_type_display = serializers.CharField(allow_null=True)

    role = serializers.CharField(allow_null=True)
    role_display = serializers.CharField(allow_null=True)

    status = serializers.CharField()
    status_display = serializers.CharField()

    posted_by_name = serializers.CharField(allow_null=True, required=False)
    claimed_by_name = serializers.CharField(allow_null=True, required=False)

    requested_by_name = serializers.CharField(allow_null=True, required=False)
    original_referee_name = serializers.CharField(allow_null=True, required=False)
    replaced_by_name = serializers.CharField(allow_null=True, required=False)

    description = serializers.CharField(allow_blank=True, required=False)
    reason = serializers.CharField(allow_blank=True, required=False)
    custom_fee = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        allow_null=True,
        required=False,
    )

    created_at = serializers.DateTimeField()