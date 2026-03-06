from django.urls import path
from . import views

urlpatterns = [
    path('', views.list_cover_requests, name='list_cover_requests'),
    path('<int:cover_request_id>/', views.cover_request_detail, name='cover_request_detail'),
    path('my/', views.my_cover_requests, name='my_cover_requests'),
    path('pending/', views.pending_cover_requests, name='pending_cover_requests'),
]
