import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Club, Division, Team


def _json_error(message: str, status: int) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


def _club_to_dict(club: Club) -> dict:
    return {
        "id": club.id,
        "name": club.name,
    }


def _division_to_dict(division: Division) -> dict:
    return {
        "id": division.id,
        "name": division.name,
        "gender": division.gender,
        "requires_appointed_referees": division.requires_appointed_referees,
        "display": str(division),
    }


def _team_to_dict(team: Team) -> dict:
    return {
        "id": team.id,
        "club_id": team.club_id,
        "club_name": team.club.name,
        "division_id": team.division_id,
        "division_name": str(team.division),
    }


# List all clubs (GET)
def list_clubs(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    clubs = Club.objects.all().order_by('name')
    data = [_club_to_dict(c) for c in clubs]
    return JsonResponse(data, safe=False)


# Get club detail (GET)
def club_detail(request, club_id):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    try:
        club = Club.objects.get(pk=club_id)
    except Club.DoesNotExist:
        return _json_error("Club not found", 404)
    
    return JsonResponse(_club_to_dict(club))


# List all divisions (GET)
def list_divisions(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    divisions = Division.objects.all().order_by('name', 'gender')
    data = [_division_to_dict(d) for d in divisions]
    return JsonResponse(data, safe=False)


# Get division detail (GET)
def division_detail(request, division_id):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    try:
        division = Division.objects.get(pk=division_id)
    except Division.DoesNotExist:
        return _json_error("Division not found", 404)
    
    return JsonResponse(_division_to_dict(division))


# List all teams (GET)
def list_teams(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    teams = Team.objects.select_related('club', 'division').all()
    
    # Optional filter by club
    club_id = request.GET.get('club_id')
    if club_id:
        teams = teams.filter(club_id=club_id)
    
    # Optional filter by division
    division_id = request.GET.get('division_id')
    if division_id:
        teams = teams.filter(division_id=division_id)
    
    data = [_team_to_dict(t) for t in teams]
    return JsonResponse(data, safe=False)


# Get team detail (GET)
def team_detail(request, team_id):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    try:
        team = Team.objects.select_related('club', 'division').get(pk=team_id)
    except Team.DoesNotExist:
        return _json_error("Team not found", 404)
    
    return JsonResponse(_team_to_dict(team))


# TODO: Advanced views for later
# create_club
# update_club
# delete_club
# create_team
# update_team
# delete_team
# teams_by_division:
