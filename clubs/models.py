from django.db import models


class Club(models.Model):
    """Clubs that participate in games/events."""
    
    name = models.CharField(max_length=255)
    
    class Meta:
        db_table = 'clubs_club'
    
    def __str__(self):
        return self.name


class Division(models.Model):
    """Different divisions/age groups (e.g., U12 Male, U16 Female, O40s Mixed)."""
    
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('MIXED', 'Mixed'),
    ]
    
    name = models.CharField(max_length=50)  # e.g., U12, U14, U16, O40s, Senior
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    requires_appointed_referees = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'clubs_division'
    
    def __str__(self):
        return f"{self.name} ({self.get_gender_display()})"


class Team(models.Model):
    """Teams that participate in games/events."""
    
    club = models.ForeignKey(
        Club,
        on_delete=models.CASCADE,
        related_name='teams'
    )
    division = models.ForeignKey(
        Division,
        on_delete=models.CASCADE,
        related_name='teams'
    )
    
    class Meta:
        db_table = 'clubs_team'
    
    def __str__(self):
        return f"{self.club.name} - {self.division.name}"
