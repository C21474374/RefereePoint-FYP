import React, { useMemo, useState } from "react";
import GamesMap from "../components/GamesMap";
import GamesList from "../components/Gameslist";
import "../pages_css/Games.css";

// Define the shape of a game object
export type Game = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  competition: string;
  date: string;
  time: string;
  status: "Available" | "Assigned" | "Covered";
  lat: number;
  lng: number;
};

export default function Games() {
  // Sample data for now
  // Later replace this with data from your backend API
  const [games] = useState<Game[]>([
    {
      id: 1,
      homeTeam: "Dublin Lions",
      awayTeam: "Templeogue Tigers",
      venue: "National Basketball Arena",
      competition: "Super League",
      date: "2026-03-15",
      time: "19:30",
      status: "Available",
      lat: 53.3208,
      lng: -6.3189,
    },
    {
      id: 2,
      homeTeam: "Malahide Rockets",
      awayTeam: "Tallaght Storm",
      venue: "Malahide Community School",
      competition: "Division 1",
      date: "2026-03-16",
      time: "18:00",
      status: "Assigned",
      lat: 53.4500,
      lng: -6.154,
    },
    {
      id: 3,
      homeTeam: "Bray Falcons",
      awayTeam: "Swords Heat",
      venue: "Bray Sports Centre",
      competition: "Schools Cup",
      date: "2026-03-17",
      time: "17:15",
      status: "Available",
      lat: 53.2022,
      lng: -6.1118,
    },
    {
      id: 4,
      homeTeam: "Lucan Hawks",
      awayTeam: "Blanch Panthers",
      venue: "Lucan Leisure Centre",
      competition: "Division 2",
      date: "2026-03-18",
      time: "20:00",
      status: "Covered",
      lat: 53.357,
      lng: -6.4486,
    },
  ]);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [competitionFilter, setCompetitionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Build competition dropdown options from the games array
  const competitionOptions = useMemo(() => {
    const competitions = games.map((game) => game.competition);
    return ["All", ...new Set(competitions)];
  }, [games]);

  // Filter the games once here
  // Then pass the same filtered data to BOTH the map and the list
  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const matchesSearch =
        game.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
        game.awayTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
        game.venue.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCompetition =
        competitionFilter === "All" || game.competition === competitionFilter;

      const matchesStatus =
        statusFilter === "All" || game.status === statusFilter;

      return matchesSearch && matchesCompetition && matchesStatus;
    });
  }, [games, searchTerm, competitionFilter, statusFilter]);

  return (
    <div className="games-page">
      {/* Page heading */}
      <div className="games-header">
        <h1 className="games-title">Games</h1>
        <p className="games-subtitle">
          View games on the map and browse matching games in the list.
        </p>
      </div>

      {/* Filters affect both map and list */}
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
          <option value="Available">Available</option>
          <option value="Assigned">Assigned</option>
          <option value="Covered">Covered</option>
        </select>
      </div>

      {/* Main layout: map left, list right */}
      <div className="games-content">
        <GamesMap games={filteredGames} />
        <GamesList games={filteredGames} />
      </div>
    </div>
  );
}