import AppIcon from "./AppIcon";
import GameCard from "./GameCard";
import type { Opportunity } from "../pages/Games";

type GameslistProps = {
  opportunities: Opportunity[];
  onClaimSlot: (slotId: number) => void;
  onOfferCover: (coverRequestId: number) => void;
  onJoinEvent: (eventId: number) => void;
  claimingKey: string | null;
  showRecommendations?: boolean;
};

const Gameslist = ({
  opportunities,
  onClaimSlot,
  onOfferCover,
  onJoinEvent,
  claimingKey,
  showRecommendations = false,
}: GameslistProps) => {
  if (opportunities.length === 0) {
    return (
      <div className="games-empty-state">
        <p>No opportunities found for the selected filters.</p>
      </div>
    );
  }

  const recommended = showRecommendations ? opportunities.slice(0, 5) : [];
  const otherOpportunities = showRecommendations ? opportunities.slice(5) : opportunities;

  return (
    <div className="games-list">
      {showRecommendations && recommended.length > 0 && (
        <>
          <div className="games-list-section-header">
            <h3 className="section-title-with-icon">
              <AppIcon name="whistle" className="section-title-icon" />
              <span>Recommended For You</span>
            </h3>
          </div>
          {recommended.map((opportunity) => (
            <GameCard
              key={`${opportunity.type}-${opportunity.id}`}
              opportunity={opportunity}
              onClaimSlot={onClaimSlot}
              onOfferCover={onOfferCover}
              onJoinEvent={onJoinEvent}
              claimingKey={claimingKey}
            />
          ))}
        </>
      )}

      {showRecommendations && otherOpportunities.length > 0 && (
        <div className="games-list-section-header">
          <h3 className="section-title-with-icon">
            <AppIcon name="basketball" className="section-title-icon" />
            <span>More Opportunities</span>
          </h3>
        </div>
      )}

      {otherOpportunities.map((opportunity) => (
        <GameCard
          key={`${opportunity.type}-${opportunity.id}`}
          opportunity={opportunity}
          onClaimSlot={onClaimSlot}
          onOfferCover={onOfferCover}
          onJoinEvent={onJoinEvent}
          claimingKey={claimingKey}
        />
      ))}
    </div>
  );
};

export default Gameslist;
