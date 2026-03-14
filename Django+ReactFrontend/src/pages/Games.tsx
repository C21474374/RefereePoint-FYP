import React, { useEffect, useMemo, useState } from "react";
import GamesMap from "../components/GamesMap";
import GamesList from "../components/GamesList";
import "../pages_css/Games.css";

export type Game = {
  id: number;
  game_type: string;
  game_type_display: string;
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
};

export default function Games() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [competitionFilter, setCompetitionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // New: selected venue from map click
  const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchGames() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("http://127.0.0.1:8000/api/games/");

        if (!response.ok) {
          throw new Error("Failed to fetch games");
        }

        const data = await response.json();
        setGames(data);
      } catch (err) {
        console.error("Error fetching games:", err);
        setError("Could not load games.");
      } finally {
        setLoading(false);
      }
    }

    fetchGames();
  }, []);

  const competitionOptions = useMemo(() => {
    const divisions = games
      .map((game) => game.division_display)
      .filter((value): value is string => Boolean(value));

    return ["All", ...new Set(divisions)];
  }, [games]);

  // Base filters from search/dropdowns
  const baseFilteredGames = useMemo(() => {
    return games.filter((game) => {
      const homeTeam = game.home_team_name?.toLowerCase() || "";
      const awayTeam = game.away_team_name?.toLowerCase() || "";
      const venueName = game.venue_name?.toLowerCase() || "";
      const divisionDisplay = game.division_display || "";

      const matchesSearch =
        homeTeam.includes(searchTerm.toLowerCase()) ||
        awayTeam.includes(searchTerm.toLowerCase()) ||
        venueName.includes(searchTerm.toLowerCase());

      const matchesCompetition =
        competitionFilter === "All" || divisionDisplay === competitionFilter;

      const matchesStatus = statusFilter === "All";

      return matchesSearch && matchesCompetition && matchesStatus;
    });
  }, [games, searchTerm, competitionFilter, statusFilter]);

  // Right panel filter: if a venue marker is clicked, show only games from that venue
  const visibleGames = useMemo(() => {
    if (selectedVenueId === null) {
      return baseFilteredGames;
    }

    return baseFilteredGames.filter((game) => game.venue === selectedVenueId);
  }, [baseFilteredGames, selectedVenueId]);

  return (
    <div className="games-page">
      <div className="games-header">
        <h1 className="games-title">Games</h1>
        <p className="games-subtitle">
          View games on the map and browse matching games in the list.
        </p>
      </div>

      <div className="games-filters">
        <input
          type="text"
          placeholder="Search by team or venue..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setSelectedVenueId(null);
          }}
          className="games-filter-input"
        />

        <select
          value={competitionFilter}
          onChange={(e) => {
            setCompetitionFilter(e.target.value);
            setSelectedVenueId(null);
          }}
          className="games-filter-select"
        >
          {competitionOptions.map((competition) => (
            <option key={competition} value={competition}>
              {competition}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setSelectedVenueId(null);
          }}
          className="games-filter-select"
        >
          <option value="All">All Statuses</option>
        </select>
      </div>

      {/* Optional selected venue banner */}
      {selectedVenueId !== null && (
        <div className="games-selected-venue-bar">
          <span>
            Showing games for selected venue only
          </span>
          <button
            type="button"
            className="clear-venue-filter-btn"
            onClick={() => setSelectedVenueId(null)}
          >
            Show all games
          </button>
        </div>
      )}

      {loading && <p>Loading games...</p>}
      {error && <p>{error}</p>}

      {!loading && !error && (
        <div className="games-content">
          <GamesMap
            games={baseFilteredGames}
            selectedVenueId={selectedVenueId}
            onVenueSelect={setSelectedVenueId}
          />
          <GamesList games={visibleGames} />
        </div>
      )}
    </div>
  );
}