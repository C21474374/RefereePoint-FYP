import { API_BASE_URL } from "../config/api";

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface RefereeProfile {
  id: number;
  grade: string;
}

export type AccountType =
  | "REFEREE"
  | "CLUB"
  | "SCHOOL"
  | "COLLEGE"
  | "DOA"
  | "NL";

export interface CurrentUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  bipin_number: string | null;
  account_type: AccountType;
  account_type_display: string;
  is_team_manager: boolean;
  manager_scope: string;
  manager_scope_display: string;
  managed_team: number | null;
  managed_team_name: string | null;
  organization_name: string;
  verification_id_number: string;
  verification_id_photo: string | null;
  institution_head_phone: string;
  bipin_verified: boolean;
  doa_approved: boolean;
  uploads_approved: boolean;
  can_approve_accounts: boolean;
  effective_roles?: AccountType[];
  allowed_upload_game_types: string[];
  allowed_upload_event_types: string[];
  home_address: string;
  home_lat: number | null;
  home_lon: number | null;
  referee_profile: RefereeProfile | null;
}

export interface UpdateCurrentUserProfilePayload {
  first_name?: string;
  last_name?: string;
  phone_number?: string | null;
  organization_name?: string;
  institution_head_phone?: string;
}

function extractApiErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const payload = data as Record<string, unknown>;

  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  const nonFieldErrors = payload.non_field_errors;
  if (Array.isArray(nonFieldErrors) && typeof nonFieldErrors[0] === "string") {
    return nonFieldErrors[0];
  }

  for (const value of Object.values(payload)) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (Array.isArray(value) && typeof value[0] === "string") {
      return value[0];
    }
  }

  return fallback;
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(extractApiErrorMessage(data, "Login failed"));
  }

  return data as LoginResponse;
}

export async function fetchCurrentUser(token: string): Promise<CurrentUser> {
  const response = await fetch(`${API_BASE_URL}/users/me/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Failed to fetch current user");
  }

  return data;
}

export async function switchTestingRole(accountType: AccountType): Promise<CurrentUser> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("You must be logged in to change role.");
  }

  const response = await fetch(`${API_BASE_URL}/users/me/testing-role/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      account_type: accountType,
    }),
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(extractApiErrorMessage(data, "Failed to change role."));
  }

  return data as CurrentUser;
}

export async function updateCurrentUserProfile(
  payload: UpdateCurrentUserProfilePayload
): Promise<CurrentUser> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("You must be logged in to update account details.");
  }

  const response = await fetch(`${API_BASE_URL}/users/me/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(extractApiErrorMessage(data, "Failed to update account details."));
  }

  return data as CurrentUser;
}

export async function refreshAccessToken(refresh: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Token refresh failed");
  }

  return data.access;
}

export function saveTokens(access: string, refresh: string) {
  sessionStorage.setItem("accessToken", access);
  sessionStorage.setItem("refreshToken", refresh);
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem("accessToken");
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem("refreshToken");
}

export function clearTokens() {
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("refreshToken");
}
