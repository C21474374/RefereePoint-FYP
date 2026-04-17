from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class ExpenseRecord(models.Model):
    class TravelSource(models.TextChoices):
        MILEAGE = "MILEAGE", "Mileage"
        PUBLIC_TRANSPORT = "PUBLIC_TRANSPORT", "Public Transport"
        BACK_TO_BACK_SAME_VENUE = "BACK_TO_BACK_SAME_VENUE", "Back-to-back same venue"

    assignment = models.OneToOneField(
        "games.RefereeAssignment",
        on_delete=models.CASCADE,
        related_name="expense_record",
    )
    game = models.ForeignKey(
        "games.Game",
        on_delete=models.CASCADE,
        related_name="expense_records",
    )
    referee = models.ForeignKey(
        "users.RefereeProfile",
        on_delete=models.CASCADE,
        related_name="expense_records",
    )
    base_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    travel_mode = models.CharField(
        max_length=20,
        choices=[
            ("MILEAGE", "Mileage"),
            ("PUBLIC_TRANSPORT", "Public Transport"),
        ],
        default="MILEAGE",
    )
    travel_source = models.CharField(
        max_length=40,
        choices=TravelSource.choices,
        default=TravelSource.MILEAGE,
    )
    mileage_km = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    travel_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    public_transport_fare = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )
    is_back_to_back_same_venue = models.BooleanField(default=False)
    missing_distance_data = models.BooleanField(default=False)
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    calculated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["game__date", "game__time", "assignment__id"]
        db_table = "expenses_expense_record"

    def __str__(self):
        return f"Expense {self.assignment_id} - {self.total_amount}"


class MonthlyEarningsSnapshot(models.Model):
    referee = models.ForeignKey(
        "users.RefereeProfile",
        on_delete=models.CASCADE,
        related_name="monthly_earnings_snapshots",
    )
    game_type = models.CharField(
        max_length=20,
        choices=[
            ("DOA", "DOA"),
            ("NL", "National League"),
        ],
    )
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    games_count = models.PositiveIntegerField(default=0)
    base_fee_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    travel_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    mileage_km_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    total_claim_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    missing_distance_games = models.PositiveIntegerField(default=0)
    items_snapshot = models.JSONField(default=list, blank=True)
    finalized_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "expenses_monthly_earnings_snapshot"
        ordering = ["-year", "-month", "game_type"]
        constraints = [
            models.UniqueConstraint(
                fields=["referee", "game_type", "year", "month"],
                name="unique_monthly_earnings_snapshot_per_ref_type",
            ),
            models.CheckConstraint(
                condition=models.Q(month__gte=1) & models.Q(month__lte=12),
                name="expenses_monthly_snapshot_month_range",
            ),
        ]

    def __str__(self):
        return (
            f"{self.referee} | {self.game_type} | "
            f"{self.year}-{str(self.month).zfill(2)} | {self.total_claim_amount}"
        )


class MonthlyPaymentApproval(models.Model):
    """Tracks admin-confirmed monthly payments for appointed referee earnings."""

    referee = models.ForeignKey(
        "users.RefereeProfile",
        on_delete=models.CASCADE,
        related_name="monthly_payment_approvals",
    )
    game_type = models.CharField(
        max_length=20,
        choices=[
            ("DOA", "DOA"),
            ("NL", "National League"),
        ],
    )
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    games_count = models.PositiveIntegerField(default=0)
    total_claim_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    confirmed_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="monthly_payments_confirmed",
    )
    confirmed_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "expenses_monthly_payment_approval"
        ordering = ["-year", "-month", "-confirmed_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["referee", "game_type", "year", "month"],
                name="unique_monthly_payment_approval_per_ref_type",
            ),
            models.CheckConstraint(
                condition=models.Q(month__gte=1) & models.Q(month__lte=12),
                name="expenses_payment_approval_month_range",
            ),
        ]

    def __str__(self):
        return (
            f"{self.referee} | {self.game_type} | "
            f"{self.year}-{str(self.month).zfill(2)} | {self.total_claim_amount}"
        )
