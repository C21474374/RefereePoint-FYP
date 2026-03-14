import React from "react";
import type { Game } from "../pages/Games";

type GameCardProps = {
  game: Game;
};

export default function GameCard({ game }: GameCardProps) {
  return (
    <div className="game-card">
      {/* Main game title */}
      <h3 className="game-card-title">
        {game.homeTeam} vs {game.awayTeam}
      </h3>

      {/* Game details */}
      <p>
        <strong>Venue:</strong> {game.venue}
      </p>
      <p>
        <strong>Competition:</strong> {game.competition}
      </p>
      <p>
        <strong>Date:</strong> {game.date}
      </p>
      <p>
        <strong>Time:</strong> {game.time}
      </p>
      <p>
        <strong>Status:</strong>{" "}
        <span className={`status-badge status-${game.status.toLowerCase()}`}>
          {game.status}
        </span>
      </p>

      {/* Action buttons */}
      <div className="game-card-actions">
        <button className="game-btn-secondary">View Details</button>
        <button className="game-btn-primary">Open on Map</button>
      </div>
    </div>
  );
}