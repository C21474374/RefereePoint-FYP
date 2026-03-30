from django.http import JsonResponse
from .models import User, RefereeProfile, RefereeAvailability
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from .serializers import CurrentUserSerializer, RegisterUserSerializer
from .geocoding import geocode_address


def _json_error(message: str, status: int) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


def _user_to_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone_number": user.phone_number,
        "bipin_number": user.bipin_number,
        "account_type": user.account_type,
        "account_type_display": user.get_account_type_display(),
        "is_team_manager": user.is_team_manager,
        "manager_scope": user.manager_scope,
        "manager_scope_display": user.get_manager_scope_display(),
        "managed_team": user.managed_team_id,
        "managed_team_name": str(user.managed_team) if user.managed_team else None,
        "organization_name": user.organization_name,
        "verification_id_number": user.verification_id_number,
        "verification_id_photo": user.verification_id_photo.url if user.verification_id_photo else None,
        "institution_head_phone": user.institution_head_phone,
        "bipin_verified": user.bipin_verified,
        "doa_approved": user.doa_approved,
        "allowed_upload_game_types": sorted(user.get_allowed_upload_game_types()),
        "allowed_upload_event_types": sorted(user.get_allowed_upload_event_types()),
        "home_address": user.home_address,
        "home_lat": user.home_lat,
        "home_lon": user.home_lon,
        "is_active": user.is_active,
        "date_joined": user.date_joined.isoformat(),
    }


def _can_approve_accounts(user: User) -> bool:
    if not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    return (
        user.account_type in {User.AccountType.DOA, User.AccountType.NL}
        and user.doa_approved
    )


def _parse_bool(value, default=None):
    if value is None:
        return default
    if isinstance(value, bool):
        return value

    value_str = str(value).strip().lower()
    if value_str in {"true", "1", "yes", "y", "on"}:
        return True
    if value_str in {"false", "0", "no", "n", "off"}:
        return False
    raise ValueError("Invalid boolean value.")


def _referee_profile_to_dict(profile: RefereeProfile) -> dict:
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "user_name": profile.user.get_full_name(),
        "bipin_number": profile.user.bipin_number,
        "grade": profile.grade,
    }


# List all referees (GET)
def list_referees(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    profiles = RefereeProfile.objects.select_related('user').all()
    data = [_referee_profile_to_dict(p) for p in profiles]
    return JsonResponse(data, safe=False)


# Get referee detail (GET)
def referee_detail(request, referee_id):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    try:
        profile = RefereeProfile.objects.select_related('user').get(pk=referee_id)
    except RefereeProfile.DoesNotExist:
        return _json_error("Referee not found", 404)
    
    return JsonResponse(_referee_profile_to_dict(profile))




# List all users - admin only (GET)
def list_users(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    users = User.objects.all()
    data = [_user_to_dict(u) for u in users]
    return JsonResponse(data, safe=False)


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = CurrentUserSerializer(request.user, context={"request": request})
        return Response(serializer.data)


class RegisterUserView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        response_serializer = CurrentUserSerializer(user, context={"request": request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class PendingAccountApprovalsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _can_approve_accounts(request.user):
            return Response(
                {"detail": "You do not have permission to review pending approvals."},
                status=status.HTTP_403_FORBIDDEN,
            )

        users = User.objects.filter(doa_approved=False).order_by("date_joined")
        serializer = CurrentUserSerializer(users, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ApproveAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id: int):
        if not _can_approve_accounts(request.user):
            return Response(
                {"detail": "You do not have permission to approve accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            target_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            doa_approved = _parse_bool(request.data.get("doa_approved"), default=True)
            bipin_verified = _parse_bool(request.data.get("bipin_verified"), default=None)
        except ValueError:
            return Response(
                {"detail": "Invalid approval flags. Use true/false values."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_user.doa_approved = doa_approved

        if bipin_verified is not None:
            target_user.bipin_verified = bipin_verified
        elif target_user.account_type in {
            User.AccountType.REFEREE,
            User.AccountType.CLUB,
            User.AccountType.DOA,
            User.AccountType.NL,
        }:
            target_user.bipin_verified = True

        target_user.save(update_fields=["doa_approved", "bipin_verified"])

        serializer = CurrentUserSerializer(target_user, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class UpdateHomeLocationView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user
        geocode_warning = None

        home_address = request.data.get("home_address")
        home_lat = request.data.get("home_lat")
        home_lon = request.data.get("home_lon")

        if home_address is not None:
            user.home_address = str(home_address).strip()

        lat_provided = home_lat not in ("", None)
        lon_provided = home_lon not in ("", None)

        if lat_provided != lon_provided:
            return Response(
                {"detail": "home_lat and home_lon must both be provided together."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if lat_provided and lon_provided:
            try:
                lat_value = float(home_lat)
                lon_value = float(home_lon)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "home_lat and home_lon must be valid numbers."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if lat_value < -90 or lat_value > 90:
                return Response(
                    {"detail": "home_lat must be between -90 and 90."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if lon_value < -180 or lon_value > 180:
                return Response(
                    {"detail": "home_lon must be between -180 and 180."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.home_lat = lat_value
            user.home_lon = lon_value
        else:
            if user.home_address:
                geocoded = geocode_address(user.home_address)
                if geocoded:
                    user.home_lat, user.home_lon = geocoded
                else:
                    geocode_warning = (
                        "Address saved, but we could not resolve coordinates. "
                        "Use current location for accurate mileage."
                    )

        user.save(update_fields=["home_address", "home_lat", "home_lon"])
        serializer = CurrentUserSerializer(user, context={"request": request})
        payload = serializer.data
        if geocode_warning:
            payload["geocode_warning"] = geocode_warning
        return Response(payload, status=status.HTTP_200_OK)
