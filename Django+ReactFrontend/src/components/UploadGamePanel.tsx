import { useEffect, useState } from "react";
import UploadGameForm from "./UploadGameForm";
import { getAccessToken } from "../services/auth";

type SimpleOption = {
  id: number;
  name: string;
};

type UploadGamePanelProps = {
  embedded?: boolean;
  onPosted?: () => void;
};

export default function UploadGamePanel({
  embedded = false,
  onPosted,
}: UploadGamePanelProps) {
  const [divisions, setDivisions] = useState<SimpleOption[]>([]);
  const [venues, setVenues] = useState<SimpleOption[]>([]);
  const [teams, setTeams] = useState<SimpleOption[]>([]);
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
          fetch("http://127.0.0.1:8000/api/clubs/divisions/", {
            headers: authHeaders,
          }),
          fetch("http://127.0.0.1:8000/api/venues/venues/", {
            headers: authHeaders,
          }),
          fetch("http://127.0.0.1:8000/api/clubs/teams/", {
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
          }))
        );
      } catch (error) {
        console.error("Failed loading upload form data:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load upload form data."
        );
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

  return (
    <UploadGameForm
      divisions={divisions}
      venues={venues}
      teams={teams}
      embedded={embedded}
      onPosted={onPosted}
    />
  );
}
