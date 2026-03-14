import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import connection
from .models import Venue

VENUE_NOT_FOUND_ERROR = "Venue not found"
METHOD_NOT_ALLOWED_ERROR = "Method not allowed"


def _venue_to_dict(venue: Venue) -> dict:
    return {
        "id": venue.id,
        "name": venue.name,
        "address": venue.address,
        "lat": venue.lat,
        "lon": venue.lon,
    }


def _json_error(message: str, status: int) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


def _json_message(message: str, status: int = 200, extra: dict | None = None) -> JsonResponse:
    payload = {"message": message}
    if extra:
        payload.update(extra)
    return JsonResponse(payload, status=status)


def _parse_json_body(request):
    """
    Returns (data, error_response). If error_response is not None, return it.
    """
    try:
        if not request.body:
            return None, _json_error("Missing JSON body", 400)
        return json.loads(request.body.decode("utf-8")), None
    except json.JSONDecodeError:
        return None, _json_error("Invalid JSON", 400)


# List all venues (GET)
def list_venues(request):
    if request.method != "GET":
        return _json_error(METHOD_NOT_ALLOWED_ERROR, 405)

    venues = Venue.objects.all()
    data = [_venue_to_dict(v) for v in venues]
    return JsonResponse(data, safe=False, status=200)


# Get one venue by id (GET)
def get_venue(request, venue_id):
    if request.method != "GET":
        return _json_error(METHOD_NOT_ALLOWED_ERROR, 405)

    try:
        venue = Venue.objects.get(pk=venue_id)
    except Venue.DoesNotExist:
        return _json_error(VENUE_NOT_FOUND_ERROR, 404)

    return JsonResponse(_venue_to_dict(venue), status=200)


# Search venue by name (GET)
def search_venues(request):
    if request.method != "GET":
        return _json_error(METHOD_NOT_ALLOWED_ERROR, 405)

    name = request.GET.get("name", "").strip()
    if not name:
        return _json_error("Missing query param: name", 400)

    venues = Venue.objects.filter(name__icontains=name)
    data = [_venue_to_dict(v) for v in venues]
    return JsonResponse(data, safe=False, status=200)


# Create new venue (POST)
@csrf_exempt
def create_venue(request):
    if request.method != "POST":
        return _json_error(METHOD_NOT_ALLOWED_ERROR, 405)

    body, err = _parse_json_body(request)
    if err:
        return err

    # Basic validation
    for field in ("name", "lat", "lon"):
        if field not in body:
            return _json_error(f"Missing field: {field}", 400)

    venue = Venue.objects.create(
        name=str(body["name"]).strip(),
        lat=body["lat"],
        lon=body["lon"],
    )

    return JsonResponse(
        {"message": "Venue created", "venue": _venue_to_dict(venue)},
        status=201
    )


# Update venue (PUT)
@csrf_exempt
def update_venue(request, venue_id):
    if request.method != "PUT":
        return _json_error(METHOD_NOT_ALLOWED_ERROR, 405)

    try:
        venue = Venue.objects.get(pk=venue_id)
    except Venue.DoesNotExist:
        return _json_error(VENUE_NOT_FOUND_ERROR, 404)

    body, err = _parse_json_body(request)
    if err:
        return err

    # Allow partial updates (only update what was sent)
    if "name" in body:
        venue.name = str(body["name"]).strip()
    if "lat" in body:
        venue.lat = body["lat"]
    if "lon" in body:
        venue.lon = body["lon"]

    venue.save()

    return JsonResponse(
        {"message": "Venue updated", "venue": _venue_to_dict(venue)},
        status=200
    )


# Delete venue (DELETE)
@csrf_exempt
def delete_venue(request, venue_id):
    if request.method != "DELETE":
        return _json_error(METHOD_NOT_ALLOWED_ERROR, 405)

    try:
        venue = Venue.objects.get(pk=venue_id)
    except Venue.DoesNotExist:
        return _json_error(VENUE_NOT_FOUND_ERROR, 404)

    venue.delete()
    return _json_message("Venue deleted", status=200)


# List nearby venues (GET)
# Params: lat, lon, radius_km (optional, default 10)
def nearby_venues(request):
    if request.method != "GET":
        return _json_error(METHOD_NOT_ALLOWED_ERROR, 405)

    try:
        user_lat = float(request.GET.get("lat", ""))
        user_lon = float(request.GET.get("lon", ""))
    except (ValueError, TypeError):
        return _json_error("Missing or invalid lat/lon params", 400)

    try:
        radius_km = float(request.GET.get("radius_km", 10))
    except ValueError:
        radius_km = 10

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT fid, name, address, lat, lon,
                   ST_Distance(
                       geom::geography,
                       ST_SetSRID(ST_Point(%s, %s), 4326)::geography
                   ) / 1000 AS distance_km
            FROM venues_venue
            WHERE ST_DWithin(
                geom::geography,
                ST_SetSRID(ST_Point(%s, %s), 4326)::geography,
                %s
            )
            ORDER BY distance_km
        """, [user_lon, user_lat, user_lon, user_lat, radius_km * 1000])
        
        rows = cursor.fetchall()
    
    data = [
        {
            "id": row[0],
            "name": row[1],
            "address": row[2],
            "lat": row[3],
            "lon": row[4],
            "distance_km": round(row[5], 2) if row[5] else None
        }
        for row in rows
    ]
    return JsonResponse(data, safe=False, status=200)