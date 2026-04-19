from django.urls import path

from . import views

urlpatterns = [
    path("", views.list_schools, name="list_schools"),
    path("<int:school_id>/", views.school_detail, name="school_detail"),
    path("divisions/", views.list_divisions, name="list_school_divisions"),
    path(
        "divisions/<int:division_id>/",
        views.division_detail,
        name="school_division_detail",
    ),
    path("teams/", views.list_teams, name="list_school_teams"),
    path("teams/<int:team_id>/", views.team_detail, name="school_team_detail"),
    path(
        "configure/bootstrap/",
        views.ConfigureBootstrapAPIView.as_view(),
        name="schools_configure_bootstrap",
    ),
    path(
        "configure/divisions/",
        views.ConfigureDivisionsAPIView.as_view(),
        name="schools_configure_divisions",
    ),
    path(
        "configure/divisions/<int:division_id>/",
        views.ConfigureDivisionDetailAPIView.as_view(),
        name="schools_configure_division_detail",
    ),
    path(
        "configure/teams/",
        views.ConfigureTeamsAPIView.as_view(),
        name="schools_configure_teams",
    ),
    path(
        "configure/teams/<int:team_id>/",
        views.ConfigureTeamDetailAPIView.as_view(),
        name="schools_configure_team_detail",
    ),
]

