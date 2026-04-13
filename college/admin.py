from django.contrib import admin

from .models import College, CollegeDivision, CollegeTeam


@admin.register(College)
class CollegeAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(CollegeDivision)
class CollegeDivisionAdmin(admin.ModelAdmin):
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


@admin.register(CollegeTeam)
class CollegeTeamAdmin(admin.ModelAdmin):
    list_display = ("id", "college", "division", "is_active")
    list_filter = ("division", "college", "is_active")
    search_fields = ("college__name", "division__name")
    raw_id_fields = ("college", "division")
