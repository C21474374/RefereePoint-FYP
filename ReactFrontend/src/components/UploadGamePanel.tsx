import { useEffect, useState } from "react";
import UploadGameForm from "./UploadGameForm";
import { API_BASE_URL } from "../config/api";
import { getAccessToken } from "../services/auth";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

type SimpleOption = {
  id: number;
  name: string;
  requires_appointed_referees?: boolean;
};

type TeamOption = {
  id: number;
  name: string;
  division_id?: number;
};

type UploadGamePanelProps = {
  embedded?: boolean;
  onPosted?: () => void;
  onCancel?: () => void;
};

export default function UploadGamePanel({
  embedded = false,
  onPosted,
  onCancel,
}: UploadGamePanelProps) {
  const { showToast } = useToast();
  const { user } = useAuth();

  const [divisions, setDivisions] = useState<SimpleOption[]>([]);
  const [venues, setVenues] = useState<SimpleOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setErrorMessage("");

        const token = getAccessToken();

        const authHeaders: Record<string, string> = {};
        if (token) {
          authHeaders.Authorization = `Bearer ${token}`;
        }

        const [divisionsRes, venuesRes, teamsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/clubs/divisions/`, {
            headers: authHeaders,
          }),
          fetch(`${API_BASE_URL}/venues/venues/`, {
            headers: authHeaders,
          }),
          fetch(`${API_BASE_URL}/clubs/teams/`, {
            headers: authHeaders,
          }),
        ]);

        if (!divisionsRes.ok || !venuesRes.ok || !teamsRes.ok) {
          throw new Error("Failed to load upload form data.");
        }

        const divisionsData = await divisionsRes.json();
        const venuesData = await venuesRes.json();
        const teamsData = await teamsRes.json();

        setDivisions(
          divisionsData.map((division: any) => ({
            id: division.id,
            name: division.display || `${division.name} (${division.gender})`,
            requires_appointed_referees: Boolean(division.requires_appointed_referees),
          }))
        );

        setVenues(
          venuesData.map((venue: any) => ({
            id: venue.id,
            name: venue.name,
          }))
        );

        setTeams(
          teamsData.map((team: any) => ({
            id: team.id,
            name: `${team.club_name} - ${team.division_name}`,
            division_id: team.division_id,
          }))
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load upload form data.";
        setErrorMessage(message);
        showToast(message, "error");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return <p className="upload-panel-state">Loading upload form...</p>;
  }

  if (errorMessage) {
    return <p className="upload-panel-state error">{errorMessage}</p>;
  }

  const allowedGameTypes = (user?.allowed_upload_game_types || []).filter((value) =>
    ["CLUB", "SCHOOL", "COLLEGE", "FRIENDLY", "DOA", "NL"].includes(value)
  ) as Array<"CLUB" | "SCHOOL" | "COLLEGE" | "FRIENDLY" | "DOA" | "NL">;

  return (
    <UploadGameForm
      divisions={divisions}
      venues={venues}
      teams={teams}
      allowedGameTypes={allowedGameTypes}
      accountTypeDisplay={user?.account_type_display || "User"}
      canUploadGames={Boolean(user?.uploads_approved)}
      embedded={embedded}
      onPosted={onPosted}
      onCancel={onCancel}
    />
  );
}
