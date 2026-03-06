from django.contrib import admin
from .models import Game, RefereeAssignment


class RefereeAssignmentInline(admin.TabularInline):
    model = RefereeAssignment
    extra = 3
    raw_id_fields = ('referee',)


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ('id', 'game_type', 'date', 'time', 'home_team', 'away_team', 'venue', 'division')
    list_filter = ('game_type', 'date', 'division')
    search_fields = ('home_team__club__name', 'away_team__club__name', 'venue__name')
    date_hierarchy = 'date'
    raw_id_fields = ('venue', 'home_team', 'away_team', 'division')
    inlines = [RefereeAssignmentInline]
    ordering = ('-date', '-time')


@admin.register(RefereeAssignment)
class RefereeAssignmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'game', 'referee', 'role')
    list_filter = ('role', 'game__date')
    search_fields = ('referee__user__email', 'referee__user__first_name', 'game__home_team__club__name')
    raw_id_fields = ('game', 'referee')
