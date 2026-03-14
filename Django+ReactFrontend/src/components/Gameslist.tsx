import React from "react";
import type { Game } from "../pages/Games";
import GameCard from "./GameCard";

type GamesListProps = {
  games: Game[];
};

export default function GamesList({ games }: GamesListProps) {
  return (
    <div className="games-list-panel">
      {/* Header for the list section */}
      <div className="games-list-header">
        <h2>Game List</h2>
        <span>{games.length} results</span>
      </div>

      {/* Empty state if no games match the filters */}
      {games.length === 0 ? (
        <div className="games-empty-state">
          <p>No games match your current filters.</p>
        </div>
      ) : (
        <div className="games-list">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}