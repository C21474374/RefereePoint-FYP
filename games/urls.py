from django.urls import path

from .views import (
    GameListAPIView,
    GameDetailAPIView,
    RefereeAssignmentListAPIView,
    NonAppointedSlotListAPIView,
    NonAppointedSlotDetailAPIView,
    ClaimNonAppointedSlotAPIView,
    NonAppointedGameUploadAPIView,
    MyUploadedGamesAPIView,
    MyUploadedGameUpdateAPIView,
    MyUploadedGameDeleteAPIView,
    OpportunityFeedAPIView,
    UploadGameAvailabilityView,
    CsrfCookieAPIView,
    MyClaimedGamesAPIView,
)


urlpatterns = [
    # Games
    path("", GameListAPIView.as_view(), name="game-list"),
    path("<int:pk>/", GameDetailAPIView.as_view(), name="game-detail"),

    # Referee assignments
    path(
        "assignments/",
        RefereeAssignmentListAPIView.as_view(),
        name="referee-assignment-list",
    ),

    # Non-appointed slots (opportunities)
    path(
        "non-appointed-slots/",
        NonAppointedSlotListAPIView.as_view(),
        name="non-appointed-slot-list",
    ),
    path(
        "non-appointed-slots/<int:pk>/",
        NonAppointedSlotDetailAPIView.as_view(),
        name="non-appointed-slot-detail",
    ),

    path(
        "non-appointed-slots/<int:pk>/claim/",
        ClaimNonAppointedSlotAPIView.as_view(),
        name="non-appointed-slot-claim",
    ),

    path(
    "upload/",
    NonAppointedGameUploadAPIView.as_view(),
    name="non-appointed-game-upload",
    ),

    path(
    "my-uploads/",
    MyUploadedGamesAPIView.as_view(),
    name="my-uploaded-games",
    ),

    path(
    "my-uploads/<int:pk>/update/",
    MyUploadedGameUpdateAPIView.as_view(),
    name="my-uploaded-game-update",
    ),

    path(
    "my-uploads/<int:pk>/delete/",
    MyUploadedGameDeleteAPIView.as_view(),
    name="my-uploaded-game-delete",
    ),

    path(
    "opportunities/",
    OpportunityFeedAPIView.as_view(),
    name="opportunity-feed",
    ),

    path(
    "upload/check/",
    UploadGameAvailabilityView.as_view(),
    name="upload-game-check"
    ),

    path(
    "csrf/",
    CsrfCookieAPIView.as_view(),
    name="csrf-cookie",
    ),

    path(
    "my-games/",
    MyClaimedGamesAPIView.as_view(),
    name="my-claimed-games",
    ),
]
