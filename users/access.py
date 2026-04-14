from __future__ import annotations

from users.models import RefereeProfile, User


MANAGER_SCOPE_TO_ACCOUNT_ROLE = {
    User.ManagerScope.CLUB: User.AccountType.CLUB,
    User.ManagerScope.SCHOOL: User.AccountType.SCHOOL,
    User.ManagerScope.COLLEGE: User.AccountType.COLLEGE,
}


def has_referee_role(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return RefereeProfile.objects.filter(user_id=user.id).exists()


def get_effective_account_roles(user) -> set[str]:
    """
    Returns the union of roles that should be considered active for access control.

    This supports multi-role behavior such as:
    - account_type=REFEREE + manager_scope=CLUB => {"REFEREE", "CLUB"}
    """
    if not user or not getattr(user, "is_authenticated", False):
        return set()

    roles: set[str] = set()
    if user.account_type:
        roles.add(str(user.account_type).upper())

    if has_referee_role(user):
        roles.add(User.AccountType.REFEREE)

    if getattr(user, "is_team_manager", False):
        manager_scope = str(getattr(user, "manager_scope", "")).upper()
        mapped_role = MANAGER_SCOPE_TO_ACCOUNT_ROLE.get(manager_scope)
        if mapped_role:
            roles.add(mapped_role)

    return roles


def has_admin_approval_scope(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_staff", False):
        return True
    return (
        user.account_type in {User.AccountType.DOA, User.AccountType.NL}
        and bool(user.doa_approved)
    )

