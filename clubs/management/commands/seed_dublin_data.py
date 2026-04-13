from __future__ import annotations

from dataclasses import dataclass

from django.core.management.base import BaseCommand
from django.db import transaction

from clubs.models import Club, Division, Team
from college.models import College, CollegeDivision, CollegeTeam
from schools.models import School, SchoolDivision, SchoolTeam


NL_TEAMS_BY_DIVISION = {
    "Super League": [
        "Killester",
        "Griffith College Eanna",
        "UCD Marian",
        "St Vincents",
    ],
    "Division 1": [
        "Dublin Lions",
        "Moy Tolka Rovers",
        "KUBS",
        "Templeogue",
    ],
}

CLUB_MEN_TEAMS_BY_DIVISION = {
    "Division 1": ["Killester", "Templeogue", "Eanna"],
    "Division 2": ["KUBS", "Tolka Rovers"],
    "Division 3": ["Dublin Lions", "Raiders"],
    "Division 4": ["Eanna", "Templeogue"],
    "Division 5": ["Killester"],
    "Division 6": ["Raiders"],
    "Division 7": ["Development"],
}

CLUB_WOMEN_TEAMS_BY_DIVISION = {
    "Division 1": ["Killester", "Eanna"],
    "Division 2": ["Templeogue", "KUBS"],
    "Division 3": ["Tolka Rovers"],
    "Division 4": ["Raiders"],
    "Division 5": ["Eanna"],
    "Division 6": ["Templeogue"],
    "Division 7": ["Development"],
}

CLUB_YOUTH_TEAMS_BY_DIVISION = {
    "U12": ["Killester", "Eanna"],
    "U13": ["Templeogue", "KUBS"],
    "U14": ["Raiders", "Tolka Rovers"],
    "U15": ["Eanna", "Killester"],
    "U16(1)": ["Templeogue", "KUBS"],
    "U16(2)": ["Raiders", "Eanna"],
    "U17(1)": ["Killester", "Templeogue"],
    "U17(2)": ["KUBS", "Raiders"],
    "U18": ["Eanna", "Tolka Rovers"],
    "U19": ["Killester", "Templeogue"],
    "U20": ["KUBS", "Eanna"],
}

SCHOOLS_BY_DIVISION = {
    "U19 A": [
        "St Vincents Secondary School",
        "Colaiste Eanna",
        "Templeogue College",
    ],
    "U19 B": [
        "St Aidans CBS",
        "Oatlands College",
    ],
    "U16 A": [
        "St Declans College",
        "Belvedere College",
    ],
    "U16 B": [
        "Colaiste Bride",
        "St Marks Community School",
    ],
}

COLLEGES_BY_DIVISION = {
    "Varsity": [
        "Trinity College Dublin",
        "UCD Marian",
        "DCU Saints",
        "TU Dublin",
    ]
}


@dataclass
class SeedStats:
    clubs_created: int = 0
    clubs_updated: int = 0
    divisions_created: int = 0
    divisions_updated: int = 0
    teams_created: int = 0
    teams_updated: int = 0
    schools_created: int = 0
    schools_updated: int = 0
    school_divisions_created: int = 0
    school_divisions_updated: int = 0
    school_teams_created: int = 0
    school_teams_updated: int = 0
    colleges_created: int = 0
    colleges_updated: int = 0
    college_divisions_created: int = 0
    college_divisions_updated: int = 0
    college_teams_created: int = 0
    college_teams_updated: int = 0


