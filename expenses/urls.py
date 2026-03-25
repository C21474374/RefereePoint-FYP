from django.urls import path

from .views import RefereeEarningsAPIView


urlpatterns = [
    path("earnings/", RefereeEarningsAPIView.as_view(), name="referee-earnings"),
]
