from django.core.exceptions import ValidationError
from django.db import models


class CoverRequest(models.Model):
    """Requests from referees to cover already assigned games."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CLAIMED = "CLAIMED", "Claimed"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    game = models.ForeignKey(
        "games.Game",
        on_delete=models.CASCADE,
        related_name="cover_requests",
    )
    requested_by = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="cover_requests_made",
    )
    referee_slot = models.ForeignKey(
        "games.RefereeAssignment",
        on_delete=models.CASCADE,
        related_name="cover_requests",
        help_text="The assignment being replaced.",
    )
    replaced_by = models.ForeignKey(
        "users.RefereeProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cover_assignments",
        help_text="The referee covering the game.",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    approver = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cover_requests_approved",
    )
    reason = models.TextField(blank=True, default="")
    custom_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cover_requests_cover_request"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Cover request for {self.game} by {self.requested_by}"

    def clean(self):
        super().clean()

        if self.referee_slot.game_id != self.game_id:
            raise ValidationError(
                {"referee_slot": "The referee assignment must belong to the same game."}
            )

        if self.requested_by_id != self.referee_slot.referee.user_id:
            raise ValidationError(
                {
                    "requested_by": (
                        "Only the referee assigned to this slot can request cover."
                    )
                }
            )

        if self.replaced_by and self.referee_slot.role == "CREW_CHIEF":
            if self.replaced_by.grade == "INTRO":
                raise ValidationError(
                    {"replaced_by": "An Intro referee cannot cover Crew Chief."}
                )

        active_statuses = {
            self.Status.PENDING,
            self.Status.CLAIMED,
        }

        existing_active_request = CoverRequest.objects.filter(
            referee_slot=self.referee_slot,
            status__in=active_statuses,
        ).exclude(pk=self.pk)

        if existing_active_request.exists():
            raise ValidationError(
                {
                    "referee_slot": (
                        "There is already an active cover request for this assignment."
                    )
                }
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)