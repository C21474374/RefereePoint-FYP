import GameCard from "./GameCard";
import type { Opportunity } from "../pages/Games";

type GameslistProps = {
  opportunities: Opportunity[];
};

const Gameslist = ({ opportunities }: GameslistProps) => {
  if (opportunities.length === 0) {
    return (
      <div className="games-empty-state">
        <p>No opportunities found for the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="games-list">
      {opportunities.map((opportunity) => (
        <GameCard key={`${opportunity.type}-${opportunity.id}`} opportunity={opportunity} />
      ))}
    </div>
  );
};

export default Gameslist;