const FALLBACK_API_BASE_URL = "http://localhost:8000/api";

function normalizeApiBaseUrl(rawValue: string | undefined) {
  const trimmed = (rawValue || "").trim();
  if (!trimmed) {
    return FALLBACK_API_BASE_URL;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  if (withoutTrailingSlash.endsWith("/api")) {
    return withoutTrailingSlash;
  }

  return `${withoutTrailingSlash}/api`;
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
export const API_HOST = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL;

