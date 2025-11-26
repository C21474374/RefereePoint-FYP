from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import models
from django.utils.timezone import now

from games.models import Game, CoverRequest, Event
from users.models import RefereeProfile
from .serializers import GameSerializer, CoverRequestSerializer, EventSerializer




class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all().order_by('start_date')
    serializer_class = EventSerializer

    # Optional: auto-assign uploaded_by (no auth now, but ready for later)
    def perform_create(self, serializer):
        serializer.save(uploaded_by=None)

class GameViewSet(viewsets.ModelViewSet):
    queryset = Game.objects.all().order_by('date', 'time')
    serializer_class = GameSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        # Filter by category
        category_id = request.query_params.get('category')
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        # Filter by competition
        competition_id = request.query_params.get('competition')
        if competition_id:
            queryset = queryset.filter(competition_id=competition_id)

        # Filter by date
        date = request.query_params.get('date')
        if date:
            queryset = queryset.filter(date=date)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


    # -------------------------
    # UPCOMING GAMES
    # -------------------------
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        today = now().date()

        games = Game.objects.filter(date__gte=today).order_by('date', 'time')

        return Response(GameSerializer(games, many=True).data)

    @action(detail=False, methods=['get'])
    def my_upcoming(self, request):
        referee_id = request.query_params.get('referee_id')

        if not referee_id:
            return Response({"error": "referee_id is required"}, status=400)

        try:
            referee = RefereeProfile.objects.get(id=referee_id)
        except RefereeProfile.DoesNotExist:
            return Response({"error": "Referee not found"}, status=404)

        today = now().date()

        games = Game.objects.filter(
            (
                models.Q(crew_chief=referee) |
                models.Q(umpire1=referee) |
                models.Q(umpire2=referee)
            ) &
            models.Q(date__gte=today)
        ).order_by('date', 'time')

        return Response(GameSerializer(games, many=True).data)


    # -------------------------
    # PAST GAMES
    # -------------------------
    @action(detail=False, methods=['get'])
    def past(self, request):
        today = now().date()

        games = Game.objects.filter(date__lt=today).order_by('-date', '-time')

        return Response(GameSerializer(games, many=True).data)

    @action(detail=False, methods=['get'])
    def my_past(self, request):
        referee_id = request.query_params.get('referee_id')

        if not referee_id:
            return Response({"error": "referee_id is required"}, status=400)

        try:
            referee = RefereeProfile.objects.get(id=referee_id)
        except RefereeProfile.DoesNotExist:
            return Response({"error": "Referee not found"}, status=404)

        today = now().date()

        games = Game.objects.filter(
            (
                models.Q(crew_chief=referee) |
                models.Q(umpire1=referee) |
                models.Q(umpire2=referee)
            ) &
            models.Q(date__lt=today)
        ).order_by('-date', '-time')

        return Response(GameSerializer(games, many=True).data)


    # -------------------------
    # TAKE GAME (assign referee)
    # -------------------------
    @action(detail=True, methods=['post'])
    def take(self, request, pk=None):
        game = self.get_object()
        referee_id = request.data.get('referee_id')

        if not referee_id:
            return Response({"error": "referee_id required"}, status=400)

        try:
            referee = RefereeProfile.objects.get(id=referee_id)
        except RefereeProfile.DoesNotExist:
            return Response({"error": "Referee not found"}, status=404)

        # Prevent duplicate assignment
        if referee in [game.crew_chief, game.umpire1, game.umpire2]:
            return Response(
                {"error": "Referee is already assigned to this game."},
                status=400
            )

        # Assign referee to first free slot
        if game.crew_chief is None:
            game.crew_chief = referee
        elif game.umpire1 is None:
            game.umpire1 = referee
        elif game.umpire2 is None:
            game.umpire2 = referee
        else:
            return Response({"error": "All referee slots are filled"}, status=400)

        game.save()
        return Response(GameSerializer(game).data)

    # -------------------------
    # CANCEL REFEREE
    # -------------------------
    @action(detail=True, methods=['post'])
    def cancel_referee(self, request, pk=None):
        game = self.get_object()
        referee_id = request.data.get('referee_id')

        if not referee_id:
            return Response({"error": "referee_id is required"}, status=400)

        try:
            referee = RefereeProfile.objects.get(id=referee_id)
        except RefereeProfile.DoesNotExist:
            return Response({"error": "Referee not found"}, status=404)

        # Must be allowed
        if not game.competition.can_ref_cancel:
            return Response(
                {"error": "Referee cancellation not allowed for this competition."},
                status=403
            )

        changed = False

        if game.crew_chief == referee:
            game.crew_chief = None
            changed = True
        elif game.umpire1 == referee:
            game.umpire1 = None
            changed = True
        elif game.umpire2 == referee:
            game.umpire2 = None
            changed = True

        if not changed:
            return Response({"error": "Referee is not assigned to this game."}, status=400)

        game.save()
        return Response(GameSerializer(game).data)

    # -------------------------
    # MY GAMES LIST
    # -------------------------
    @action(detail=False, methods=['get'])
    def my_games(self, request):
        referee_id = request.query_params.get('referee_id')

        if not referee_id:
            return Response({"error": "referee_id is required"}, status=400)

        try:
            referee = RefereeProfile.objects.get(id=referee_id)
        except RefereeProfile.DoesNotExist:
            return Response({"error": "Referee not found"}, status=404)

        games = Game.objects.filter(
            models.Q(crew_chief=referee)
            | models.Q(umpire1=referee)
            | models.Q(umpire2=referee)
        ).order_by('date', 'time')

        return Response(GameSerializer(games, many=True).data)

    # -------------------------
    # REQUEST COVER
    # -------------------------
    @action(detail=True, methods=['post'])
    def request_cover(self, request, pk=None):
        game = self.get_object()
        referee_id = request.data.get('referee_id')

        if not referee_id:
            return Response({"error": "referee_id is required"}, status=400)

        try:
            referee = RefereeProfile.objects.get(id=referee_id)
        except RefereeProfile.DoesNotExist:
            return Response({"error": "Referee not found"}, status=404)

        # Ensure referee is actually assigned
        if referee not in [game.crew_chief, game.umpire1, game.umpire2]:
            return Response(
                {"error": "This referee is not assigned to the game."},
                status=400
            )

        cover = CoverRequest.objects.create(
            game=game,
            referee=referee,
            status='pending'
        )

        return Response(CoverRequestSerializer(cover).data, status=201)



