from django.db import models
from django.contrib.auth.models import User


class UserRole(models.Model):
    ROLE_CHOICES = [
        ('referee', 'Referee'),
        ('officer', 'Appointments Officer'),
        ('admin', 'Admin'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='roles')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)

    def __str__(self):
        return f"{self.user.username} - {self.role}"


class RefereeProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='referee_profile')
    grade = models.CharField(max_length=20)
    experience_years = models.IntegerField(default=0)
    phone_number = models.CharField(max_length=20, blank=True)
    county = models.CharField(max_length=50, blank=True)
    bio = models.TextField(blank=True)

    def __str__(self):
        return self.user.username


class RefereeAvailabilityWeekly(models.Model):
    DAY_CHOICES = [
        ('monday', 'Monday'),
        ('tuesday', 'Tuesday'),
        ('wednesday', 'Wednesday'),
        ('thursday', 'Thursday'),
        ('friday', 'Friday'),
        ('saturday', 'Saturday'),
        ('sunday', 'Sunday'),
    ]

    referee = models.ForeignKey(
        "RefereeProfile",
        on_delete=models.CASCADE,
        related_name='weekly_availability'
    )
    day_of_week = models.CharField(max_length=20, choices=DAY_CHOICES)
    
    # Availability times
    start_time = models.TimeField()
    end_time = models.TimeField()

    available = models.BooleanField(default=True)

    class Meta:
        unique_together = ('referee', 'day_of_week')

    def __str__(self):
        return f"{self.referee.user.username} - {self.day_of_week}: {self.start_time}-{self.end_time}"


class RefereeUnavailableDate(models.Model):
    referee = models.ForeignKey(
        "RefereeProfile",
        on_delete=models.CASCADE,
        related_name='unavailable_dates'
    )
    date = models.DateField()
    
    # Unavailable time window
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        unique_together = ('referee', 'date', 'start_time', 'end_time')

    def __str__(self):
        return f"{self.referee.user.username} unavailable on {self.date} from {self.start_time} to {self.end_time}"
