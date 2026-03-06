import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Event


def _json_error(message: str, status: int) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


def _event_to_dict(event: Event) -> dict:
    return {
        "id": event.id,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat(),
        "venue_id": event.venue_id,
        "venue_name": event.venue.name if event.venue else None,
        "description": event.description,
        "fee_per_game": str(event.fee_per_game) if event.fee_per_game else None,
        "contact_information": event.contact_information,
        "referees_required": event.referees_required,
    }


# List all events (GET)
def list_events(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    events = Event.objects.select_related('venue').all()
    data = [_event_to_dict(e) for e in events]
    return JsonResponse(data, safe=False)


# Get event detail (GET)
def event_detail(request, event_id):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    try:
        event = Event.objects.select_related('venue').get(pk=event_id)
    except Event.DoesNotExist:
        return _json_error("Event not found", 404)
    
    return JsonResponse(_event_to_dict(event))


# List upcoming events (GET)
def upcoming_events(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    from django.utils import timezone
    today = timezone.now().date()
    
    events = Event.objects.select_related('venue').filter(
        end_date__gte=today
    ).order_by('start_date')
    
    data = [_event_to_dict(e) for e in events]
    return JsonResponse(data, safe=False)


# List events by venue (GET)
def events_by_venue(request, venue_id):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    events = Event.objects.select_related('venue').filter(venue_id=venue_id)
    data = [_event_to_dict(e) for e in events]
    return JsonResponse(data, safe=False)


# TODO: Advanced views for later
# create_event
# update_event
# delete_event