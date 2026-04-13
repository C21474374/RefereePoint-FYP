from django.db import models


class School(models.Model):
    """Schools that can post school games/events."""

    name = models.CharField(max_length=255)

    class Meta:
        db_table = "schools_school"

    def __str__(self):
        return self.name


class SchoolDivision(models.Model):
    """School divisions (e.g., U12 Male, U16 Female)."""

    GENDER_CHOICES = [
        ("M", "Male"),
        ("F", "Female"),
    ]

    name = models.CharField(max_length=50)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    requires_appointed_referees = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "schools_division"

    def __str__(self):
        gender_code = {
            "M": "M",
            "F": "F",
        }.get(self.gender, self.gender)
        return f"{self.name}-{gender_code}"


class SchoolTeam(models.Model):
    """School teams that participate in games/events."""

    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="teams",
    )
    division = models.ForeignKey(
        SchoolDivision,
        on_delete=models.CASCADE,
        related_name="teams",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "schools_team"

    def __str__(self):
        return f"{self.school.name} - {self.division.name}"
