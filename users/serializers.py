from rest_framework import serializers
from .models import User, RefereeProfile
from django.db import transaction


class RefereeProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = RefereeProfile
        fields = ['id', 'grade']


class CurrentUserSerializer(serializers.ModelSerializer):
    referee_profile = RefereeProfileSerializer(read_only=True)
    account_type_display = serializers.CharField(
        source="get_account_type_display",
        read_only=True,
    )
    manager_scope_display = serializers.CharField(
        source="get_manager_scope_display",
        read_only=True,
    )
    managed_team_name = serializers.SerializerMethodField()
    allowed_upload_game_types = serializers.SerializerMethodField()
    allowed_upload_event_types = serializers.SerializerMethodField()
    verification_id_photo = serializers.FileField(read_only=True)

    def get_allowed_upload_game_types(self, obj: User):
        return sorted(obj.get_allowed_upload_game_types())

    def get_allowed_upload_event_types(self, obj: User):
        return sorted(obj.get_allowed_upload_event_types())

    def get_managed_team_name(self, obj: User):
        return str(obj.managed_team) if obj.managed_team else None

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'phone_number',
            'bipin_number',
            'account_type',
            'account_type_display',
            'is_team_manager',
            'manager_scope',
            'manager_scope_display',
            'managed_team',
            'managed_team_name',
            'organization_name',
            'bipin_verified',
            'doa_approved',
            'allowed_upload_game_types',
            'allowed_upload_event_types',
            'verification_id_number',
            'verification_id_photo',
            'institution_head_phone',
            'home_address',
            'home_lat',
            'home_lon',
            'referee_profile',
        ]


class RegisterUserSerializer(serializers.Serializer):
    ACCOUNT_TYPE_CHOICES = User.AccountType.choices

    account_type = serializers.ChoiceField(choices=ACCOUNT_TYPE_CHOICES)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)

    bipin_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    organization_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    verification_id_number = serializers.CharField(max_length=120, required=False, allow_blank=True)
    verification_id_photo = serializers.FileField(required=False, allow_null=True)
    institution_head_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)

    grade = serializers.ChoiceField(
        choices=RefereeProfile.GRADE_CHOICES,
        required=False,
        default="INTRO",
    )

    is_team_manager = serializers.BooleanField(required=False, default=False)
    manager_scope = serializers.ChoiceField(
        choices=User.ManagerScope.choices,
        required=False,
        default=User.ManagerScope.NONE,
    )
    managed_team = serializers.IntegerField(required=False, allow_null=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        account_type = attrs.get("account_type")
        is_team_manager = attrs.get("is_team_manager", False)
        manager_scope = attrs.get("manager_scope", User.ManagerScope.NONE)
        managed_team = attrs.get("managed_team")

        bipin_number = (attrs.get("bipin_number") or "").strip()
        organization_name = (attrs.get("organization_name") or "").strip()
        verification_id_photo = attrs.get("verification_id_photo")
        institution_head_phone = (attrs.get("institution_head_phone") or "").strip()

        if verification_id_photo:
            content_type = getattr(verification_id_photo, "content_type", "") or ""
            if content_type and not content_type.startswith("image/"):
                raise serializers.ValidationError(
                    {"verification_id_photo": "Photo ID must be an image file."}
                )
            if verification_id_photo.size > 10 * 1024 * 1024:
                raise serializers.ValidationError(
                    {"verification_id_photo": "Photo ID must be smaller than 10MB."}
                )

        if account_type == User.AccountType.CLUB:
            if not bipin_number:
                raise serializers.ValidationError(
                    {"bipin_number": "Club registration requires a BIPIN number."}
                )

        if account_type in {User.AccountType.SCHOOL, User.AccountType.COLLEGE}:
            if not organization_name:
                raise serializers.ValidationError(
                    {"organization_name": "School/College name is required."}
                )
            if not verification_id_photo:
                raise serializers.ValidationError(
                    {"verification_id_photo": "Photo ID is required for school/college verification."}
                )
            if not institution_head_phone:
                raise serializers.ValidationError(
                    {"institution_head_phone": "Principal/Head contact number is required."}
                )

        if account_type == User.AccountType.REFEREE and not bipin_number:
            raise serializers.ValidationError(
                {"bipin_number": "Referee registration requires a BIPIN number."}
            )

        if is_team_manager:
            if account_type != User.AccountType.REFEREE:
                raise serializers.ValidationError(
                    {"is_team_manager": "Only referee registrations can also add manager role."}
                )
            if manager_scope == User.ManagerScope.NONE:
                raise serializers.ValidationError(
                    {"manager_scope": "Please select manager scope if also registering as manager."}
                )
            if managed_team in (None, ""):
                raise serializers.ValidationError(
                    {"managed_team": "Please select your managed team."}
                )
        else:
            attrs["manager_scope"] = User.ManagerScope.NONE
            attrs["managed_team"] = None

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        from clubs.models import Team

        managed_team_id = validated_data.pop("managed_team", None)
        grade = validated_data.pop("grade", "INTRO")
        account_type = validated_data.get("account_type", User.AccountType.REFEREE)

        managed_team = None
        if managed_team_id is not None:
            managed_team = Team.objects.filter(id=managed_team_id).first()
            if managed_team is None:
                raise serializers.ValidationError(
                    {"managed_team": "Selected team does not exist."}
                )

        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            phone_number=validated_data.get("phone_number") or None,
            bipin_number=(validated_data.get("bipin_number") or "").strip() or None,
            account_type=account_type,
            is_team_manager=validated_data.get("is_team_manager", False),
            manager_scope=validated_data.get("manager_scope", User.ManagerScope.NONE),
            managed_team=managed_team,
            organization_name=(validated_data.get("organization_name") or "").strip(),
            verification_id_number=(validated_data.get("verification_id_number") or "").strip(),
            verification_id_photo=validated_data.get("verification_id_photo"),
            institution_head_phone=(validated_data.get("institution_head_phone") or "").strip(),
            bipin_verified=False,
            doa_approved=False,
        )

        if account_type == User.AccountType.REFEREE:
            RefereeProfile.objects.create(
                user=user,
                grade=grade,
            )

        return user
