from django.db import models


class Venue(models.Model):
    fid = models.AutoField(primary_key=True, db_column='fid')
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255, blank=True, null=True)
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = 'venues_venue'
        managed = False

    def __str__(self):
        return self.name
