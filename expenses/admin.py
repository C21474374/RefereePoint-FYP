from django.contrib import admin

from .models import ExpenseRecord


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
