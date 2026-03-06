from django.contrib import admin
from .models import Venue


@admin.register(Venue)
class VenueAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'address', 'lat', 'lon', 'club')
    list_filter = ('club',)
    search_fields = ('name', 'address')
    raw_id_fields = ('club',)
    ordering = ('name',)
