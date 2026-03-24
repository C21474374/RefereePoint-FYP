import type { Opportunity } from "../pages/Games";
import { useAuth } from "../context/AuthContext";

type GameCardProps = {
  opportunity: Opportunity;
  onClaimSlot: (slotId: number) => void;
  onOfferCover: (coverRequestId: number) => void;
  claimingKey?: string | null;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

const formatTime = (timeString: string) => {
  const [hours, minutes] = timeString.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes));

  return date.toLocaleTimeString("en-IE", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const buildTitle = (opportunity: Opportunity) => {
  const home = opportunity.home_team_name ?? "Home Team";
  const away = opportunity.away_team_name ?? "Away Team";
  return `${home} vs ${away}`;
};

const GameCard = ({
  opportunity,
  onClaimSlot,
  onOfferCover,
  claimingKey = null,
}: GameCardProps) => {
  const { user, isAuthenticated } = useAuth();

  const isNonAppointed = opportunity.type === "NON_APPOINTED_SLOT";
  const isCoverRequest = opportunity.type === "COVER_REQUEST";

  const actionLabel = isNonAppointed ? "Take Game" : "Claim Cover";

  const userGrade = user?.referee_profile?.grade ?? null;

  const canTakeCrewChief =
    opportunity.role !== "CREW_CHIEF" || userGrade !== "INTRO";

  const isClaimingThisCard = claimingKey === `${opportunity.type}-${opportunity.id}`;

  const actionDisabled =
    !isAuthenticated ||
    (isNonAppointed && !canTakeCrewChief) ||
    isClaimingThisCard;

  const handleActionClick = () => {
    if (isNonAppointed) {
      onClaimSlot(opportunity.id);
      return;
    }

    onOfferCover(opportunity.id);
  };

  return (
    <div className="game-card">
      <div className="game-card-top">
        <span className={`game-card-type ${isNonAppointed ? "non-appointed" : "cover-request"}`}>
          {isNonAppointed ? "Non-Appointed Game" : "Cover Request"}
        </span>

        {opportunity.role_display && (
          <span className="game-card-role">{opportunity.role_display}</span>
        )}
      </div>

      <h3 className="game-card-title">{buildTitle(opportunity)}</h3>

      <div className="game-card-meta">
        <span>{formatDate(opportunity.date)}</span>
        <span>•</span>
        <span>{formatTime(opportunity.time)}</span>
      </div>

      <div className="game-card-venue">{opportunity.venue_name ?? "Venue TBC"}</div>

      <div className="game-card-tags">
        {opportunity.game_type_display && (
          <span className="game-tag game-tag-primary">
            {opportunity.game_type_display}
          </span>
        )}

        {opportunity.role_display && (
          <span className="game-tag game-tag-role">
            {opportunity.role_display}
          </span>
        )}

        {opportunity.division_name && (
          <span className="game-tag">
            {opportunity.division_name}
            {opportunity.division_gender ? ` ${opportunity.division_gender}` : ""}
          </span>
        )}

        {opportunity.payment_type_display && (
          <span className="game-tag game-tag-payment">
            {opportunity.payment_type_display}
          </span>
        )}

        {opportunity.status === "CLAIMED" && opportunity.claimed_by_name && (
          <span className="game-tag game-tag-claimed">
            Claimed by {opportunity.claimed_by_name}
          </span>
        )}
      </div>

      {isNonAppointed && opportunity.description && (
        <p className="game-card-extra">{opportunity.description}</p>
      )}

      {isCoverRequest && (
        <div className="game-card-extra">
          {opportunity.original_referee_name && (
            <p>
              <strong>Original ref:</strong> {opportunity.original_referee_name}
            </p>
          )}
          {opportunity.requested_by_name && (
            <p>
              <strong>Requested by:</strong> {opportunity.requested_by_name}
            </p>
          )}
          {opportunity.reason && (
            <p>
              <strong>Reason:</strong> {opportunity.reason}
            </p>
          )}
        </div>
      )}

      <div className="game-card-actions">
        <button
          className="take-game-btn"
          onClick={handleActionClick}
          disabled={actionDisabled}
        >
          {isClaimingThisCard
            ? isNonAppointed
              ? "Claiming..."
              : "Offering..."
            : actionLabel}
        </button>

        {!isAuthenticated && (
          <small className="game-card-warning">
            Log in to take games.
          </small>
        )}

        {isAuthenticated && !canTakeCrewChief && (
          <small className="game-card-warning">
            Intro referees cannot take Crew Chief.
          </small>
        )}
      </div>
    </div>
  );
};

export default GameCard;