class Command(BaseCommand):
    help = (
        "Seed Dublin reference data for clubs/NL/schools/colleges. "
        "Safe to run multiple times."
    )

    def _get_or_create_club(self, name: str, stats: SeedStats) -> Club:
        club = Club.objects.filter(name__iexact=name).first()
        if not club:
            stats.clubs_created += 1
            return Club.objects.create(name=name)
        if club.name != name:
            club.name = name
            club.save(update_fields=["name"])
            stats.clubs_updated += 1
        return club

    def _get_or_create_division(
        self,
        name: str,
        gender: str,
        requires_appointed_referees: bool,
        stats: SeedStats,
    ) -> Division:
        division = Division.objects.filter(name__iexact=name, gender=gender).first()
        if not division:
            stats.divisions_created += 1
            return Division.objects.create(
                name=name,
                gender=gender,
                requires_appointed_referees=requires_appointed_referees,
                is_active=True,
            )

        changed = False
        if division.name != name:
            division.name = name
            changed = True
        if division.requires_appointed_referees != requires_appointed_referees:
            division.requires_appointed_referees = requires_appointed_referees
            changed = True
        if not division.is_active:
            division.is_active = True
            changed = True
        if changed:
            division.save(
                update_fields=["name", "requires_appointed_referees", "is_active"]
            )
            stats.divisions_updated += 1
        return division

    def _get_or_create_team(self, club: Club, division: Division, stats: SeedStats) -> Team:
        team = Team.objects.filter(club=club, division=division).first()
        if not team:
            stats.teams_created += 1
            return Team.objects.create(club=club, division=division, is_active=True)
        if not team.is_active:
            team.is_active = True
            team.save(update_fields=["is_active"])
            stats.teams_updated += 1
        return team

    def _get_or_create_school(self, name: str, stats: SeedStats) -> School:
        school = School.objects.filter(name__iexact=name).first()
        if not school:
            stats.schools_created += 1
            return School.objects.create(name=name)
        if school.name != name:
            school.name = name
            school.save(update_fields=["name"])
            stats.schools_updated += 1
        return school

    def _get_or_create_school_division(
        self,
        name: str,
        stats: SeedStats,
    ) -> SchoolDivision:
        division = SchoolDivision.objects.filter(name__iexact=name, gender="M").first()
        if not division:
            stats.school_divisions_created += 1
            return SchoolDivision.objects.create(
                name=name,
                gender="M",
                requires_appointed_referees=False,
                is_active=True,
            )

        changed = False
        if division.name != name:
            division.name = name
            changed = True
        if division.requires_appointed_referees:
            division.requires_appointed_referees = False
            changed = True
        if not division.is_active:
            division.is_active = True
            changed = True
        if changed:
            division.save(
                update_fields=["name", "requires_appointed_referees", "is_active"]
            )
            stats.school_divisions_updated += 1
        return division

    def _get_or_create_school_team(
        self,
        school: School,
        division: SchoolDivision,
        stats: SeedStats,
    ) -> SchoolTeam:
        team = SchoolTeam.objects.filter(school=school, division=division).first()
        if not team:
            stats.school_teams_created += 1
            return SchoolTeam.objects.create(
                school=school,
                division=division,
                is_active=True,
            )
        if not team.is_active:
            team.is_active = True
            team.save(update_fields=["is_active"])
            stats.school_teams_updated += 1
        return team

    def _get_or_create_college(self, name: str, stats: SeedStats) -> College:
        college = College.objects.filter(name__iexact=name).first()
        if not college:
            stats.colleges_created += 1
            return College.objects.create(name=name)
        if college.name != name:
            college.name = name
            college.save(update_fields=["name"])
            stats.colleges_updated += 1
        return college

    def _get_or_create_college_division(
        self,
        name: str,
        stats: SeedStats,
    ) -> CollegeDivision:
        division = CollegeDivision.objects.filter(name__iexact=name, gender="M").first()
        if not division:
            stats.college_divisions_created += 1
            return CollegeDivision.objects.create(
                name=name,
                gender="M",
                requires_appointed_referees=False,
                is_active=True,
            )

        changed = False
        if division.name != name:
            division.name = name
            changed = True
        if division.requires_appointed_referees:
            division.requires_appointed_referees = False
            changed = True
        if not division.is_active:
            division.is_active = True
            changed = True
        if changed:
            division.save(
                update_fields=["name", "requires_appointed_referees", "is_active"]
            )
            stats.college_divisions_updated += 1
        return division

    def _get_or_create_college_team(
        self,
        college: College,
        division: CollegeDivision,
        stats: SeedStats,
    ) -> CollegeTeam:
        team = CollegeTeam.objects.filter(college=college, division=division).first()
        if not team:
            stats.college_teams_created += 1
            return CollegeTeam.objects.create(
                college=college,
                division=division,
                is_active=True,
            )
        if not team.is_active:
            team.is_active = True
            team.save(update_fields=["is_active"])
            stats.college_teams_updated += 1
        return team

    @transaction.atomic
    def handle(self, *args, **options):
        stats = SeedStats()

        # NL teams (appointed divisions).
        for division_name, club_names in NL_TEAMS_BY_DIVISION.items():
            division = self._get_or_create_division(
                name=division_name,
                gender="M",
                requires_appointed_referees=True,
                stats=stats,
            )
            for club_name in club_names:
                club = self._get_or_create_club(club_name, stats=stats)
                self._get_or_create_team(club, division, stats=stats)

        # Club men divisions.
        for division_name, club_names in CLUB_MEN_TEAMS_BY_DIVISION.items():
            division = self._get_or_create_division(
                name=division_name,
                gender="M",
                requires_appointed_referees=False,
                stats=stats,
            )
            for club_name in club_names:
                club = self._get_or_create_club(club_name, stats=stats)
                self._get_or_create_team(club, division, stats=stats)

        # Club women divisions.
        for division_name, club_names in CLUB_WOMEN_TEAMS_BY_DIVISION.items():
            division = self._get_or_create_division(
                name=division_name,
                gender="F",
                requires_appointed_referees=False,
                stats=stats,
            )
            for club_name in club_names:
                club = self._get_or_create_club(club_name, stats=stats)
                self._get_or_create_team(club, division, stats=stats)

        # Club youth divisions (kept under clubs as requested).
        for division_name, club_names in CLUB_YOUTH_TEAMS_BY_DIVISION.items():
            division = self._get_or_create_division(
                name=division_name,
                gender="M",
                requires_appointed_referees=False,
                stats=stats,
            )
            for club_name in club_names:
                club = self._get_or_create_club(club_name, stats=stats)
                self._get_or_create_team(club, division, stats=stats)

        # Schools app seed data.
        for division_name, school_names in SCHOOLS_BY_DIVISION.items():
            division = self._get_or_create_school_division(division_name, stats=stats)
            for school_name in school_names:
                school = self._get_or_create_school(school_name, stats=stats)
                self._get_or_create_school_team(school, division, stats=stats)

        # College app seed data.
        for division_name, college_names in COLLEGES_BY_DIVISION.items():
            division = self._get_or_create_college_division(division_name, stats=stats)
            for college_name in college_names:
                college = self._get_or_create_college(college_name, stats=stats)
                self._get_or_create_college_team(college, division, stats=stats)

        self.stdout.write(self.style.SUCCESS("Dublin reference data seed completed."))
        self.stdout.write(
            (
                "Clubs created/updated: "
                f"{stats.clubs_created}/{stats.clubs_updated} | "
                "Divisions created/updated: "
                f"{stats.divisions_created}/{stats.divisions_updated} | "
                "Teams created/updated: "
                f"{stats.teams_created}/{stats.teams_updated}"
            )
        )
        self.stdout.write(
            (
                "Schools created/updated: "
                f"{stats.schools_created}/{stats.schools_updated} | "
                "School divisions created/updated: "
                f"{stats.school_divisions_created}/{stats.school_divisions_updated} | "
                "School teams created/updated: "
                f"{stats.school_teams_created}/{stats.school_teams_updated}"
            )
        )
        self.stdout.write(
            (
                "Colleges created/updated: "
                f"{stats.colleges_created}/{stats.colleges_updated} | "
                "College divisions created/updated: "
                f"{stats.college_divisions_created}/{stats.college_divisions_updated} | "
                "College teams created/updated: "
                f"{stats.college_teams_created}/{stats.college_teams_updated}"
            )
        )
