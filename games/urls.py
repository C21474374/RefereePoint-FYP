from django.urls import path

from .views import (
    GameListAPIView,
    GameDetailAPIView,
    RefereeAssignmentListAPIView,
    NonAppointedSlotListAPIView,
    NonAppointedSlotDetailAPIView,
    ClaimNonAppointedSlotAPIView,
    NonAppointedGameUploadAPIView,
    OpportunityFeedAPIView,
    UploadGameAvailabilityView,
    CsrfCookieAPIView,
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
]