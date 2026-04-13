from django.contrib import admin

from .models import School, SchoolDivision, SchoolTeam


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(SchoolDivision)
class SchoolDivisionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "gender",
        "requires_appointed_referees",
        "is_active",
    )
    list_filter = ("gender", "requires_appointed_referees", "is_active")
    search_fields = ("name",)
    ordering = ("name", "gender")


@admin.register(SchoolTeam)
class SchoolTeamAdmin(admin.ModelAdmin):
    list_display = ("id", "school", "division", "is_active")
    list_filter = ("division", "school", "is_active")
    search_fields = ("school__name", "division__name")
    raw_id_fields = ("school", "division")
