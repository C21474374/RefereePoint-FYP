import { useEffect, useMemo, useState } from "react";
import "../pages_css/Games.css";
import GamesMap from "../components/GamesMap";
import Gameslist from "../components/Gameslist";

export type Opportunity = {
  id: number;
  type: "NON_APPOINTED_SLOT" | "COVER_REQUEST";
  game_id: number;
  game_type: string;
  game_type_display: string;
  date: string;
  time: string;

  venue_id: number | null;
  venue_name: string | null;
  lat: number | null;
  lng: number | null;

  home_team_name: string | null;
  away_team_name: string | null;

  division_name: string | null;
  division_gender: string | null;

  payment_type: string | null;
  payment_type_display: string | null;

  role: string | null;
  role_display: string | null;

  status: string;
  status_display: string;

  source_type?: string | null;
  source_type_display?: string | null;

  posted_by_name?: string | null;
  claimed_by_name?: string | null;

  requested_by_name?: string | null;
  original_referee_name?: string | null;
  replaced_by_name?: string | null;

  description?: string;
  reason?: string;
  custom_fee?: string | null;

  created_at: string;
};

const Games = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("http://127.0.0.1:8000/api/games/opportunities/");
        if (!response.ok) {
          throw new Error("Failed to fetch opportunities.");
        }

        const data = await response.json();
        setOpportunities(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunities();
  }, []);

  const filteredOpportunities = useMemo(() => {
    let filtered = [...opportunities];

    if (selectedVenueId !== null) {
      filtered = filtered.filter((item) => item.venue_id === selectedVenueId);
    }

    if (selectedType !== "ALL") {
      filtered = filtered.filter((item) => item.type === selectedType);
    }

    return filtered;
  }, [opportunities, selectedVenueId, selectedType]);

  return (
    <div className="games-page">
      <div className="games-header">
        <div>
          <h1>Opportunities</h1>
          <p>Find non-appointed games and cover requests.</p>
        </div>

        <div className="games-filters">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="games-filter-select"
          >
            <option value="ALL">All Opportunities</option>
            <option value="NON_APPOINTED_SLOT">Non-Appointed Games</option>
            <option value="COVER_REQUEST">Cover Requests</option>
          </select>

          <button
            className="clear-venue-btn"
            onClick={() => setSelectedVenueId(null)}
            disabled={selectedVenueId === null}
          >
            Clear Venue
          </button>
        </div>
      </div>

      {loading && <p className="games-info-message">Loading opportunities...</p>}
      {error && <p className="games-error-message">{error}</p>}

      {!loading && !error && (
        <div className="games-content">
          <div className="games-map-panel">
            <GamesMap
              opportunities={filteredOpportunities}
              selectedVenueId={selectedVenueId}
              onVenueSelect={setSelectedVenueId}
            />
          </div>

          <div className="games-list-panel">
            <Gameslist opportunities={filteredOpportunities} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Games;