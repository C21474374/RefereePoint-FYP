import { getAccessToken } from "./auth";

const API_BASE_URL = "http://127.0.0.1:8000/api";

export async function claimSlot(slotId: number) {
  const token = getAccessToken();

  if (!token) {
    throw new Error("You must be logged in.");
  }

  const response = await fetch(
    `${API_BASE_URL}/games/non-appointed-slots/${slotId}/claim/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Failed to claim slot.");
  }

  return data;
}