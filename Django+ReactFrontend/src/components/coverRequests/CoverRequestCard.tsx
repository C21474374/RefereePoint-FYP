import "./CoverRequestCard.css";
import CoverRequestStatusBadge from "./CoverRequestStatusBadge";
import type { CoverRequest } from "../../services/coverRequests";
import AppIcon from "../AppIcon";

type CoverRequestCardProps = {
  coverRequest: CoverRequest;
  canClaim?: boolean;
  canApprove?: boolean;
  canCancel?: boolean;
  canWithdrawClaim?: boolean;
  onClaim?: (id: number) => void;
  onApprove?: (id: number) => void;
  onCancel?: (id: number) => void;
  onWithdrawClaim?: (id: number) => void;
  loadingActionId?: number | null;
  isRequestedByMe?: boolean;
  isClaimedByMe?: boolean;
};

function formatGameDate(gameDetails: CoverRequest["game_details"]) {
  const dateValue = gameDetails?.date;
  const timeValue = gameDetails?.time;

  if (dateValue && timeValue) {
    return `${dateValue} ${timeValue}`;
  }

  if (dateValue) {
    return dateValue;
  }

  return "Date not available";
}

export default function CoverRequestCard({
  coverRequest,
  canClaim = false,
  canApprove = false,
  canCancel = false,
  canWithdrawClaim = false,
  onClaim,
  onApprove,
  onCancel,
  onWithdrawClaim,
  loadingActionId = null,
  isRequestedByMe = false,
  isClaimedByMe = false,
}: CoverRequestCardProps) {
  const {
    id,
    game_details,
    requested_by_name,
    original_referee_name,
    original_referee_grade,
    replaced_by_name,
    replaced_by_grade,
    role_display,
    reason,
    status,
  } = coverRequest;

  const homeTeam = game_details?.home_team_name || "Home Team";
  const awayTeam = game_details?.away_team_name || "Away Team";
  const divisionName =
    game_details?.division_display ||
    game_details?.division_name ||
    "Division not available";
  const venueName = game_details?.venue_name || "Venue not available";

  const isLoading = loadingActionId === id;

  return (
    <div className="cover-request-card">
      <div className="cover-request-card-top">
        <div>
          <h3 className="cover-request-match">
            {homeTeam} vs {awayTeam}
          </h3>
          <p className="cover-request-division">{divisionName}</p>

          <div className="cover-request-card-tags">
            {isRequestedByMe && (
              <span className="cover-request-card-tag">
                Requested by you
              </span>
            )}

            {isClaimedByMe && (
              <span className="cover-request-card-tag cover-request-card-tag-claimed">
                You claimed this
              </span>
            )}
          </div>
        </div>

        <CoverRequestStatusBadge status={status} />
      </div>

      <div className="cover-request-meta-grid">
        <div>
          <span className="cover-request-label inline-icon-label">
            <AppIcon name="calendar" />
            <span>Date</span>
          </span>
          <p className="cover-request-date-time">{formatGameDate(game_details)}</p>
        </div>

        <div>
          <span className="cover-request-label inline-icon-label">
            <AppIcon name="home" />
            <span>Venue</span>
          </span>
          <p>{venueName}</p>
        </div>

        <div>
          <span className="cover-request-label inline-icon-label">
            <AppIcon name="user" />
            <span>Role</span>
          </span>
          <p>{role_display}</p>
        </div>

        <div>
          <span className="cover-request-label">Original Referee</span>
          <p>
            {original_referee_name || "Not available"}
            {original_referee_grade ? ` (${original_referee_grade})` : ""}
          </p>
        </div>

        <div>
          <span className="cover-request-label">Requested By</span>
          <p>{requested_by_name}</p>
        </div>

        <div>
          <span className="cover-request-label">Replacement</span>
          <p>
            {replaced_by_name
              ? `${replaced_by_name}${replaced_by_grade ? ` (${replaced_by_grade})` : ""}`
              : "Not claimed yet"}
          </p>
        </div>
      </div>

      {reason && (
        <div className="cover-request-reason">
          <span className="cover-request-label">Reason</span>
          <p>{reason}</p>
        </div>
      )}

      <div className="cover-request-actions">
        {canApprove && status === "CLAIMED" && (
          <button
            className="cover-request-button"
            onClick={() => onApprove?.(id)}
            disabled={isLoading}
          >
            <span className="button-with-icon">
              <AppIcon name="approvals" />
              <span>{isLoading ? "Approving..." : "Approve Cover"}</span>
            </span>
          </button>
        )}

        {canCancel && (
          <button
            className="cover-request-button cover-request-button-cancel"
            onClick={() => onCancel?.(id)}
            disabled={isLoading}
          >
            <span className="button-with-icon">
              <AppIcon name="logout" />
              <span>{isLoading ? "Cancelling..." : "Cancel Request"}</span>
            </span>
          </button>
        )}

        {canWithdrawClaim && (
          <button
            className="cover-request-button cover-request-button-cancel"
            onClick={() => onWithdrawClaim?.(id)}
            disabled={isLoading}
          >
            <span className="button-with-icon">
              <AppIcon name="logout" />
              <span>{isLoading ? "Cancelling..." : "Cancel Claim"}</span>
            </span>
          </button>
        )}

        {canClaim && status === "PENDING" && (
          <button
            className="cover-request-button"
            onClick={() => onClaim?.(id)}
            disabled={isLoading}
          >
            <span className="button-with-icon">
              <AppIcon name="cover" />
              <span>{isLoading ? "Claiming..." : "Claim Cover"}</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
