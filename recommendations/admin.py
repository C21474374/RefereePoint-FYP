from django.contrib import admin

from .models import RecommendationSnapshot


@admin.register(RecommendationSnapshot)
class RecommendationSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "opportunity_type",
        "opportunity_id",
        "score",
        "computed_at",
    )
    list_filter = ("opportunity_type", "computed_at")
    search_fields = ("user__email", "user__first_name", "user__last_name")
    ordering = ("-computed_at", "-score")
