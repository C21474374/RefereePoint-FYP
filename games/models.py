from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


class Game(models.Model):
    """Individual basketball fixture."""

    class GameType(models.TextChoices):
        DOA = "DOA", "DOA"
        NL = "NL", "National League"
        NON_APPOINTED = "NON_APPOINTED", "Non-Appointed"
        FRIENDLY = "FRIENDLY", "Friendly"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        PARTIALLY_ASSIGNED = "PARTIALLY_ASSIGNED", "Partially Assigned"
        FULLY_ASSIGNED = "FULLY_ASSIGNED", "Fully Assigned"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    class PaymentType(models.TextChoices):
        CASH = "CASH", "Cash"
        REVOLUT = "REVOLUT", "Revolut"
        CLAIM = "CLAIM", "Claim"

    game_type = models.CharField(
        max_length=20,
        choices=GameType.choices,
    )
    status = models.CharField(
        max_length=25,
        choices=Status.choices,
        default=Status.OPEN,
    )
    payment_type = models.CharField(
        max_length=20,
        choices=PaymentType.choices,
        blank=True,
        null=True,
    )

    division = models.ForeignKey(
        "clubs.Division",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="games",
    )
    date = models.DateField()
    time = models.TimeField()

    venue = models.ForeignKey(
        "venues.Venue",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="games",
    )

    home_team = models.ForeignKey(
        "clubs.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="home_games",
    )
    away_team = models.ForeignKey(
        "clubs.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="away_games",
    )

    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="games_created",
    )
    notes = models.TextField(blank=True, default="")
    original_post_text = models.TextField(
        blank=True,
        default="",
        help_text="Original WhatsApp-style message used to create the game.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date", "time"]
        constraints = [
            models.CheckConstraint(
                condition=~Q(home_team=models.F("away_team")),
                name="games_home_away_must_differ",
            )
        ]

    def __str__(self):
        home = str(self.home_team) if self.home_team else "TBD"
        away = str(self.away_team) if self.away_team else "TBD"
        return f"{home} vs {away} - {self.date} {self.time}"

    def clean(self):
        super().clean()

        non_appointed_types = {
            self.GameType.NON_APPOINTED,
            self.GameType.FRIENDLY,
        }
        appointed_types = {
            self.GameType.DOA,
            self.GameType.NL,
        }

        if self.game_type in non_appointed_types:
            if self.payment_type not in {
                self.PaymentType.CASH,
                self.PaymentType.REVOLUT,
            }:
                raise ValidationError(
                    {
                        "payment_type": (
                            "Non-appointed and Friendly games must use Cash or Revolut."
                        )
                    }
                )

        elif self.game_type in appointed_types:
            if self.payment_type != self.PaymentType.CLAIM:
                raise ValidationError(
                    {
                        "payment_type": "Appointed games must use Claim."
                    }
                )

    @property
    def assigned_roles_count(self):
        return self.referee_assignments.count()

    @property
    def open_non_appointed_slots_count(self):
        return self.non_appointed_slots.filter(
            status=NonAppointedSlot.Status.OPEN,
            is_active=True,
        ).count()


class NonAppointedSlot(models.Model):
    """
    Open slot for a NON_APPOINTED or FRIENDLY game.

    Max per game:
    - 1 x CREW_CHIEF
    - 1 x UMPIRE_1
    """

    class Role(models.TextChoices):
        CREW_CHIEF = "CREW_CHIEF", "Crew Chief"
        UMPIRE_1 = "UMPIRE_1", "Umpire 1"

    class SourceType(models.TextChoices):
        CLUB = "CLUB", "Club"
        SCHOOL = "SCHOOL", "School"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        CLAIMED = "CLAIMED", "Claimed"
        CLOSED = "CLOSED", "Closed"
        CANCELLED = "CANCELLED", "Cancelled"

    game = models.ForeignKey(
        "games.Game",
        on_delete=models.CASCADE,
        related_name="non_appointed_slots",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
    )
    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )

    posted_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="non_appointed_slots_posted",
    )
    claimed_by = models.ForeignKey(
        "users.RefereeProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="non_appointed_slots_claimed",
    )

    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    claimed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["game__date", "game__time", "role"]
        constraints = [
            models.UniqueConstraint(
                fields=["game", "role"],
                name="unique_non_appointed_slot_role_per_game",
            )
        ]

    def __str__(self):
        return f"{self.game} - {self.get_role_display()}"

    def clean(self):
        super().clean()

        allowed_game_types = {
            Game.GameType.NON_APPOINTED,
            Game.GameType.FRIENDLY,
        }

        if self.game.game_type not in allowed_game_types:
            raise ValidationError(
                {
                    "game": (
                        "Non-appointed slots can only be created for "
                        "Non-Appointed or Friendly games."
                    )
                }
            )

        existing_slots = NonAppointedSlot.objects.filter(game=self.game).exclude(pk=self.pk)
        if existing_slots.count() >= 2:
            raise ValidationError(
                {"game": "A non-appointed game can have a maximum of 2 slots."}
            )

        if self.claimed_by and self.role == self.Role.CREW_CHIEF:
            if self.claimed_by.grade == "INTRO":
                raise ValidationError(
                    {"claimed_by": "An Intro referee cannot claim Crew Chief."}
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class RefereeAssignment(models.Model):
    """Assigned referee roles for a game."""

    class Role(models.TextChoices):
        CREW_CHIEF = "CREW_CHIEF", "Crew Chief"
        UMPIRE_1 = "UMPIRE_1", "Umpire 1"
        UMPIRE_2 = "UMPIRE_2", "Umpire 2"

    game = models.ForeignKey(
        "games.Game",
        on_delete=models.CASCADE,
        related_name="referee_assignments",
    )
    referee = models.ForeignKey(
        "users.RefereeProfile",
        on_delete=models.CASCADE,
        related_name="game_assignments",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
    )

    class Meta:
        ordering = ["game__date", "game__time", "role"]
        constraints = [
            models.UniqueConstraint(
                fields=["game", "role"],
                name="unique_assignment_role_per_game",
            )
        ]

    def __str__(self):
        return f"{self.game} - {self.get_role_display()} - {self.referee}"

    def clean(self):
        super().clean()

        if self.role == self.Role.CREW_CHIEF and self.referee.grade == "INTRO":
            raise ValidationError(
                {"referee": "An Intro referee cannot be assigned as Crew Chief."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)