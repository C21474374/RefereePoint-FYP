from django.contrib import admin

from .models import ExpenseRecord, MonthlyEarningsSnapshot


@admin.register(ExpenseRecord)
class ExpenseRecordAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "assignment",
        "game",
        "referee",
        "base_fee",
        "travel_amount",
        "total_amount",
        "travel_mode",
        "travel_source",
        "is_back_to_back_same_venue",
        "missing_distance_data",
        "calculated_at",
    )
    list_filter = (
        "travel_mode",
        "travel_source",
        "is_back_to_back_same_venue",
        "missing_distance_data",
        "calculated_at",
    )
    search_fields = (
        "referee__user__email",
        "game__home_team__club__name",
        "game__away_team__club__name",
        "game__venue__name",
    )
    ordering = ("-game__date", "-game__time", "-updated_at")
    autocomplete_fields = ("assignment", "game", "referee")
    readonly_fields = ("calculated_at", "created_at", "updated_at")


@admin.register(MonthlyEarningsSnapshot)
class MonthlyEarningsSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "referee",
        "game_type",
        "year",
        "month",
        "games_count",
        "total_claim_amount",
        "missing_distance_games",
        "finalized_at",
    )
    list_filter = ("game_type", "year", "month", "finalized_at")
    search_fields = ("referee__user__email", "referee__user__first_name", "referee__user__last_name")
    ordering = ("-year", "-month", "game_type")
    autocomplete_fields = ("referee",)
    readonly_fields = ("finalized_at", "created_at", "updated_at")
