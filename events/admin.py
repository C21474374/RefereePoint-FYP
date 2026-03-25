from django.contrib import admin
from .models import Event, EventRefereeAssignment


class EventRefereeAssignmentInline(admin.TabularInline):
    model = EventRefereeAssignment
    extra = 0
    raw_id_fields = ("referee",)


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('id', 'start_date', 'end_date', 'venue', 'created_by', 'referees_required', 'fee_per_game')
    list_filter = ('start_date', 'venue')
    search_fields = ('description', 'venue__name', 'contact_information')
    date_hierarchy = 'start_date'
    raw_id_fields = ('venue',)
    ordering = ('-start_date',)
    inlines = [EventRefereeAssignmentInline]


@admin.register(EventRefereeAssignment)
class EventRefereeAssignmentAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "referee", "joined_at")
    search_fields = ("event__venue__name", "referee__user__first_name", "referee__user__last_name")
    list_filter = ("joined_at",)
    raw_id_fields = ("event", "referee")
