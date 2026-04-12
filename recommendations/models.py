from django.db import models


class RecommendationSnapshot(models.Model):
    class OpportunityType(models.TextChoices):
        NON_APPOINTED_SLOT = "NON_APPOINTED_SLOT", "Non-Appointed Slot"
        COVER_REQUEST = "COVER_REQUEST", "Cover Request"
        EVENT = "EVENT", "Event"

    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="recommendation_snapshots",
    )
    opportunity_type = models.CharField(
        max_length=30,
        choices=OpportunityType.choices,
    )
    opportunity_id = models.PositiveBigIntegerField()
    score = models.DecimalField(max_digits=6, decimal_places=2)
    reasons = models.JSONField(default=list, blank=True)
    computed_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "recommendations_snapshot"
        ordering = ["-score", "-computed_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "opportunity_type", "opportunity_id"],
                name="unique_user_recommendation_snapshot",
            )
        ]
        indexes = [
            models.Index(fields=["user", "-score"], name="recommendation_user_score_idx"),
            models.Index(fields=["computed_at"], name="recommendation_computed_at_idx"),
        ]

    def __str__(self):
        return (
            f"{self.user_id} - {self.opportunity_type}:{self.opportunity_id} "
            f"({self.score})"
        )
