import React, { useEffect, useMemo, useState } from "react";
import GamesMap from "../components/GamesMap";
import GamesList from "../components/Gameslist";
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
  // Games loaded from backend
  const [games, setGames] = useState<Game[]>([]);

  // Loading/error state for API call
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [competitionFilter, setCompetitionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Fetch games from Django API when page loads
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

  // Build filter options from backend data
  const competitionOptions = useMemo(() => {
    const divisions = games
      .map((game) => game.division_display)
      .filter((value): value is string => Boolean(value));

    return ["All", ...new Set(divisions)];
  }, [games]);

  // Frontend filtering
  const filteredGames = useMemo(() => {
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

      // You do not yet have a real status field in Game model,
      // so leave this as All for now or remove it later
      const matchesStatus = statusFilter === "All";

      return matchesSearch && matchesCompetition && matchesStatus;
    });
  }, [games, searchTerm, competitionFilter, statusFilter]);

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
          onChange={(e) => setSearchTerm(e.target.value)}
          className="games-filter-input"
        />

        <select
          value={competitionFilter}
          onChange={(e) => setCompetitionFilter(e.target.value)}
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
          onChange={(e) => setStatusFilter(e.target.value)}
          className="games-filter-select"
        >
          <option value="All">All Statuses</option>
        </select>
      </div>

      {loading && <p>Loading games...</p>}
      {error && <p>{error}</p>}

      {!loading && !error && (
        <div className="games-content">
          <GamesMap games={filteredGames} />
          <GamesList games={filteredGames} />
        </div>
      )}
    </div>
  );
}