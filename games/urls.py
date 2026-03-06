from django.urls import path
from . import views

urlpatterns = [
    path('', views.list_games, name='list_games'),
    path('<int:game_id>/', views.game_detail, name='game_detail'),
    path('upcoming/', views.upcoming_games, name='upcoming_games'),
    path('needing-referees/', views.games_needing_referees, name='games_needing_referees'),
]
