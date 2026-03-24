import GameCard from "./GameCard";
import type { Opportunity } from "../pages/Games";

type GameslistProps = {
  opportunities: Opportunity[];
  onClaimSlot: (slotId: number) => void;
  onOfferCover: (coverRequestId: number) => void;
  claimingKey: string | null;
};

const Gameslist = ({
  opportunities,
  onClaimSlot,
  onOfferCover,
  claimingKey,
}: GameslistProps) => {
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
        <GameCard
          key={`${opportunity.type}-${opportunity.id}`}
          opportunity={opportunity}
          onClaimSlot={onClaimSlot}
          onOfferCover={onOfferCover}
          claimingKey={claimingKey}
        />
      ))}
    </div>
  );
};

export default Gameslist;
