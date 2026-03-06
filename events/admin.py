from django.contrib import admin
from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('id', 'start_date', 'end_date', 'venue', 'referees_required', 'fee_per_game')
    list_filter = ('start_date', 'venue')
    search_fields = ('description', 'venue__name', 'contact_information')
    date_hierarchy = 'start_date'
    raw_id_fields = ('venue',)
    ordering = ('-start_date',)
