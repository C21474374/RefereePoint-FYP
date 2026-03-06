import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import CoverRequest


def _json_error(message: str, status: int) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


def _cover_request_to_dict(cr: CoverRequest) -> dict:
    return {
        "id": cr.id,
        "game_id": cr.game_id,
        "game_info": str(cr.game) if cr.game else None,
        "requested_by_id": cr.requested_by_id,
        "requested_by_email": cr.requested_by.email if cr.requested_by else None,
        "request_type": cr.request_type,
        "referee_slot_id": cr.referee_slot_id,
        "status": cr.status,
        "approver_id": cr.approver_id,
        "approver_email": cr.approver.email if cr.approver else None,
        "reason": cr.reason,
        "custom_fee": str(cr.custom_fee) if cr.custom_fee else None,
        "created_at": cr.created_at.isoformat(),
        "updated_at": cr.updated_at.isoformat(),
    }


# List all cover requests (GET)
def list_cover_requests(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    cover_requests = CoverRequest.objects.select_related(
        'game', 'requested_by', 'approver'
    ).all()
    
    # Optional filter by status
    status = request.GET.get('status')
    if status:
        cover_requests = cover_requests.filter(status=status)
    
    data = [_cover_request_to_dict(cr) for cr in cover_requests]
    return JsonResponse(data, safe=False)


# Get cover request detail (GET)
def cover_request_detail(request, cover_request_id):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    try:
        cr = CoverRequest.objects.select_related(
            'game', 'requested_by', 'approver', 'referee_slot'
        ).get(pk=cover_request_id)
    except CoverRequest.DoesNotExist:
        return _json_error("Cover request not found", 404)
    
    return JsonResponse(_cover_request_to_dict(cr))


# List cover requests for current user (GET)
def my_cover_requests(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    if not request.user.is_authenticated:
        return _json_error("Not authenticated", 401)
    
    cover_requests = CoverRequest.objects.select_related(
        'game', 'requested_by', 'approver'
    ).filter(requested_by=request.user)
    
    data = [_cover_request_to_dict(cr) for cr in cover_requests]
    return JsonResponse(data, safe=False)


# List pending cover requests (GET)
def pending_cover_requests(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    cover_requests = CoverRequest.objects.select_related(
        'game', 'requested_by', 'approver'
    ).filter(status__in=['PENDING_COVER', 'PENDING_APPROVAL'])
    
    data = [_cover_request_to_dict(cr) for cr in cover_requests]
    return JsonResponse(data, safe=False)


# TODO: Advanced views for later
# create_cover_request
# update_cover_request_status
# delete_cover_request
# accept_cover_request
# approve_cover_request (admin)
# reject_cover_request (admin)