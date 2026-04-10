from rest_framework import serializers
from .models import Game, NonAppointedSlot, RefereeAssignment
from django.db import transaction
from users.models import User, RefereeProfile
from clubs.models import Division

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


class UploadedGameSlotSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    claimed_by_name = serializers.CharField(source="claimed_by.user.get_full_name", read_only=True)

    class Meta:
        model = NonAppointedSlot
        fields = [
            "id",
            "role",
            "role_display",
            "status",
            "status_display",
            "description",
            "is_active",
            "claimed_by_name",
        ]


class UploadedGameAssignmentSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    referee_name = serializers.CharField(source="referee.user.get_full_name", read_only=True)
    referee_grade = serializers.CharField(source="referee.grade", read_only=True)

    class Meta:
        model = RefereeAssignment
        fields = [
            "id",
            "role",
            "role_display",
            "referee",
            "referee_name",
            "referee_grade",
        ]


class UploadedGameSerializer(GameSerializer):
    uploaded_slots = serializers.SerializerMethodField()
    appointed_assignments = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta(GameSerializer.Meta):
        fields = GameSerializer.Meta.fields + [
            "uploaded_slots",
            "appointed_assignments",
            "can_edit",
            "can_delete",
        ]

    def _uploaded_slots_queryset(self, obj: Game):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return obj.non_appointed_slots.none()
        return obj.non_appointed_slots.filter(posted_by=user)

    def get_uploaded_slots(self, obj: Game):
        slots = self._uploaded_slots_queryset(obj).order_by("role")
        return UploadedGameSlotSerializer(slots, many=True).data

    def get_appointed_assignments(self, obj: Game):
        assignments = obj.referee_assignments.select_related("referee__user").filter(
            role__in=[
                RefereeAssignment.Role.CREW_CHIEF,
                RefereeAssignment.Role.UMPIRE_1,
            ]
        ).order_by("role")
        return UploadedGameAssignmentSerializer(assignments, many=True).data

    def _has_claimed_slots(self, obj: Game) -> bool:
        return self._uploaded_slots_queryset(obj).filter(
            is_active=True,
            status=NonAppointedSlot.Status.CLAIMED,
        ).exists()

    def _has_foreign_slots(self, obj: Game) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return True
        return obj.non_appointed_slots.exclude(posted_by=user).exists()

    def get_can_edit(self, obj: Game) -> bool:
        return (not self._has_claimed_slots(obj)) and (not self._has_foreign_slots(obj))

    def get_can_delete(self, obj: Game) -> bool:
        return (not self._has_claimed_slots(obj)) and (not self._has_foreign_slots(obj))


class RefereeAssignmentSerializer(serializers.ModelSerializer):
    referee_name = serializers.CharField(source="referee.user.get_full_name", read_only=True)
    referee_bipin = serializers.CharField(source="referee.user.bipin_number", read_only=True)
    referee_grade = serializers.CharField(source="referee.grade", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    travel_mode_display = serializers.CharField(source="get_travel_mode_display", read_only=True)

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
            "travel_mode",
            "travel_mode_display",
            "public_transport_fare",
        ]

class NonAppointedSlotCreateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=NonAppointedSlot.Role.choices)

    description = serializers.CharField(required=False, allow_blank=True, default="")
    expires_at = serializers.DateTimeField(required=False, allow_null=True)


class AppointedAssignmentCreateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(
        choices=[
            (RefereeAssignment.Role.CREW_CHIEF, RefereeAssignment.Role.CREW_CHIEF),
            (RefereeAssignment.Role.UMPIRE_1, RefereeAssignment.Role.UMPIRE_1),
        ]
    )
    referee = serializers.PrimaryKeyRelatedField(queryset=RefereeProfile.objects.all())


