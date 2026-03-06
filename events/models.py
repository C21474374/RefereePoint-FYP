from django.db import models


class Event(models.Model):
    """Events - specific instances of games at venues (tournaments, etc.)."""
    
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
    
    class Meta:
        db_table = 'events_event'
        ordering = ['start_date']
    
    def __str__(self):
        venue_name = self.venue.name if self.venue else 'No venue'
        return f"Event at {venue_name} ({self.start_date} - {self.end_date})"
