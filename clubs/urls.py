from django.urls import path
from . import views

urlpatterns = [
    path('configure/bootstrap/', views.ConfigureBootstrapAPIView.as_view(), name='configure_bootstrap'),
    path('configure/divisions/', views.ConfigureDivisionsAPIView.as_view(), name='configure_divisions'),
    path(
        'configure/divisions/<int:division_id>/',
        views.ConfigureDivisionDetailAPIView.as_view(),
        name='configure_division_detail',
    ),
    path('configure/teams/', views.ConfigureTeamsAPIView.as_view(), name='configure_teams'),
    path(
        'configure/teams/<int:team_id>/',
        views.ConfigureTeamDetailAPIView.as_view(),
        name='configure_team_detail',
    ),
    path('', views.list_clubs, name='list_clubs'),
    path('<int:club_id>/', views.club_detail, name='club_detail'),
    path('divisions/', views.list_divisions, name='list_divisions'),
    path('divisions/<int:division_id>/', views.division_detail, name='division_detail'),
    path('teams/', views.list_teams, name='list_teams'),
    path('teams/<int:team_id>/', views.team_detail, name='team_detail'),
]
