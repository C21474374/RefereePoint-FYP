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
    REQUIRED_FIELDS = ['first_name', 'last_name']
    
    class Meta:
        db_table = 'users_user'
    
    def __str__(self):
        return self.email
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"


class RefereeProfile(models.Model):
    """Profile for users who are referees."""
    
    GRADE_CHOICES = [
        ('TRAINEE', 'Trainee'),
        ('LEVEL_1', 'Level 1'),
        ('LEVEL_2', 'Level 2'),
        ('LEVEL_3', 'Level 3'),
        ('NATIONAL', 'National'),
        ('INTERNATIONAL', 'International'),
    ]
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='referee_profile'
    )
    referee_number = models.CharField(max_length=50, unique=True)
    grade = models.CharField(max_length=20, choices=GRADE_CHOICES, default='TRAINEE')
    
    class Meta:
        db_table = 'users_referee_profile'
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.referee_number}"


class RefereeAvailability(models.Model):
    """Availability slots for referees."""
    
    referee = models.ForeignKey(
        RefereeProfile,
        on_delete=models.CASCADE,
        related_name='availabilities'
    )
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    
    class Meta:
        db_table = 'users_referee_availability'
        verbose_name_plural = 'Referee availabilities'
        ordering = ['date', 'start_time']
    
    def __str__(self):
        return f"{self.referee} - {self.date} ({self.start_time} - {self.end_time})"
