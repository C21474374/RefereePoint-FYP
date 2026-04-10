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

    class AccountType(models.TextChoices):
        REFEREE = "REFEREE", "Referee"
        CLUB = "CLUB", "Club"
        SCHOOL = "SCHOOL", "School"
        COLLEGE = "COLLEGE", "College"
        DOA = "DOA", "DOA"
        NL = "NL", "National League"

    class ManagerScope(models.TextChoices):
        NONE = "NONE", "None"
        CLUB = "CLUB", "Club"
        SCHOOL = "SCHOOL", "School"
        COLLEGE = "COLLEGE", "College"
    
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    bipin_number = models.CharField(max_length=50, blank=True, null=True)
    account_type = models.CharField(
        max_length=30,
        choices=AccountType.choices,
        default=AccountType.REFEREE,
    )
    is_team_manager = models.BooleanField(default=False)
    manager_scope = models.CharField(
        max_length=20,
        choices=ManagerScope.choices,
        default=ManagerScope.NONE,
    )
    managed_team = models.ForeignKey(
        "clubs.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managers",
    )
    organization_name = models.CharField(max_length=200, blank=True, default="")
    verification_id_number = models.CharField(max_length=120, blank=True, default="")
    verification_id_photo = models.FileField(
        upload_to="verification_ids/",
        blank=True,
        null=True,
    )
    institution_head_phone = models.CharField(max_length=30, blank=True, default="")
    bipin_verified = models.BooleanField(default=False)
    doa_approved = models.BooleanField(default=False)
    home_address = models.TextField(blank=True, default="")
    home_lat = models.FloatField(null=True, blank=True)
    home_lon = models.FloatField(null=True, blank=True)
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

    def is_approved_for_uploads(self):
        """
        Approval gate for upload permissions.
        - All roles require manual admin approval.
        - BIPIN-based roles also require BIPIN verification.
        - School/College use photo-ID verification instead of BIPIN.
        """
        if not self.doa_approved:
            return False

        bipin_roles = {
            self.AccountType.REFEREE,
            self.AccountType.CLUB,
            self.AccountType.DOA,
            self.AccountType.NL,
        }
        photo_id_roles = {
            self.AccountType.SCHOOL,
            self.AccountType.COLLEGE,
        }

        if self.account_type in bipin_roles:
            return bool(self.bipin_verified)

        if self.account_type in photo_id_roles:
            return bool(self.verification_id_photo)

        return False

    def get_allowed_upload_game_types(self):
        from games.models import Game

        if not self.is_approved_for_uploads():
            return set()

        account_type_mapping = {
            self.AccountType.CLUB: {
                Game.GameType.CLUB,
                Game.GameType.FRIENDLY,
            },
            self.AccountType.SCHOOL: {
                Game.GameType.SCHOOL,
                Game.GameType.FRIENDLY,
            },
            self.AccountType.COLLEGE: {
                Game.GameType.COLLEGE,
                Game.GameType.FRIENDLY,
            },
            self.AccountType.DOA: {
                Game.GameType.DOA,
            },
            self.AccountType.NL: {
                Game.GameType.NL,
            },
        }

        manager_scope_mapping = {
            self.ManagerScope.CLUB: {
                Game.GameType.CLUB,
                Game.GameType.FRIENDLY,
            },
            self.ManagerScope.SCHOOL: {
                Game.GameType.SCHOOL,
                Game.GameType.FRIENDLY,
            },
            self.ManagerScope.COLLEGE: {
                Game.GameType.COLLEGE,
                Game.GameType.FRIENDLY,
            },
        }

        allowed_types = set(account_type_mapping.get(self.account_type, set()))

        if self.is_team_manager and self.manager_scope != self.ManagerScope.NONE:
            allowed_types.update(manager_scope_mapping.get(self.manager_scope, set()))

        return allowed_types

    def get_allowed_upload_event_types(self):
        """
        Event uploader scope. Referees do not upload events unless they also
        carry a manager scope.
        """
        if not self.is_approved_for_uploads():
            return set()

        account_scope = {
            self.AccountType.CLUB: {"CLUB"},
            self.AccountType.SCHOOL: {"SCHOOL"},
            self.AccountType.COLLEGE: {"COLLEGE"},
        }

        manager_scope = {
            self.ManagerScope.CLUB: {"CLUB"},
            self.ManagerScope.SCHOOL: {"SCHOOL"},
            self.ManagerScope.COLLEGE: {"COLLEGE"},
        }

        allowed = set(account_scope.get(self.account_type, set()))
        if self.is_team_manager and self.manager_scope != self.ManagerScope.NONE:
            allowed.update(manager_scope.get(self.manager_scope, set()))

        return allowed


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
    
    grade = models.CharField(max_length=20, choices=GRADE_CHOICES, default='INTRO')
    appointed_availability_pending = models.JSONField(default=list, blank=True)
    appointed_availability_effective_from = models.DateField(null=True, blank=True)
    
    
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
