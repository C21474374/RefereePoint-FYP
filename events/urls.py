from django.urls import path
from .views import (
    EventCreateAPIView,
    EventDeleteAPIView,
    EventDetailAPIView,
    EventListAPIView,
    JoinEventAPIView,
    LeaveEventAPIView,
    EventUpdateAPIView,
)

urlpatterns = [
    path("", EventListAPIView.as_view(), name="event-list"),
    path("create/", EventCreateAPIView.as_view(), name="event-create"),
    path("<int:pk>/", EventDetailAPIView.as_view(), name="event-detail"),
    path("<int:pk>/update/", EventUpdateAPIView.as_view(), name="event-update"),
    path("<int:pk>/delete/", EventDeleteAPIView.as_view(), name="event-delete"),
    path("<int:pk>/join/", JoinEventAPIView.as_view(), name="event-join"),
    path("<int:pk>/leave/", LeaveEventAPIView.as_view(), name="event-leave"),
]
