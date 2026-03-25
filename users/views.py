import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import User, RefereeProfile, RefereeAvailability
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .serializers import CurrentUserSerializer

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
        "home_address": user.home_address,
        "home_lat": user.home_lat,
        "home_lon": user.home_lon,
        "is_active": user.is_active,
        "date_joined": user.date_joined.isoformat(),
    }


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
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data)


class UpdateHomeLocationView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user

        home_address = request.data.get("home_address")
        home_lat = request.data.get("home_lat")
        home_lon = request.data.get("home_lon")

        if home_address is not None:
            user.home_address = str(home_address).strip()

        if home_lat in ("", None):
            user.home_lat = None
        elif home_lat is not None:
            try:
                lat_value = float(home_lat)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "home_lat must be a valid number."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if lat_value < -90 or lat_value > 90:
                return Response(
                    {"detail": "home_lat must be between -90 and 90."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.home_lat = lat_value

        if home_lon in ("", None):
            user.home_lon = None
        elif home_lon is not None:
            try:
                lon_value = float(home_lon)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "home_lon must be a valid number."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if lon_value < -180 or lon_value > 180:
                return Response(
                    {"detail": "home_lon must be between -180 and 180."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.home_lon = lon_value

        user.save(update_fields=["home_address", "home_lat", "home_lon"])
        serializer = CurrentUserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)
