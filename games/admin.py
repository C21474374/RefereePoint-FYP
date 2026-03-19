from django.contrib import admin
from .models import Game, NonAppointedSlot, RefereeAssignment


class NonAppointedSlotInline(admin.TabularInline):
    model = NonAppointedSlot
    extra = 0
    fields = (
        "role",
        "status",
        "posted_by",
        "claimed_by",
        "is_active",
        "claimed_at",
        "expires_at",
    )


class RefereeAssignmentInline(admin.TabularInline):
    model = RefereeAssignment
    extra = 0
    fields = ("referee", "role")


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "home_team",
        "away_team",
        "game_type",
        "division",
        "venue",
        "date",
        "time",
        "payment_type",
        "status",
        "created_by",
        "assigned_roles_count",
        "open_non_appointed_slots_count",
    )
    list_filter = (
        "game_type",
        "status",
        "payment_type",
        "division",
        "venue",
        "date",
    )
    search_fields = (
        "home_team__name",
        "away_team__name",
        "venue__name",
        "division__name",
        "created_by__email",
        "notes",
        "original_post_text",
    )
    ordering = ("-date", "-time")
    autocomplete_fields = (
        "division",
        "venue",
        "home_team",
        "away_team",
        "created_by",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "assigned_roles_count",
        "open_non_appointed_slots_count",
    )
    inlines = [NonAppointedSlotInline, RefereeAssignmentInline]

    fieldsets = (
        ("Game Details", {
            "fields": (
                "game_type",
                "status",
                "payment_type",
                "division",
            )
        }),
        ("Fixture Info", {
            "fields": (
                "home_team",
                "away_team",
                "venue",
                "date",
                "time",
            )
        }),
        ("Created By / Notes", {
            "fields": (
                "created_by",
                "notes",
                "original_post_text",
            )
        }),
        ("Counts", {
            "fields": (
                "assigned_roles_count",
                "open_non_appointed_slots_count",
            )
        }),
        ("Timestamps", {
            "fields": (
                "created_at",
                "updated_at",
            )
        }),
    )


@admin.register(NonAppointedSlot)
class NonAppointedSlotAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "game",
        "role",
        "status",
        "posted_by",
        "claimed_by",
        "is_active",
        "claimed_at",
        "expires_at",
        "created_at",
    )
    list_filter = (
        "role",
        "status",
        "is_active",
        "created_at",
    )
    search_fields = (
        "game__home_team__name",
        "game__away_team__name",
        "game__venue__name",
        "posted_by__email",
        "claimed_by__user__email",
        "description",
    )
    ordering = ("-game__date", "-game__time", "role")
    autocomplete_fields = ("game", "posted_by", "claimed_by")
    readonly_fields = ("created_at", "updated_at", "claimed_at")


@admin.register(RefereeAssignment)
class RefereeAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "game",
        "referee",
        "role",
    )
    list_filter = (
        "role",
        "game__game_type",
        "game__status",
    )
    search_fields = (
        "game__home_team__name",
        "game__away_team__name",
        "game__venue__name",
        "referee__user__email",
    )
    ordering = ("-game__date", "-game__time", "role")
    autocomplete_fields = ("game", "referee")