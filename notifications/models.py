from django.db import models


class UserNotification(models.Model):
    class NotificationType(models.TextChoices):
        COVER_REQUEST_STATUS = "COVER_REQUEST_STATUS", "Cover Request Status"
        GAME_REMINDER = "GAME_REMINDER", "Game Reminder"
        EVENT_REMINDER = "EVENT_REMINDER", "Event Reminder"
        GAME_ASSIGNMENT_ACTIVITY = "GAME_ASSIGNMENT_ACTIVITY", "Game Assignment Activity"
        EVENT_ASSIGNMENT_ACTIVITY = "EVENT_ASSIGNMENT_ACTIVITY", "Event Assignment Activity"
        ACCOUNT_APPROVAL = "ACCOUNT_APPROVAL", "Account Approval"
        COVER_REQUEST_ADMIN = "COVER_REQUEST_ADMIN", "Cover Request (Admin)"
        REPORT_ADMIN = "REPORT_ADMIN", "Report (Admin)"

    recipient = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    actor = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications_triggered",
    )
    notification_type = models.CharField(
        max_length=40,
        choices=NotificationType.choices,
    )
    title = models.CharField(max_length=180)
    message = models.TextField()
    link_path = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    dedupe_key = models.CharField(
        max_length=180,
        null=True,
        blank=True,
        help_text="Optional unique key to avoid duplicate notifications.",
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications_user_notification"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["recipient", "dedupe_key"],
                name="unique_notification_dedupe_per_user",
            )
        ]

    def __str__(self):
        return f"{self.recipient_id} - {self.get_notification_type_display()} - {self.title}"
