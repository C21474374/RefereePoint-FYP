import axiosInstance from "./axiosInstance";

export type ConfigureClub = {
  id: number;
  name: string;
};

export type ConfigureDivision = {
  id: number;
  name: string;
  gender: "M" | "F";
  requires_appointed_referees: boolean;
  display: string;
  is_active: boolean;
};

export type ConfigureTeam = {
  id: number;
  club_id: number;
  club_name: string;
  division_id: number;
  division_name: string;
  is_active: boolean;
};

export type ConfigureBootstrapResponse = {
  clubs: ConfigureClub[];
  divisions: ConfigureDivision[];
  teams: ConfigureTeam[];
};

export type CreateDivisionPayload = {
  name: string;
  gender: "M" | "F";
  requires_appointed_referees: boolean;
};

export type UpdateDivisionPayload = Partial<CreateDivisionPayload> & {
  is_active?: boolean;
};

export type CreateTeamPayload = {
  club_id: number;
  division_id: number;
};

export type UpdateTeamPayload = Partial<CreateTeamPayload> & {
  is_active?: boolean;
};

export const getConfigureBootstrap = async () => {
  const response = await axiosInstance.get<ConfigureBootstrapResponse>("/clubs/configure/bootstrap/");
  return response.data;
};

export const createDivision = async (payload: CreateDivisionPayload) => {
  const response = await axiosInstance.post<ConfigureDivision>(
    "/clubs/configure/divisions/",
    payload
  );
  return response.data;
};

export const updateDivision = async (
  divisionId: number,
  payload: UpdateDivisionPayload
) => {
  const response = await axiosInstance.patch<ConfigureDivision>(
    `/clubs/configure/divisions/${divisionId}/`,
    payload
  );
  return response.data;
};

export const createTeam = async (payload: CreateTeamPayload) => {
  const response = await axiosInstance.post<ConfigureTeam>("/clubs/configure/teams/", payload);
  return response.data;
};

export const updateTeam = async (teamId: number, payload: UpdateTeamPayload) => {
  const response = await axiosInstance.patch<ConfigureTeam>(
    `/clubs/configure/teams/${teamId}/`,
    payload
  );
  return response.data;
};
