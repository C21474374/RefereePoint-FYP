from rest_framework import generics
from .models import Game, RefereeAssignment
from .serializers import GameSerializer, RefereeAssignmentSerializer


class GameListAPIView(generics.ListAPIView):
    serializer_class = GameSerializer

    def get_queryset(self):
        queryset = (
            Game.objects.select_related(
                "venue",
                "division",
                "home_team__club",
                "away_team__club",
            )
            .all()
            .order_by("date", "time")
        )

        # Optional filters
        game_type = self.request.query_params.get("game_type")
        division_id = self.request.query_params.get("division")
        date = self.request.query_params.get("date")

        if game_type:
            queryset = queryset.filter(game_type=game_type)

        if division_id:
            queryset = queryset.filter(division_id=division_id)

        if date:
            queryset = queryset.filter(date=date)

        return queryset


class GameDetailAPIView(generics.RetrieveAPIView):
    queryset = Game.objects.select_related(
        "venue",
        "division",
        "home_team__club",
        "away_team__club",
    )
    serializer_class = GameSerializer


class RefereeAssignmentListAPIView(generics.ListAPIView):
    serializer_class = RefereeAssignmentSerializer

    def get_queryset(self):
        queryset = RefereeAssignment.objects.select_related(
            "game",
            "referee__user",
        ).all()

        game_id = self.request.query_params.get("game_id")
        if game_id:
            queryset = queryset.filter(game_id=game_id)

        return queryset