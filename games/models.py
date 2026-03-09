from django.db import models


class Game(models.Model):
    """Individual games/matches."""
    
    GAME_TYPE_CHOICES = [
        ('DOA', 'DOA'),
        ('NL', 'National League'),
        ('SCHOOL', 'School'),
        ('CLUB', 'Club'),
        ('FRIENDLY', 'Friendly'),
    ]
    
    game_type = models.CharField(max_length=20, choices=GAME_TYPE_CHOICES)
    division = models.ForeignKey(
        'clubs.Division',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='games'
    )
    date = models.DateField()
    time = models.TimeField()
    venue = models.ForeignKey(
        'venues.Venue',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='games'
    )
    home_team = models.ForeignKey(
        'clubs.Team',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='home_games'
    )
    away_team = models.ForeignKey(
        'clubs.Team',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='away_games'
    )
    
    class Meta:
        db_table = 'games_game'
        ordering = ['date', 'time']
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(home_team=models.F('away_team')),
                name='home_away_different'
            )
        ]
    
    def __str__(self):
        home = self.home_team.club.name if self.home_team else 'TBD'
        away = self.away_team.club.name if self.away_team else 'TBD'
        return f"{home} vs {away} - {self.date}"


class RefereeAssignment(models.Model):
    """Referee assignments for games."""
    
    ROLE_CHOICES = [
        ('CREW_CHIEF', 'Crew Chief'),
        ('UMPIRE_1', 'Umpire 1'),
        ('UMPIRE_2', 'Umpire 2'),
    ]
    
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name='referee_assignments'
    )
    referee = models.ForeignKey(
        'users.RefereeProfile',
        on_delete=models.CASCADE,
        related_name='game_assignments'
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    
    class Meta:
        db_table = 'games_referee_assignment'
        unique_together = ['game', 'role']  # One referee per role per game
    
    def __str__(self):
        return f"{self.game} - {self.get_role_display()}: {self.referee}"
