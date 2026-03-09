import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import User, RefereeProfile, RefereeAvailability


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


# Get current user info (GET) - requires authentication
def current_user(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    if not request.user.is_authenticated:
        return _json_error("Not authenticated", 401)
    
    return JsonResponse(_user_to_dict(request.user))


# List all users - admin only (GET)
def list_users(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    users = User.objects.all()
    data = [_user_to_dict(u) for u in users]
    return JsonResponse(data, safe=False)


# TODO: Advanced views for later
# register_user
# login_user or token login view
# logout_user
# update_user_profile
# update_referee_profile
# change_user_role (admin)
# activate_deactivate_user (admin)

# Referee availability views:
# list_my_availability
# create_availability
# update_availability
# delete_availability