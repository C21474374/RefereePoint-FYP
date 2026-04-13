from django.db import models


class College(models.Model):
    """Colleges that can post college games/events."""

    name = models.CharField(max_length=255)

    class Meta:
        db_table = "college_college"

    def __str__(self):
        return self.name


class CollegeDivision(models.Model):
    """College divisions (e.g., U12 Male, U16 Female)."""

    GENDER_CHOICES = [
        ("M", "Male"),
        ("F", "Female"),
    ]

    name = models.CharField(max_length=50)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    requires_appointed_referees = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "college_division"

    def __str__(self):
        gender_code = {
            "M": "M",
            "F": "F",
        }.get(self.gender, self.gender)
        return f"{self.name}-{gender_code}"


class CollegeTeam(models.Model):
    """College teams that participate in games/events."""

    college = models.ForeignKey(
        College,
        on_delete=models.CASCADE,
        related_name="teams",
    )
    division = models.ForeignKey(
        CollegeDivision,
        on_delete=models.CASCADE,
        related_name="teams",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "college_team"

    def __str__(self):
        return f"{self.college.name} - {self.division.name}"
