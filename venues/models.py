from django.db import models


class Venue(models.Model):
    """Venues for managing venue details and locations."""
    
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)
    club = models.ForeignKey(
        'clubs.Club',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='venues'
    )
    
    class Meta:
        db_table = 'venues_venue'

    def __str__(self):
        return self.name
