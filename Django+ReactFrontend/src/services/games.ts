import axiosInstance from "./axiosInstance";

export type SimpleOption = {
  id: number;
  name: string;
};

export type TeamOption = {
  id: number;
  name: string;
};

export type UploadedGameSlot = {
  id: number;
  role: "CREW_CHIEF" | "UMPIRE_1";
  role_display: string;
  status: "OPEN" | "CLAIMED" | "CLOSED" | "CANCELLED";
  status_display: string;
  description: string;
  is_active: boolean;
  claimed_by_name: string | null;
};

export type UploadedGame = {
  id: number;
  game_type: "CLUB" | "SCHOOL" | "COLLEGE" | "FRIENDLY" | "DOA" | "NL";
  game_type_display: string;
  status: string;
  status_display: string;
  payment_type: "CASH" | "REVOLUT" | "CLAIM" | null;
  payment_type_display: string | null;
  division: number | null;
  division_name: string | null;
  division_gender: string | null;
  division_display: string | null;
  date: string;
  time: string;
  venue: number | null;
  venue_name: string | null;
  lat: number | null;
  lng: number | null;
  home_team: number | null;
  home_team_name: string | null;
  away_team: number | null;
  away_team_name: string | null;
  notes: string;
  original_post_text: string;
  created_by: number | null;
  assigned_roles_count: number;
  open_non_appointed_slots_count: number;
  created_at: string;
  updated_at: string;
  uploaded_slots: UploadedGameSlot[];
  can_edit: boolean;
  can_delete: boolean;
};

export type ManageUploadedGamePayload = {
  game_type: "CLUB" | "SCHOOL" | "COLLEGE" | "FRIENDLY";
  payment_type: "CASH" | "REVOLUT";
  division: number;
  date: string;
  time: string;
  venue: number;
  home_team: number;
  away_team: number;
  notes: string;
  original_post_text: string;
  slots: Array<{
    role: "CREW_CHIEF" | "UMPIRE_1";
    description?: string;
  }>;
};

type DivisionApiOption = {
  id: number;
  name: string;
  gender: string;
  display: string;
};

type VenueApiOption = {
  id: number;
  name: string;
};

type TeamApiOption = {
  id: number;
  club_name: string;
  division_name: string;
};

export const claimSlot = async (slotId: number) => {
  const response = await axiosInstance.post(
    `/games/non-appointed-slots/${slotId}/claim/`
  );
  return response.data;
};

export const getMyUploadedGames = async () => {
  const response = await axiosInstance.get<UploadedGame[]>("/games/my-uploads/");
  return response.data;
};

export const updateUploadedGame = async (
  gameId: number,
  payload: ManageUploadedGamePayload
) => {
  const response = await axiosInstance.patch<UploadedGame>(
    `/games/my-uploads/${gameId}/update/`,
    payload
  );
  return response.data;
};

export const deleteUploadedGame = async (gameId: number) => {
  await axiosInstance.delete(`/games/my-uploads/${gameId}/delete/`);
};

export const getUploadGameFormOptions = async (): Promise<{
  divisions: SimpleOption[];
  venues: SimpleOption[];
  teams: TeamOption[];
}> => {
  const [divisionResponse, venueResponse, teamResponse] = await Promise.all([
    axiosInstance.get<DivisionApiOption[]>("/clubs/divisions/"),
    axiosInstance.get<VenueApiOption[]>("/venues/venues/"),
    axiosInstance.get<TeamApiOption[]>("/clubs/teams/"),
  ]);

  return {
    divisions: divisionResponse.data.map((division) => ({
      id: division.id,
      name: division.display || `${division.name} (${division.gender})`,
    })),
    venues: venueResponse.data.map((venue) => ({
      id: venue.id,
      name: venue.name,
    })),
    teams: teamResponse.data.map((team) => ({
      id: team.id,
      name: `${team.club_name} - ${team.division_name}`,
    })),
  };
};
