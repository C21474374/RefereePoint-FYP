from django.urls import path
from .views import (
    CoverRequestListAPIView,
    CoverRequestDetailAPIView,
    MyCoverRequestListAPIView,
    PendingCoverRequestListAPIView,
    CreateCoverRequestAPIView,
    OfferCoverAPIView,
    ApproveCoverRequestAPIView,
)

urlpatterns = [
    path("", CoverRequestListAPIView.as_view(), name="cover-request-list"),
    path("create/", CreateCoverRequestAPIView.as_view(), name="cover-request-create"),
    path("my/", MyCoverRequestListAPIView.as_view(), name="my-cover-requests"),
    path("pending/", PendingCoverRequestListAPIView.as_view(), name="pending-cover-requests"),
    path("<int:pk>/", CoverRequestDetailAPIView.as_view(), name="cover-request-detail"),
    path("<int:pk>/offer/", OfferCoverAPIView.as_view(), name="cover-request-offer"),
    path("<int:pk>/approve/", ApproveCoverRequestAPIView.as_view(), name="cover-request-approve"),
]