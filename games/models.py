from django.db import models
from django.contrib.auth.models import User
from users.models import RefereeProfile

class GameCategory(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name

class Competition(models.Model):
    name = models.CharField(max_length=255, unique=True)
    can_ref_cancel = models.BooleanField(default=False)  

    def __str__(self):
        return self.name



class Team(models.Model):
    name = models.CharField(max_length=255, unique=True)
    county = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return self.name


class Game(models.Model):
    category = models.ForeignKey(GameCategory, on_delete=models.CASCADE, related_name='games')
    game_number = models.CharField(max_length=50, blank=True)
    competition = models.ForeignKey(
        Competition,
        on_delete=models.SET_NULL,
        null=True,
        related_name='games'
    )

    team_home = models.ForeignKey(
        Team,
        on_delete=models.SET_NULL,
        null=True,
        related_name='home_games'
    )

    team_away = models.ForeignKey(
        Team,
        on_delete=models.SET_NULL,
        null=True,
        related_name='away_games'
    )


    date = models.DateField()
    time = models.TimeField()

    referees_required = models.IntegerField(default=1)
    must_be_graded = models.BooleanField(default=False)
    game_fee = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    location_name = models.CharField(max_length=255)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    crew_chief = models.ForeignKey(
    "users.RefereeProfile",
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='games_as_crew_chief'
    )

    umpire1 = models.ForeignKey(
        "users.RefereeProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='games_as_umpire1'
    )

    umpire2 = models.ForeignKey(
        "users.RefereeProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='games_as_umpire2'
    )


    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_games'
    )

    def __str__(self):
        return f"{self.competition} - {self.team_home} vs {self.team_away}"






class CoverRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
    ]

    game = models.ForeignKey("games.Game", on_delete=models.CASCADE, related_name='cover_requests')
    referee = models.ForeignKey("users.RefereeProfile", on_delete=models.CASCADE, related_name='cover_requests')
    
    # pending or accepted
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # referee who accepted the cover
    accepted_by = models.ForeignKey(
        "users.RefereeProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='covers_accepted'
    )
    
    accepted_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Cover request for {self.game} by {self.referee.user.username}"




class Event(models.Model):
    event_name = models.CharField(max_length=255)
    description = models.TextField()
    start_date = models.DateField()
    end_date = models.DateField()
    contact_info = models.CharField(max_length=255)
    referees_required = models.PositiveIntegerField(default=1)
    payment_type = models.CharField(max_length=50)  # per referee | per game
    payment_amount = models.DecimalField(max_digits=6, decimal_places=2)

    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_events'
    )

    def __str__(self):
        return self.event_name

class EventParticipation(models.Model):
    STATUS_CHOICES = [
        ("confirmed", "Confirmed"),
        ("waitlist", "Waitlist"),
    ]

    event = models.ForeignKey("Event", on_delete=models.CASCADE, related_name="participants")
    referee = models.ForeignKey(RefereeProfile, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="confirmed")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("event", "referee")

    def __str__(self):
        return f"{self.referee} → {self.event} ({self.status})"
