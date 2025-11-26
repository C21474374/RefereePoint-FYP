from django.db import models
from django.contrib.auth.models import User


class GameCategory(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class Game(models.Model):
    category = models.ForeignKey(GameCategory, on_delete=models.CASCADE, related_name='games')
    game_number = models.CharField(max_length=50, blank=True)
    competition = models.CharField(max_length=255)

    team_home = models.CharField(max_length=255)
    team_away = models.CharField(max_length=255)

    date = models.DateField()
    time = models.TimeField()

    referees_required = models.IntegerField(default=1)
    must_be_graded = models.BooleanField(default=False)
    game_fee = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    location_name = models.CharField(max_length=255)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_games'
    )

    def __str__(self):
        return f"{self.competition} - {self.team_home} vs {self.team_away}"


class GameAssignment(models.Model):
    game = models.ForeignKey("games.Game", on_delete=models.CASCADE, related_name='assignments')
    referee = models.ForeignKey("users.RefereeProfile", on_delete=models.CASCADE, related_name='assignments')
    accepted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.referee.user.username} → {self.game.game_number or self.game.id}"


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
    referees_required = models.IntegerField()
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