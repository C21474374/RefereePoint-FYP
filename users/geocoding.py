import json
import urllib.error
import urllib.parse
import urllib.request


def geocode_address(address: str):
    query = urllib.parse.quote_plus(address.strip())
    if not query:
        return None

    url = f"https://nominatim.openstreetmap.org/search?format=json&limit=1&q={query}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "RefereePoint/1.0 (home geocoding)",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            body = response.read().decode("utf-8")
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None

    try:
        results = json.loads(body)
    except json.JSONDecodeError:
        return None

    if not results:
        return None

    first = results[0]
    try:
        lat = float(first["lat"])
        lon = float(first["lon"])
    except (KeyError, TypeError, ValueError):
        return None

    return lat, lon
