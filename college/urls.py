from django.urls import path

from . import views

urlpatterns = [
    path("", views.list_colleges, name="list_colleges"),
    path("<int:college_id>/", views.college_detail, name="college_detail"),
    path("divisions/", views.list_divisions, name="list_college_divisions"),
    path(
        "divisions/<int:division_id>/",
        views.division_detail,
        name="college_division_detail",
    ),
    path("teams/", views.list_teams, name="list_college_teams"),
    path("teams/<int:team_id>/", views.team_detail, name="college_team_detail"),
    path(
        "configure/bootstrap/",
        views.ConfigureBootstrapAPIView.as_view(),
        name="college_configure_bootstrap",
    ),
    path(
        "configure/divisions/",
        views.ConfigureDivisionsAPIView.as_view(),
        name="college_configure_divisions",
    ),
    path(
        "configure/divisions/<int:division_id>/",
        views.ConfigureDivisionDetailAPIView.as_view(),
        name="college_configure_division_detail",
    ),
    path(
        "configure/teams/",
        views.ConfigureTeamsAPIView.as_view(),
        name="college_configure_teams",
    ),
    path(
        "configure/teams/<int:team_id>/",
        views.ConfigureTeamDetailAPIView.as_view(),
        name="college_configure_team_detail",
    ),
]

