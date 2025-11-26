import os
import django
from datetime import time, date, timedelta

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

print("⚡ Seeding database...\n")


# ---------------------------------------------------------
# CREATE REFEREES
# ---------------------------------------------------------
def create_ref(username, grade, county):
    user, _ = User.objects.get_or_create(
        username=username,
        defaults={
            "email": f"{username}@example.com",
            "password": "pbkdf2_sha256$fakehashedpass"
        }
    )
    profile, _ = RefereeProfile.objects.get_or_create(
        user=user,
        defaults={
            "grade": grade,
            "experience_years": 3,
            "county": county
        }
    )
    UserRole.objects.get_or_create(user=user, role="referee")
    return user, profile


ref1_user, ref1 = create_ref("ref_john", "Grade 2", "Dublin")
ref2_user, ref2 = create_ref("ref_sarah", "Grade 1", "Cork")
ref3_user, ref3 = create_ref("ref_mark", "Grade 3", "Galway")

print("✓ Referees created")


# ---------------------------------------------------------
# WEEKLY AVAILABILITY
# ---------------------------------------------------------
availability_template = [
    ("monday", time(10, 0), time(17, 0)),
    ("wednesday", time(17, 0), time(22, 0)),
    ("friday", time(14, 0), time(20, 0)),
]

for ref in [ref1, ref2, ref3]:
    for day, start, end in availability_template:
        RefereeAvailabilityWeekly.objects.get_or_create(
            referee=ref,
            day_of_week=day,
            defaults={"start_time": start, "end_time": end, "available": True}
        )

print("✓ Weekly availability added")


# ---------------------------------------------------------
# UNAVAILABLE DATES
# ---------------------------------------------------------
RefereeUnavailableDate.objects.get_or_create(
    referee=ref1,
    date=date.today() + timedelta(days=2),
    defaults={"start_time": time(13, 0), "end_time": time(18, 0)}
)

print("✓ Unavailable dates added")


# ---------------------------------------------------------
# GAME CATEGORIES
# ---------------------------------------------------------
cat1, _ = GameCategory.objects.get_or_create(name="Appointed")
cat2, _ = GameCategory.objects.get_or_create(name="Club")
cat3, _ = GameCategory.objects.get_or_create(name="School")

print("✓ Game categories added")


# ---------------------------------------------------------
# COMPETITIONS
# ---------------------------------------------------------
comp1, _ = Competition.objects.get_or_create(name="U18 Boys League")
comp2, _ = Competition.objects.get_or_create(name="U14 Girls Cup")
comp3, _ = Competition.objects.get_or_create(name="National League D1")

print("✓ Competitions added")


# ---------------------------------------------------------
# TEAMS
# ---------------------------------------------------------
team1, _ = Team.objects.get_or_create(name="Killester", county="Dublin")
team2, _ = Team.objects.get_or_create(name="Templeogue", county="Dublin")
team3, _ = Team.objects.get_or_create(name="Liffey Celtics", county="Kildare")
team4, _ = Team.objects.get_or_create(name="Maree", county="Galway")

print("✓ Teams added")


# ---------------------------------------------------------
# GAMES (WITH 3 REF SLOTS)
# ---------------------------------------------------------
game1 = Game.objects.create(
    category=cat1,
    game_number="M12-1023",
    competition=comp1,
    team_home=team1,
    team_away=team2,
    date=date.today() + timedelta(days=1),
    time=time(17, 0),
    referees_required=2,
    must_be_graded=True,
    game_fee=25.00,
    location_name="National Basketball Arena",
    latitude=53.3045,
    longitude=-6.3293,
    uploaded_by=ref1_user,
    crew_chief=ref1,
    umpire1=ref2,
    umpire2=None
)

game2 = Game.objects.create(
    category=cat2,
    game_number="C09-884",
    competition=comp2,
    team_home=team3,
    team_away=team2,
    date=date.today() + timedelta(days=3),
    time=time(19, 30),
    referees_required=1,
    game_fee=20.00,
    location_name="Kildare Sports Hall",
    latitude=53.1378,
    longitude=-6.9145,
    uploaded_by=ref2_user,
    crew_chief=ref3,
    umpire1=None,
    umpire2=None
)

print("✓ Games created with referee slots")


# ---------------------------------------------------------
# COVER REQUEST
# ---------------------------------------------------------
CoverRequest.objects.create(
    game=game1,
    referee=ref1,
    status="pending"
)

print("✓ Cover request added")


# ---------------------------------------------------------
# EVENT
# ---------------------------------------------------------
Event.objects.create(
    event_name="U16 National Blitz",
    description="Weekend tournament for youth athletes",
    start_date=date.today() + timedelta(days=6),
    end_date=date.today() + timedelta(days=7),
    contact_info="coach@example.com",
    referees_required=6,
    payment_type="per referee",
    payment_amount=150.00,
    uploaded_by=ref3_user
)

print("✓ Event created")
print("\n🎉 SEEDING COMPLETE!")
