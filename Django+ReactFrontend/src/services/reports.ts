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

export type ReportableGame = {
  game_id: number;
  game_details: GameDetails;
  roles: string[];
  roles_display: string[];
  has_report: boolean;
  report_id: number | null;
  report_status: "PENDING" | "REVIEWED" | "RESOLVED" | null;
  report_status_display: string | null;
  report_submitted_at: string | null;
};

export type GameReport = {
  id: number;
  game: number;
  game_details: GameDetails;
  referee: number;
  referee_name?: string;
  referee_grade?: string;
  submitted_by: number;
  submitted_by_name: string;
  match_no: string;
  incident_time: string | null;
  people_involved_no_1: string;
  people_involved_name_1: string;
  people_involved_no_2: string;
  people_involved_name_2: string;
  people_involved_other: string;
  incident_details: string;
  action_taken: string;
  signed_by: string;
  signed_date: string | null;
  status: "PENDING" | "REVIEWED" | "RESOLVED";
  status_display: string;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateGameReportPayload = {
  game: number;
  match_no?: string;
  incident_time?: string | null;
  people_involved_no_1?: string;
  people_involved_name_1?: string;
  people_involved_no_2?: string;
  people_involved_name_2?: string;
  people_involved_other?: string;
  incident_details: string;
  action_taken: string;
  signed_by?: string;
  signed_date?: string | null;
};

export const getReportableGames = async () => {
  const response = await axiosInstance.get<ReportableGame[]>("/reports/reportable-games/");
  return response.data;
};

export const createGameReport = async (payload: CreateGameReportPayload) => {
  const response = await axiosInstance.post<GameReport>("/reports/create/", payload);
  return response.data;
};

export const getMyReports = async () => {
  const response = await axiosInstance.get<GameReport[]>("/reports/my/");
  return response.data;
};

export const getAdminReports = async (params?: {
  status?: "PENDING" | "REVIEWED" | "RESOLVED";
}) => {
  const response = await axiosInstance.get<GameReport[]>("/reports/admin/", {
    params,
  });
  return response.data;
};
