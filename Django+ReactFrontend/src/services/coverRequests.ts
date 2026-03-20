import axiosInstance from "./axiosInstance";

export type CoverRequest = {
  id: number;
  game: number;
  game_details: {
    id: number;
    date?: string;
    match_date?: string;
    time?: string;
    venue?: string | { name?: string };
    home_team?: { name?: string };
    away_team?: { name?: string };
    division?: { name?: string };
  };
  requested_by: number;
  requested_by_name: string;
  referee_slot: number;
  role: string;
  role_display: string;
  original_referee_id: number;
  original_referee_name: string;
  original_referee_grade: string;
  replaced_by: number | null;
  replaced_by_name: string | null;
  replaced_by_grade: string | null;
  status: "PENDING" | "CLAIMED" | "APPROVED" | "REJECTED";
  status_display: string;
  approver: number | null;
  approver_name: string | null;
  reason: string;
  custom_fee: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateCoverRequestPayload = {
  game: number;
  referee_slot: number;
  reason?: string;
  custom_fee?: string | null;
};

export const getCoverRequests = async (status?: string) => {
  const url = status
    ? `/cover-requests/?status=${encodeURIComponent(status)}`
    : "/cover-requests/";
  const response = await axiosInstance.get<CoverRequest[]>(url);
  return response.data;
};

export const getMyCoverRequests = async () => {
  const response = await axiosInstance.get<CoverRequest[]>("/cover-requests/my/");
  return response.data;
};

export const getPendingCoverRequests = async () => {
  const response = await axiosInstance.get<CoverRequest[]>("/cover-requests/pending/");
  return response.data;
};

export const createCoverRequest = async (payload: CreateCoverRequestPayload) => {
  const response = await axiosInstance.post<CoverRequest>("/cover-requests/create/", payload);
  return response.data;
};

export const claimCoverRequest = async (id: number) => {
  const response = await axiosInstance.post<CoverRequest>(`/cover-requests/${id}/offer/`);
  return response.data;
};

export const approveCoverRequest = async (id: number) => {
  const response = await axiosInstance.post<CoverRequest>(`/cover-requests/${id}/approve/`);
  return response.data;
};