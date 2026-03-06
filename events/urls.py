from django.urls import path
from . import views

urlpatterns = [
    path('', views.list_events, name='list_events'),
    path('<int:event_id>/', views.event_detail, name='event_detail'),
    path('upcoming/', views.upcoming_events, name='upcoming_events'),
    path('by-venue/<int:venue_id>/', views.events_by_venue, name='events_by_venue'),
]
