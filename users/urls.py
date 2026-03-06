from django.urls import path
from . import views

urlpatterns = [
    path('referees/', views.list_referees, name='list_referees'),
    path('referees/<int:referee_id>/', views.referee_detail, name='referee_detail'),
    path('me/', views.current_user, name='current_user'),
    path('', views.list_users, name='list_users'),
]
