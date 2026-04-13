import { useMemo, useState } from "react";
import type { Opportunity } from "../pages/Games";
import { useAuth } from "../context/AuthContext";
import AppIcon from "./AppIcon";
import GameDetailsModal, { type GameDetailsModalData } from "./GameDetailsModal";

type GameCardProps = {
  opportunity: Opportunity;
  onClaimSlot: (slotId: number) => void;
  onOfferCover: (coverRequestId: number) => void;
  onJoinEvent: (eventId: number) => void;
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
  if (opportunity.type === "EVENT") {
    return opportunity.venue_name ?? "Tournament Event";
  }

  const home = opportunity.home_team_name ?? "Home Team";
  const away = opportunity.away_team_name ?? "Away Team";
  return `${home} vs ${away}`;
};

const GameCard = ({
  opportunity,
  onClaimSlot,
  onOfferCover,
  onJoinEvent,
  claimingKey = null,
}: GameCardProps) => {
  const { user, isAuthenticated } = useAuth();

  const isNonAppointed = opportunity.type === "NON_APPOINTED_SLOT";
  const isCoverRequest = opportunity.type === "COVER_REQUEST";
  const isEvent = opportunity.type === "EVENT";
  const typeClassName = isNonAppointed
    ? "non-appointed"
    : isCoverRequest
      ? "cover-request"
      : "event";

  const actionLabel = isNonAppointed
    ? "Take Game"
    : isCoverRequest
      ? "Claim Cover"
      : "Join Event";

  const userGrade = user?.referee_profile?.grade ?? null;

  const canTakeCrewChief =
    opportunity.role !== "CREW_CHIEF" || userGrade !== "INTRO";

  const isClaimingThisCard = claimingKey === `${opportunity.type}-${opportunity.id}`;
  const [detailsOpen, setDetailsOpen] = useState(false);

  const actionDisabled =
    !isAuthenticated ||
    (isNonAppointed && !canTakeCrewChief) ||
    isClaimingThisCard;

  const handleActionClick = () => {
    if (isNonAppointed) {
      onClaimSlot(opportunity.id);
      return;
    }

    if (isCoverRequest) {
      onOfferCover(opportunity.id);
      return;
    }

    onJoinEvent(opportunity.id);
  };

  const typeLabel = isNonAppointed
    ? "Non-Appointed Game"
    : isCoverRequest
      ? "Cover Request"
      : "Event";

  const actionHelpText =
    !isAuthenticated
      ? "Log in to take games."
      : !canTakeCrewChief
        ? "Intro referees cannot take Crew Chief."
        : null;

  const recommendationScore =
    typeof opportunity.recommendation_score === "number"
      ? Math.round(opportunity.recommendation_score)
      : null;
  const recommendationReasons = opportunity.recommendation_reasons || [];

  const modalDetails = useMemo<GameDetailsModalData>(() => {
    const divisionDisplay = opportunity.division_name
      ? `${opportunity.division_name}${opportunity.division_gender ? ` ${opportunity.division_gender}` : ""}`
      : null;

    return {
      id: `${opportunity.type}-${opportunity.id}`,
      title: buildTitle(opportunity),
      typeLabel,
      badge: opportunity.status_display,
      date: opportunity.date,
      time: isEvent ? null : opportunity.time,
      endDate: opportunity.event_end_date || null,
      venueName: opportunity.venue_name || "Venue TBC",
      latitude: opportunity.lat,
      longitude: opportunity.lng,
      roleDisplay: opportunity.role_display,
      gameTypeDisplay: opportunity.game_type_display,
      divisionDisplay,
      paymentTypeDisplay: opportunity.payment_type_display,
      statusDisplay: opportunity.status_display,
      description: opportunity.description || null,
      reason: opportunity.reason || null,
      originalRefereeName: opportunity.original_referee_name || null,
      requestedByName: opportunity.requested_by_name || null,
      claimedByName: opportunity.claimed_by_name || null,
      postedByName: opportunity.posted_by_name || null,
      feePerGame: opportunity.fee_per_game || null,
      joinedRefereesCount: opportunity.joined_referees_count ?? null,
      slotsLeft: opportunity.slots_left ?? null,
    };
  }, [isEvent, opportunity, typeLabel]);

  return (
    <>
      <div className="game-card">
        <div className="game-card-top">
          <span className={`game-card-type ${typeClassName}`}>
            <span className="inline-icon-label">
              <AppIcon name={isEvent ? "events" : isCoverRequest ? "cover" : "games"} />
              <span>{typeLabel}</span>
            </span>
          </span>

          {opportunity.role_display && (
            <span className="game-card-role inline-icon-label">
              <AppIcon name="user" />
              <span>{opportunity.role_display}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          className="game-card-title-button"
          onClick={() => setDetailsOpen(true)}
        >
          <h3 className="game-card-title">{buildTitle(opportunity)}</h3>
        </button>

        <div className="game-card-meta">
          {isEvent ? (
            <span className="inline-icon-label">
              <AppIcon name="calendar" />
              <span>
                {formatDate(opportunity.date)}
                {opportunity.event_end_date ? ` to ${formatDate(opportunity.event_end_date)}` : ""}
              </span>
            </span>
          ) : (
            <>
              <span className="inline-icon-label">
                <AppIcon name="calendar" />
                <span>{formatDate(opportunity.date)}</span>
              </span>
              <span>|</span>
              <span className="inline-icon-label">
                <AppIcon name="time" />
                <span>{formatTime(opportunity.time)}</span>
              </span>
            </>
          )}
        </div>

        <div className="game-card-venue inline-icon-label">
          <AppIcon name="home" />
          <span>{opportunity.venue_name ?? "Venue TBC"}</span>
        </div>

        {recommendationScore !== null && (
          <div className="game-card-recommendation">
            <span className="game-card-recommendation-score">Match {recommendationScore}/100</span>
            {recommendationReasons.length > 0 && (
              <div className="game-card-recommendation-reasons">
                {recommendationReasons.map((reason) => (
                  <span key={`${opportunity.type}-${opportunity.id}-${reason}`} className="game-card-reason-chip">
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="game-card-actions">
          <button
            type="button"
            className="game-card-view-btn"
            onClick={() => setDetailsOpen(true)}
          >
            <span className="button-with-icon">
              <AppIcon name="reports" />
              <span>View Details</span>
            </span>
          </button>
        </div>
      </div>

      <GameDetailsModal
        open={detailsOpen}
        details={modalDetails}
        onClose={() => setDetailsOpen(false)}
        onAction={handleActionClick}
        actionLabel={actionLabel}
        actionDisabled={actionDisabled}
        actionBusy={isClaimingThisCard}
        actionBusyLabel={
          isNonAppointed ? "Claiming..." : isCoverRequest ? "Offering..." : "Joining..."
        }
        actionHelpText={actionHelpText}
      />
    </>
  );
};

export default GameCard;
