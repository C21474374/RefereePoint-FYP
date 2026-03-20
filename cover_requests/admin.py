from django.contrib import admin
from .models import CoverRequest


@admin.register(CoverRequest)
class CoverRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "game",
        "referee_slot",
        "requested_by",
        "replaced_by",
        "approver",
        "status",
        "created_at",
        "updated_at",
    )
    list_filter = (
        "status",
        "game__game_type",
        "game__status",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "game__home_team__name",
        "game__away_team__name",
        "game__venue__name",
        "requested_by__email",
        "replaced_by__user__email",
        "approver__email",
        "reason",
    )
    ordering = ("-created_at",)
    autocomplete_fields = (
        "game",
        "requested_by",
        "referee_slot",
        "replaced_by",
        "approver",
    )
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        ("Core Info", {
            "fields": (
                "game",
                "referee_slot",
                "status",
            )
        }),
        ("People", {
            "fields": (
                "requested_by",
                "replaced_by",
                "approver",
            )
        }),
        ("Extra", {
            "fields": (
                "reason",
                
            )
        }),
        ("Timestamps", {
            "fields": (
                "created_at",
                "updated_at",
            )
        }),
    )