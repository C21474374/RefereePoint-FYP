from django.urls import path
from . import views

urlpatterns = [
    path('', views.list_clubs, name='list_clubs'),
    path('<int:club_id>/', views.club_detail, name='club_detail'),
    path('divisions/', views.list_divisions, name='list_divisions'),
    path('divisions/<int:division_id>/', views.division_detail, name='division_detail'),
    path('teams/', views.list_teams, name='list_teams'),
    path('teams/<int:team_id>/', views.team_detail, name='team_detail'),
]
