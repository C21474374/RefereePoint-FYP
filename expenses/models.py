from django.core.validators import MinValueValidator
from django.db import models


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