class NonAppointedGameUploadSerializer(serializers.ModelSerializer):
    slots = NonAppointedSlotCreateSerializer(
        many=True,
        write_only=True,
        required=False,
        default=list,
    )
    appointed_assignments = AppointedAssignmentCreateSerializer(
        many=True,
        write_only=True,
        required=False,
        default=list,
    )

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
            "appointed_assignments",
        ]

    NON_APPOINTED_GAME_TYPES = {
        Game.GameType.CLUB,
        Game.GameType.SCHOOL,
        Game.GameType.COLLEGE,
        Game.GameType.FRIENDLY,
    }

    APPOINTED_GAME_TYPES = {
        Game.GameType.DOA,
        Game.GameType.NL,
    }

    def validate(self, attrs):
        request = self.context.get("request")
        slots = attrs.get("slots", [])
        appointed_assignments = attrs.get("appointed_assignments", [])
        game_type = attrs.get("game_type")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication is required.")

        user: User = request.user

        if not user.is_approved_for_uploads():
            raise serializers.ValidationError(
                "Your account must be manually approved before uploads are enabled."
            )

        allowed_game_types = user.get_allowed_upload_game_types()

        if game_type not in allowed_game_types:
            account_type_display = user.get_account_type_display()
            if user.account_type == User.AccountType.REFEREE:
                raise serializers.ValidationError(
                    "Referee accounts cannot upload games in the new workflow."
                )
            raise serializers.ValidationError(
                (
                    f"{account_type_display} accounts cannot upload this game type. "
                    "Check your account type and approval settings."
                )
            )

        locked_non_appointed_type_by_account = {
            User.AccountType.CLUB: Game.GameType.CLUB,
            User.AccountType.SCHOOL: Game.GameType.SCHOOL,
            User.AccountType.COLLEGE: Game.GameType.COLLEGE,
        }
        locked_type = locked_non_appointed_type_by_account.get(user.account_type)
        if locked_type and game_type != Game.GameType.FRIENDLY:
            attrs["game_type"] = locked_type
            game_type = attrs["game_type"]

        division = attrs.get("division")
        appointed_divisions_configured = Division.objects.filter(
            requires_appointed_referees=True
        ).exists()
        if division:
            requires_appointed = bool(getattr(division, "requires_appointed_referees", False))
            if (
                game_type in self.NON_APPOINTED_GAME_TYPES
                and appointed_divisions_configured
                and requires_appointed
            ):
                raise serializers.ValidationError(
                    {
                        "division": (
                            "This division is appointed-only and cannot be uploaded as a "
                            "non-appointed game."
                        )
                    }
                )
            if (
                game_type in self.APPOINTED_GAME_TYPES
                and appointed_divisions_configured
                and not requires_appointed
            ):
                raise serializers.ValidationError(
                    {
                        "division": (
                            "This division is configured as non-appointed. "
                            "Choose an appointed division for DOA/NL uploads."
                        )
                    }
                )

        if game_type in self.APPOINTED_GAME_TYPES:
            if slots:
                raise serializers.ValidationError(
                    {"slots": "Appointed games do not accept non-appointed referee slots."}
                )

            if attrs.get("payment_type") != Game.PaymentType.CLAIM:
                raise serializers.ValidationError(
                    {"payment_type": "DOA and NL uploads must use Claim payment type."}
                )

            if len(appointed_assignments) > 2:
                raise serializers.ValidationError(
                    {"appointed_assignments": "A maximum of two appointed assignments is allowed."}
                )

            assignment_roles = [item["role"] for item in appointed_assignments]
            if len(set(assignment_roles)) != len(assignment_roles):
                raise serializers.ValidationError(
                    {"appointed_assignments": "Duplicate appointed roles are not allowed."}
                )

            if set(assignment_roles) - {
                RefereeAssignment.Role.CREW_CHIEF,
                RefereeAssignment.Role.UMPIRE_1,
            }:
                raise serializers.ValidationError(
                    {
                        "appointed_assignments": (
                            "Only Crew Chief and Umpire 1 assignments are supported here."
                        )
                    }
                )

            referee_ids = [item["referee"].id for item in appointed_assignments]
            if len(set(referee_ids)) != len(referee_ids):
                raise serializers.ValidationError(
                    {
                        "appointed_assignments": (
                            "The same referee cannot be assigned to multiple roles in one game."
                        )
                    }
                )

            for item in appointed_assignments:
                if (
                    item["role"] == RefereeAssignment.Role.CREW_CHIEF
                    and item["referee"].grade == "INTRO"
                ):
                    raise serializers.ValidationError(
                        {
                            "appointed_assignments": (
                                "Intro referees cannot be assigned as Crew Chief."
                            )
                        }
                    )

            return attrs

        if appointed_assignments:
            raise serializers.ValidationError(
                {
                    "appointed_assignments": (
                        "Appointed assignments can only be provided for DOA/NL uploads."
                    )
                }
            )

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
        slots_data = validated_data.pop("slots", [])
        appointed_assignments = validated_data.pop("appointed_assignments", [])
        request = self.context["request"]
        game_type = validated_data.get("game_type")

        if game_type in self.APPOINTED_GAME_TYPES:
            existing_game = Game.objects.filter(
                home_team=validated_data.get("home_team"),
                away_team=validated_data.get("away_team"),
                venue=validated_data.get("venue"),
                date=validated_data.get("date"),
                time=validated_data.get("time"),
                game_type=validated_data.get("game_type"),
            ).first()

            if existing_game:
                raise serializers.ValidationError(
                    "An appointed game with the same teams, venue, date, and time already exists."
                )

            game = Game.objects.create(
                created_by=request.user,
                status=Game.Status.OPEN,
                **validated_data,
            )

            for assignment in appointed_assignments:
                RefereeAssignment.objects.create(
                    game=game,
                    role=assignment["role"],
                    referee=assignment["referee"],
                )

            return game

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


