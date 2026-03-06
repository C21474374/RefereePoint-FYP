import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Game, RefereeAssignment


def _json_error(message: str, status: int) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


def _game_to_dict(game: Game) -> dict:
    return {
        "id": game.id,
        "game_type": game.game_type,
        "division_id": game.division_id,
        "division_name": str(game.division) if game.division else None,
        "date": game.date.isoformat(),
        "time": game.time.isoformat(),
        "venue_id": game.venue_id,
        "venue_name": game.venue.name if game.venue else None,
        "home_team_id": game.home_team_id,
        "home_team_name": str(game.home_team) if game.home_team else None,
        "away_team_id": game.away_team_id,
        "away_team_name": str(game.away_team) if game.away_team else None,
    }


def _assignment_to_dict(assignment: RefereeAssignment) -> dict:
    return {
        "id": assignment.id,
        "game_id": assignment.game_id,
        "referee_id": assignment.referee_id,
        "referee_name": str(assignment.referee) if assignment.referee else None,
        "role": assignment.role,
    }


# List all games (GET)
def list_games(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    games = Game.objects.select_related(
        'division', 'venue', 'home_team', 'away_team'
    ).all()
    
    # Optional filters
    game_type = request.GET.get('game_type')
    if game_type:
        games = games.filter(game_type=game_type)
    
    date = request.GET.get('date')
    if date:
        games = games.filter(date=date)
    
    venue_id = request.GET.get('venue_id')
    if venue_id:
        games = games.filter(venue_id=venue_id)
    
    data = [_game_to_dict(g) for g in games]
    return JsonResponse(data, safe=False)


# Get game detail (GET)
def game_detail(request, game_id):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    try:
        game = Game.objects.select_related(
            'division', 'venue', 'home_team', 'away_team'
        ).get(pk=game_id)
    except Game.DoesNotExist:
        return _json_error("Game not found", 404)
    
    game_data = _game_to_dict(game)
    
    # Include referee assignments
    assignments = game.referee_assignments.select_related('referee').all()
    game_data['referee_assignments'] = [_assignment_to_dict(a) for a in assignments]
    
    return JsonResponse(game_data)


# List upcoming games (GET)
def upcoming_games(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    from django.utils import timezone
    today = timezone.now().date()
    
    games = Game.objects.select_related(
        'division', 'venue', 'home_team', 'away_team'
    ).filter(date__gte=today).order_by('date', 'time')[:20]
    
    data = [_game_to_dict(g) for g in games]
    return JsonResponse(data, safe=False)


# List games needing referees (GET)
def games_needing_referees(request):
    if request.method != "GET":
        return _json_error("Method not allowed", 405)
    
    from django.utils import timezone
    from django.db.models import Count
    
    today = timezone.now().date()
    
    # Games with less than 3 referee assignments
    games = Game.objects.select_related(
        'division', 'venue', 'home_team', 'away_team'
    ).filter(date__gte=today).annotate(
        ref_count=Count('referee_assignments')
    ).filter(ref_count__lt=3).order_by('date', 'time')
    
    data = [_game_to_dict(g) for g in games]
    return JsonResponse(data, safe=False)


# TODO: Advanced views for later
# create_game
# update_game
# delete_game
# my_games (games assigned to logged-in referee)
# doadmin_create_game
# nladmin_create_game
# past_games

# Views for admin:
# assign_referee_to_game
# remove_referee_from_game