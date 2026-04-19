import axiosInstance from "./axiosInstance";

export type GameDetails = {
  id: number;
  game_type?: string;
  game_type_display?: string;
  status?: string;
  status_display?: string;
  payment_type?: string;
  payment_type_display?: string;
  division?: number;
  division_name?: string;
  division_gender?: string;
  division_display?: string;
  date?: string;
  time?: string;
  venue?: number;
  venue_name?: string;
  lat?: number;
  lng?: number;
  home_team?: number;
  home_team_name?: string;
  away_team?: number;
  away_team_name?: string;
  notes?: string;
  original_post_text?: string;
  created_by?: number;
  assigned_roles_count?: number;
  open_non_appointed_slots_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type CoverRequest = {
  id: number;
  game: number;
  game_details: GameDetails;
  requested_by: number;
  requested_by_name: string;
  referee_slot: number;
  role: string;
  role_display: string;
  original_referee: number | null;
  original_referee_id: number | null;
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
  created_at: string;
  updated_at: string;
};

export type CreateCoverRequestPayload = {
  game: number;
  referee_slot: number;
  reason?: string;
};

export type UpcomingAssignment = {
  assignment_id: number;
  role: string;
  role_display: string;
  game_id: number;
  game_details: GameDetails;
  has_active_cover_request: boolean;
};

export const getMyUpcomingAssignments = async () => {
  const response = await axiosInstance.get<UpcomingAssignment[]>(
    "/cover-requests/my-upcoming-assignments/"
  );
  return response.data;
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
  const response = await axiosInstance.post<CoverRequest>(
    "/cover-requests/create/",
    payload
  );
  return response.data;
};

export const cancelCoverRequest = async (id: number) => {
  await axiosInstance.delete(`/cover-requests/${id}/cancel/`);
};

export const claimCoverRequest = async (id: number) => {
  const response = await axiosInstance.post<CoverRequest>(
    `/cover-requests/${id}/offer/`
  );
  return response.data;
};

export const withdrawCoverClaim = async (id: number) => {
  const response = await axiosInstance.post<CoverRequest>(
    `/cover-requests/${id}/withdraw/`
  );
  return response.data;
};

export const approveCoverRequest = async (id: number) => {
  const response = await axiosInstance.post<CoverRequest>(
    `/cover-requests/${id}/approve/`
  );
  return response.data;
};
