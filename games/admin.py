from django.contrib import admin
from .models import (
    GameCategory,
    Game,
    GameAssignment,
    CoverRequest,
    Event
)


@admin.register(GameCategory)
class GameCategoryAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = (
        'competition', 
        'team_home', 
        'team_away',
        'date', 
        'time',
        'referees_required',
        'must_be_graded'
    )
    list_filter = ('competition', 'must_be_graded', 'date')
    search_fields = ('team_home', 'team_away', 'competition')
    ordering = ('date', 'time')


@admin.register(GameAssignment)
class GameAssignmentAdmin(admin.ModelAdmin):
    list_display = ('game', 'referee', 'accepted_at')
    list_filter = ('accepted_at',)
    search_fields = ('game__competition', 'referee__user__username')


@admin.register(CoverRequest)
class CoverRequestAdmin(admin.ModelAdmin):
    list_display = ('game', 'referee', 'status', 'accepted_by', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('game__competition', 'referee__user__username', 'accepted_by__user__username')


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('event_name', 'start_date', 'end_date', 'referees_required', 'payment_type')
    list_filter = ('start_date', 'payment_type')
    search_fields = ('event_name', 'description', 'contact_info')
