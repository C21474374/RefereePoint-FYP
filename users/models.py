from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    """Custom manager for User model with email as the unique identifier."""
    
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Users must have an email address')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom User model with email as the unique identifier."""
    
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    bipin_number = models.CharField(max_length=50, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name','bipin_number']
    
    class Meta:
        db_table = 'users_user'
    
    def __str__(self):
        return self.email
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"


class RefereeProfile(models.Model):
    """Profile for users who are referees."""
    
    GRADE_CHOICES = [
        ('INTRO', 'Intro'),
        ('GRADE_3', 'Grade 3'),
        ('GRADE_2', 'Grade 2'),
        ('GRADE_1', 'Grade 1'),
        ('FIBA', 'Fiba'),
        
    ]
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='referee_profile'
    )
    
    grade = models.CharField(max_length=20, choices=GRADE_CHOICES, default='TRAINEE')
    
    
    class Meta:
        db_table = 'users_referee_profile'
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.user.bipin_number}"


class RefereeAvailability(models.Model):
    """Availability slots for referees."""
    
    DAY_CHOICES = [
        ('MON', 'Monday'),
        ('TUE', 'Tuesday'),
        ('WED', 'Wednesday'),
        ('THU', 'Thursday'),
        ('FRI', 'Friday'),
        ('SAT', 'Saturday'),
        ('SUN', 'Sunday'),
    ]
    
    referee = models.ForeignKey(
        RefereeProfile,
        on_delete=models.CASCADE,
        related_name='availabilities'
    )
    day_of_week = models.CharField(max_length=3, choices=DAY_CHOICES, default='MON')
    start_time = models.TimeField()
    end_time = models.TimeField()
    
    class Meta:
        db_table = 'users_referee_availability'
        verbose_name_plural = 'Referee availabilities'
        ordering = ['day_of_week', 'start_time']
        constraints = [
            models.UniqueConstraint(
                fields=['referee', 'day_of_week'],
                name='unique_referee_availability'
            )
        ]
    
    def __str__(self):
        return f"{self.referee} - {self.get_day_of_week_display()} ({self.start_time} - {self.end_time})"
