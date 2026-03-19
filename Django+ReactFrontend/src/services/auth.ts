const API_BASE_URL = "http://localhost:8000/api";

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface RefereeProfile {
  id: number;
  grade: string;
}

export interface CurrentUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  bipin_number: string | null;
  referee_profile: RefereeProfile | null;
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Login failed");
  }

  return data;
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
