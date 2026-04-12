import axiosInstance from "./axiosInstance";

export type EarningsItem = {
  assignment_id: number;
  game_id: number;
  date: string;
  time: string;
  venue_name: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  role: string;
  role_display: string;
  game_type: string;
  game_type_display: string;
  base_fee: string;
  travel_mode: string;
  travel_mode_display: string;
  travel_source: string;
  mileage_km: string;
  travel_amount: string;
  public_transport_fare: string | null;
  is_back_to_back_same_venue: boolean;
  total: string;
};

export type EarningsResponse = {
  home: {
    home_address: string;
    home_lat: number | null;
    home_lon: number | null;
  };
  rules: {
    game_type: "DOA" | "NL";
    game_type_display: string;
    base_fee: string;
    rate_per_km: string;
    included_games: string;
    excluded_expenses: string[];
  };
  period: string;
  selected_month: {
    year: number;
    month: number;
    value: string;
    label: string;
    is_finalized: boolean;
  };
  available_months: Array<{
    year: number;
    month: number;
    value: string;
    label: string;
    is_finalized: boolean;
  }>;
  totals: {
    games_count: number;
    base_fee_total: string;
    travel_total: string;
    mileage_km_total: string;
    total_claim_amount: string;
    missing_distance_games: number;
  };
  items: EarningsItem[];
};

export type EarningsGameType = "DOA" | "NL";

export const getEarnings = async (params: {
  gameType: EarningsGameType;
  year: number;
  month: number;
}) => {
  const response = await axiosInstance.get<EarningsResponse>("/expenses/earnings/", {
    params: {
      period: "month",
      game_type: params.gameType,
      year: params.year,
      month: params.month,
    },
  });
  return response.data;
};

export type HomeLocationPayload = {
  home_address: string;
  home_lat: number | null;
  home_lon: number | null;
};

export type UpdateHomeLocationResponse = {
  geocode_warning?: string;
  [key: string]: unknown;
};

export const updateHomeLocation = async (payload: HomeLocationPayload) => {
  const response = await axiosInstance.patch<UpdateHomeLocationResponse>("/users/me/home/", payload);
  return response.data;
};
