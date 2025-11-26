from django.contrib import admin
from .models import (
    GameCategory,
    Competition,
    Team,
    Game,
    CoverRequest,
    Event
)


# ----------------------------------------------------
# GAME CATEGORY
# ----------------------------------------------------
@admin.register(GameCategory)
class GameCategoryAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)


# ----------------------------------------------------
# COMPETITION
# ----------------------------------------------------
@admin.register(Competition)
class CompetitionAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)


# ----------------------------------------------------
# TEAM
# ----------------------------------------------------
@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ('name', 'county')
    list_filter = ('county',)
    search_fields = ('name', 'county')


# ----------------------------------------------------
# GAME (WITH 3 REFEREE SLOTS)
# ----------------------------------------------------
@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = (
        'game_number',
        'competition',
        'team_home',
        'team_away',
        'date',
        'time',
        'crew_chief',
        'umpire1',
        'umpire2',
        'referees_required',
        'must_be_graded',
    )

    list_filter = (
        'competition',
        'category',
        'must_be_graded',
        'date',
        'crew_chief',
        'umpire1',
        'umpire2',
    )

    search_fields = (
        'game_number',
        'competition__name',
        'team_home__name',
        'team_away__name',
        'location_name',
        'crew_chief__user__username',
        'umpire1__user__username',
        'umpire2__user__username',
    )

    autocomplete_fields = (
        'competition',
        'team_home',
        'team_away',
        'crew_chief',
        'umpire1',
        'umpire2',
    )

    ordering = ('date', 'time')


# ----------------------------------------------------
# COVER REQUEST
# ----------------------------------------------------
@admin.register(CoverRequest)
class CoverRequestAdmin(admin.ModelAdmin):
    list_display = (
        'game',
        'referee',
        'status',
        'accepted_by',
        'created_at',
        'accepted_at'
    )

    list_filter = (
        'status',
        'created_at',
        'referee',
        'accepted_by'
    )

    search_fields = (
        'game__game_number',
        'game__competition__name',
        'referee__user__username',
        'accepted_by__user__username',
    )

    autocomplete_fields = (
        'game',
        'referee',
        'accepted_by',
    )


# ----------------------------------------------------
# EVENT
# ----------------------------------------------------
@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = (
        'event_name',
        'start_date',
        'end_date',
        'referees_required',
        'payment_type',
        'payment_amount',
    )

    list_filter = ('payment_type', 'start_date')
    search_fields = (
        'event_name',
        'description',
        'contact_info',
    )
