import React from "react";
import type { Game } from "../pages/Games";

type GameCardProps = {
  game: Game;
};

export default function GameCard({ game }: GameCardProps) {
  return (
    <div className="game-card">
      <h3 className="game-card-title">
        {game.home_team_name} vs {game.away_team_name}
      </h3>

      <p>
        <strong>Venue:</strong> {game.venue_name || "TBD"}
      </p>
      <p>
        <strong>Competition:</strong> {game.division_display || "TBD"}
      </p>
      <p>
        <strong>Date:</strong> {game.date}
      </p>
      <p>
        <strong>Time:</strong> {game.time}
      </p>
      <p>
        <strong>Type:</strong> {game.game_type_display}
      </p>

      <div className="game-card-actions">
        <button className="game-btn-secondary">View Details</button>
        <button className="game-btn-primary">Open on Map</button>
      </div>
    </div>
  );
}