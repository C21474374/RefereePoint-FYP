import "./CoverRequestCard.css";
import CoverRequestStatusBadge from "./CoverRequestStatusBadge";
import type { CoverRequest } from "../../services/coverRequests";

type Props = {
  coverRequest: CoverRequest;
  canClaim?: boolean;
  canApprove?: boolean;
  onClaim?: (id: number) => void;
  onApprove?: (id: number) => void;
  loadingActionId?: number | null;
};

function formatGameDate(gameDetails: CoverRequest["game_details"]) {
  const rawDate = gameDetails.match_date || gameDetails.date;
  if (!rawDate) return "Date not available";

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return rawDate;

  return parsed.toLocaleString();
}

function getVenueName(venue: CoverRequest["game_details"]["venue"]) {
  if (!venue) return "Venue not available";
  if (typeof venue === "string") return venue;
  return venue.name || "Venue not available";
}

export default function CoverRequestCard({
  coverRequest,
  canClaim = false,
  canApprove = false,
  onClaim,
  onApprove,
  loadingActionId = null,
}: Props) {
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
    custom_fee,
    status,
  } = coverRequest;

  const homeTeam = game_details?.home_team?.name || "Home Team";
  const awayTeam = game_details?.away_team?.name || "Away Team";
  const divisionName = game_details?.division?.name || "Division not available";

  const isLoading = loadingActionId === id;

  return (
    <div className="cover-request-card">
      <div className="cover-request-card-top">
        <div>
          <h3 className="cover-request-match">{homeTeam} vs {awayTeam}</h3>
          <p className="cover-request-division">{divisionName}</p>
        </div>

        <CoverRequestStatusBadge status={status} />
      </div>

      <div className="cover-request-meta-grid">
        <div>
          <span className="cover-request-label">Date</span>
          <p>{formatGameDate(game_details)}</p>
        </div>

        <div>
          <span className="cover-request-label">Venue</span>
          <p>{getVenueName(game_details?.venue)}</p>
        </div>

        <div>
          <span className="cover-request-label">Role</span>
          <p>{role_display}</p>
        </div>

        <div>
          <span className="cover-request-label">Original Referee</span>
          <p>{original_referee_name} ({original_referee_grade})</p>
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

        {custom_fee && (
          <div>
            <span className="cover-request-label">Custom Fee</span>
            <p>€{custom_fee}</p>
          </div>
        )}
      </div>

      {reason && (
        <div className="cover-request-reason">
          <span className="cover-request-label">Reason</span>
          <p>{reason}</p>
        </div>
      )}

      <div className="cover-request-actions">
        {canClaim && status === "PENDING" && (
          <button
            className="cover-request-button"
            onClick={() => onClaim?.(id)}
            disabled={isLoading}
          >
            {isLoading ? "Claiming..." : "Claim Cover"}
          </button>
        )}

        {canApprove && status === "CLAIMED" && (
          <button
            className="cover-request-button cover-request-button-approve"
            onClick={() => onApprove?.(id)}
            disabled={isLoading}
          >
            {isLoading ? "Approving..." : "Approve Cover"}
          </button>
        )}
      </div>
    </div>
  );
}