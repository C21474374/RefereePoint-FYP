from django.urls import path

from .views import (
    AdminReportsAPIView,
    CreateGameReportAPIView,
    MyReportsAPIView,
    ReportableGamesAPIView,
)


urlpatterns = [
    path("reportable-games/", ReportableGamesAPIView.as_view(), name="reportable-games"),
    path("create/", CreateGameReportAPIView.as_view(), name="create-game-report"),
    path("my/", MyReportsAPIView.as_view(), name="my-reports"),
    path("admin/", AdminReportsAPIView.as_view(), name="admin-reports"),
]
