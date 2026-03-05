from django.urls import path
from . import views

urlpatterns = [
    path("venues/", views.list_venues, name="list_venues"),
    path("venues/<int:venue_id>/", views.get_venue, name="get_venue"),
    path("venues/search/", views.search_venues, name="search_venues"),
    path("venues/nearby/", views.nearby_venues, name="nearby_venues"),
    path("venues/create/", views.create_venue, name="create_venue"),
    path("venues/<int:venue_id>/update/", views.update_venue, name="update_venue"),
    path("venues/<int:venue_id>/delete/", views.delete_venue, name="delete_venue"),
]