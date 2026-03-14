from django.urls import path
from .views import (
    GameListAPIView,
    GameDetailAPIView,
    RefereeAssignmentListAPIView,
)

urlpatterns = [
    path("", GameListAPIView.as_view(), name="game-list"),
    path("<int:pk>/", GameDetailAPIView.as_view(), name="game-detail"),
    path("assignments/", RefereeAssignmentListAPIView.as_view(), name="assignment-list"),
]