# -------------------------------------------------------
# COVER REQUEST VIEWSET (TOP-LEVEL, NOT INSIDE GameViewSet)
# -------------------------------------------------------
class CoverRequestViewSet(viewsets.ModelViewSet):
    queryset = CoverRequest.objects.all().order_by('-created_at')
    serializer_class = CoverRequestSerializer

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        cover = self.get_object()
        new_referee_id = request.data.get('referee_id')

        if cover.status != 'pending':
            return Response({"error": "This cover request is not pending."}, status=400)

        try:
            new_ref = RefereeProfile.objects.get(id=new_referee_id)
        except RefereeProfile.DoesNotExist:
            return Response({"error": "Referee not found"}, status=404)

        game = cover.game

        # Replace correct slot
        if cover.referee == game.crew_chief:
            game.crew_chief = new_ref
        elif cover.referee == game.umpire1:
            game.umpire1 = new_ref
        elif cover.referee == game.umpire2:
            game.umpire2 = new_ref
        else:
            return Response({"error": "Referee is not assigned to this game."}, status=400)

        # Save updates
        game.save()
        cover.status = 'accepted'
        cover.accepted_by = new_ref
        cover.save()

        return Response({
            "message": "Cover request accepted.",
            "updated_game": GameSerializer(game).data,
            "cover_request": CoverRequestSerializer(cover).data
        })
