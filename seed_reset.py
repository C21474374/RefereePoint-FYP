import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "refereepoint.settings")
django.setup()

from django.contrib.auth.models import User
from users.models import (
    UserRole,
    RefereeProfile,
    RefereeAvailabilityWeekly,
    RefereeUnavailableDate
)
from games.models import (
    GameCategory,
    Competition,
    Team,
    Game,
    CoverRequest,
    Event
)

print("⚠️ RESETTING DATABASE...\n")


# ---------------------------------------------------------
# DELETE GAME DATA
# ---------------------------------------------------------
print("🗑 Clearing game-related data...")

CoverRequest.objects.all().delete()
Game.objects.all().delete()
Event.objects.all().delete()
Team.objects.all().delete()
Competition.objects.all().delete()
GameCategory.objects.all().delete()

print("✓ Game, competition, team, category, event cleared\n")


# ---------------------------------------------------------
# DELETE USER + REFEREE DATA
# ---------------------------------------------------------
print("🗑 Clearing referee + user data...")

RefereeAvailabilityWeekly.objects.all().delete()
RefereeUnavailableDate.objects.all().delete()
RefereeProfile.objects.all().delete()
UserRole.objects.all().delete()

# Leave superuser alone — delete only normal users
User.objects.filter(is_superuser=False).delete()

print("✓ Referee profiles, roles, availability, unavailability cleared")
print("✓ Non-superuser accounts removed\n")

print("🎉 RESET COMPLETE — Ready for seed.py!")
