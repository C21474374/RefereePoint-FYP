from django.contrib import admin

from .models import GameReport


@admin.register(GameReport)
class GameReportAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "game",
        "referee",
        "status",
        "submitted_by",
        "signed_date",
        "created_at",
    )
    list_filter = ("status", "signed_date", "created_at")
    search_fields = (
        "game__home_team__club__name",
        "game__away_team__club__name",
        "referee__user__first_name",
        "referee__user__last_name",
        "submitted_by__email",
        "incident_details",
    )
    readonly_fields = ("created_at", "updated_at")
