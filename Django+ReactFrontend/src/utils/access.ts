import type { AccountType, CurrentUser } from "../services/auth";

const MANAGER_SCOPE_ROLES: AccountType[] = ["CLUB", "SCHOOL", "COLLEGE"];

export function getEffectiveRoles(user: CurrentUser | null | undefined): Set<AccountType> {
  const roles = new Set<AccountType>();
  if (!user) {
    return roles;
  }

  if (Array.isArray(user.effective_roles) && user.effective_roles.length > 0) {
    user.effective_roles.forEach((role) => roles.add(role));
    return roles;
  }

  if (user.account_type) {
    roles.add(user.account_type);
  }

  if (user.referee_profile) {
    roles.add("REFEREE");
  }

  const managerScope = String(user.manager_scope || "").toUpperCase() as AccountType;
  if (user.is_team_manager && MANAGER_SCOPE_ROLES.includes(managerScope)) {
    roles.add(managerScope);
  }

  return roles;
}

export function hasRefereeAccess(user: CurrentUser | null | undefined) {
  return getEffectiveRoles(user).has("REFEREE");
}

export function hasGameUploadAccess(user: CurrentUser | null | undefined) {
  return Boolean(user?.allowed_upload_game_types?.length);
}

export function hasEventUploadAccess(user: CurrentUser | null | undefined) {
  return Boolean(user?.allowed_upload_event_types?.length);
}

export function canAccessGamesPage(user: CurrentUser | null | undefined) {
  return hasRefereeAccess(user) || hasGameUploadAccess(user);
}

export function canAccessCoverRequestsPage(user: CurrentUser | null | undefined) {
  if (hasRefereeAccess(user)) {
    return true;
  }

  const roles = getEffectiveRoles(user);
  return (
    Boolean(user?.can_approve_accounts) ||
    (Boolean(user?.doa_approved) && (roles.has("DOA") || roles.has("NL")))
  );
}

export function canAccessEventsPage(user: CurrentUser | null | undefined) {
  return hasEventUploadAccess(user);
}

export function canAccessReportsPage(user: CurrentUser | null | undefined) {
  const roles = getEffectiveRoles(user);
  return (
    roles.has("REFEREE") ||
    roles.has("DOA") ||
    roles.has("NL") ||
    Boolean(user?.can_approve_accounts)
  );
}

export function canAccessEarningsPage(user: CurrentUser | null | undefined) {
  return hasRefereeAccess(user);
}

export function canAccessAccountApprovalsPage(user: CurrentUser | null | undefined) {
  return Boolean(user?.can_approve_accounts);
}

export function canAccessConfigurePage(user: CurrentUser | null | undefined) {
  const roles = getEffectiveRoles(user);
  return Boolean(user?.doa_approved) && (roles.has("DOA") || roles.has("NL"));
}
