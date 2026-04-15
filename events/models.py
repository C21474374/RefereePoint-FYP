"""Event domain models."""

from django.db import models


class Event(models.Model):
    """Events - specific instances of games at venues (tournaments, etc.)."""

    class EventType(models.TextChoices):
        CLUB = "CLUB", "Club"
        SCHOOL = "SCHOOL", "School"
        COLLEGE = "COLLEGE", "College"
    
    event_type = models.CharField(
        max_length=20,
        choices=EventType.choices,
        default=EventType.CLUB,
    )
    start_date = models.DateField()
    end_date = models.DateField()
    venue = models.ForeignKey(
        'venues.Venue',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='events'
    )
    description = models.TextField(blank=True, default='')
    fee_per_game = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    contact_information = models.TextField(blank=True, default='')
    referees_required = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events_created",
    )
    
    class Meta:
        db_table = 'events_event'
        ordering = ['start_date']
    
    def __str__(self):
        venue_name = self.venue.name if self.venue else 'No venue'
        return f"Event at {venue_name} ({self.start_date} - {self.end_date})"


class EventRefereeAssignment(models.Model):
    """Join table linking referees to events."""

    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="referee_assignments",
    )
    referee = models.ForeignKey(
        "users.RefereeProfile",
        on_delete=models.CASCADE,
        related_name="event_assignments",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "events_event_referee_assignment"
        ordering = ["joined_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["event", "referee"],
                name="unique_event_referee_assignment",
            ),
        ]

    def __str__(self):
        return f"{self.referee} @ Event {self.event_id}"