class NonAppointedGameManageSerializer(NonAppointedGameUploadSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)

        if not self.instance:
            return attrs

        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication is required.")

        foreign_slots = self.instance.non_appointed_slots.exclude(posted_by=request.user)
        if foreign_slots.exists():
            raise serializers.ValidationError(
                {
                    "detail": (
                        "You can only edit uploads where all opportunity slots "
                        "were created by you."
                    )
                }
            )

        claimed_slots = self.instance.non_appointed_slots.filter(
            is_active=True,
            status=NonAppointedSlot.Status.CLAIMED,
        )
        if claimed_slots.exists():
            raise serializers.ValidationError(
                {
                    "detail": (
                        "You cannot edit this game while one or more slots are claimed."
                    )
                }
            )

        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        slots_data = validated_data.pop("slots", [])
        appointed_assignments = validated_data.pop("appointed_assignments", [])
        request = self.context["request"]
        next_game_type = validated_data.get("game_type", instance.game_type)

        for field_name, value in validated_data.items():
            setattr(instance, field_name, value)

        instance.save()

        if next_game_type in self.APPOINTED_GAME_TYPES:
            # If this game was previously non-appointed, remove requester's slot records.
            instance.non_appointed_slots.filter(posted_by=request.user).delete()

            # Only replace assignments when they are explicitly submitted in the payload.
            if "appointed_assignments" in self.initial_data:
                instance.referee_assignments.all().delete()
                for assignment in appointed_assignments:
                    RefereeAssignment.objects.create(
                        game=instance,
                        role=assignment["role"],
                        referee=assignment["referee"],
                    )
            return instance

        # Non-appointed update path keeps slot ownership under the uploader.
        instance.referee_assignments.all().delete()
        instance.non_appointed_slots.filter(posted_by=request.user).delete()

        for slot_data in slots_data:
            NonAppointedSlot.objects.create(
                game=instance,
                posted_by=request.user,
                status=NonAppointedSlot.Status.OPEN,
                is_active=True,
                **slot_data,
            )

        return instance

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
    event_end_date = serializers.DateField(allow_null=True, required=False)
    fee_per_game = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        allow_null=True,
        required=False,
    )
    referees_required = serializers.IntegerField(allow_null=True, required=False)
    joined_referees_count = serializers.IntegerField(allow_null=True, required=False)
    slots_left = serializers.IntegerField(allow_null=True, required=False)

    created_at = serializers.DateTimeField()
