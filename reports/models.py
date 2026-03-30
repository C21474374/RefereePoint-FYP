from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class GameReport(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        REVIEWED = "REVIEWED", "Reviewed"
        RESOLVED = "RESOLVED", "Resolved"

    game = models.ForeignKey(
        "games.Game",
        on_delete=models.CASCADE,
        related_name="reports",
    )
    referee = models.ForeignKey(
        "users.RefereeProfile",
        on_delete=models.CASCADE,
        related_name="game_reports",
    )
    submitted_by = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="reports_submitted",
    )

    match_no = models.CharField(max_length=100, blank=True, default="")
    incident_time = models.TimeField(null=True, blank=True)

    people_involved_no_1 = models.CharField(max_length=20, blank=True, default="")
    people_involved_name_1 = models.CharField(max_length=140, blank=True, default="")
    people_involved_no_2 = models.CharField(max_length=20, blank=True, default="")
    people_involved_name_2 = models.CharField(max_length=140, blank=True, default="")
    people_involved_other = models.TextField(blank=True, default="")

    incident_details = models.TextField()
    action_taken = models.TextField()

    signed_by = models.CharField(max_length=200, blank=True, default="")
    signed_date = models.DateField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    reviewed_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reports_game_report"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["game", "referee"],
                name="unique_report_per_referee_per_game",
            )
        ]

    def __str__(self):
        return f"Report #{self.id} - Game {self.game_id} - {self.get_status_display()}"

    def _has_refereed_game(self):
        from games.models import NonAppointedSlot, RefereeAssignment

        appointed_exists = RefereeAssignment.objects.filter(
            game_id=self.game_id,
            referee_id=self.referee_id,
        ).exists()

        non_appointed_exists = NonAppointedSlot.objects.filter(
            game_id=self.game_id,
            claimed_by_id=self.referee_id,
            status__in=[
                NonAppointedSlot.Status.CLAIMED,
                NonAppointedSlot.Status.CLOSED,
            ],
        ).exists()

        return appointed_exists or non_appointed_exists

    def clean(self):
        super().clean()

        if self.referee_id and self.submitted_by_id:
            if self.referee.user_id != self.submitted_by_id:
                raise ValidationError(
                    {"submitted_by": "Submitted user must match the report referee."}
                )

        if self._state.adding:
            today = timezone.localdate()
            earliest_allowed = today - timedelta(days=7)

            if self.game.date > today:
                raise ValidationError(
                    {"game": "Reports can only be submitted for games already played."}
                )

            if self.game.date < earliest_allowed:
                raise ValidationError(
                    {"game": "Reports must be submitted within 7 days of the game date."}
                )

            if not self._has_refereed_game():
                raise ValidationError(
                    {"game": "You can only report games where you were assigned."}
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
