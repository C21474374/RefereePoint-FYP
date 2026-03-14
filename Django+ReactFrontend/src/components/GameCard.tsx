import type { Opportunity } from "../pages/Games";
import { mockCurrentUser } from "../mockauth";

type GameCardProps = {
  opportunity: Opportunity;
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

  if (opportunity.type === "COVER_REQUEST") {
    return `${home} vs ${away}`;
  }

  return `${home} vs ${away}`;
};

const GameCard = ({ opportunity }: GameCardProps) => {
  const isNonAppointed = opportunity.type === "NON_APPOINTED_SLOT";
  const isCoverRequest = opportunity.type === "COVER_REQUEST";

  const actionLabel = isNonAppointed ? "Take Game" : "Offer Cover";

  const canTakeCrewChief =
    opportunity.role !== "CREW_CHIEF" || mockCurrentUser.grade !== "INTRO";

  const actionDisabled = !mockCurrentUser.isLoggedIn || !canTakeCrewChief;

  const handlePlaceholderAction = () => {
    window.alert("Auth/login will be connected later.");
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
          <span className="game-tag">{opportunity.game_type_display}</span>
        )}

        {opportunity.source_type_display && (
          <span className="game-tag">{opportunity.source_type_display}</span>
        )}

        {opportunity.division_name && (
          <span className="game-tag">{opportunity.division_name}</span>
        )}

        {opportunity.payment_type_display && (
          <span className="game-tag">{opportunity.payment_type_display}</span>
        )}

        {opportunity.status_display && (
          <span className="game-tag">{opportunity.status_display}</span>
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
          onClick={handlePlaceholderAction}
          disabled={actionDisabled}
        >
          {actionLabel}
        </button>

        {!canTakeCrewChief && (
          <small className="game-card-warning">
            Intro referees cannot take Crew Chief.
          </small>
        )}
      </div>
    </div>
  );
};

export default GameCard;