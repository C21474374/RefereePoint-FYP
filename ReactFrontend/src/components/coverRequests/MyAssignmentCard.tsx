import "./MyAssignmentCard.css";
import type { UpcomingAssignment } from "../../services/coverRequests";

type Props = {
  assignment: UpcomingAssignment;
  onRequestCover: (assignment: UpcomingAssignment) => void;
  loading?: boolean;
};

function formatGameDate(gameDetails: UpcomingAssignment["game_details"]) {
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

export default function MyAssignmentCard({
  assignment,
  onRequestCover,
  loading = false,
}: Props) {
  const homeTeam = assignment.game_details?.home_team_name || "Home Team";
  const awayTeam = assignment.game_details?.away_team_name || "Away Team";
  const divisionName = assignment.game_details?.division_name || "Division not available";
  const venueName = assignment.game_details?.venue_name || "Venue not available";

  return (
    <div className="my-assignment-card">
      <div className="my-assignment-card-top">
        <div>
          <h3>{homeTeam} vs {awayTeam}</h3>
          <p>{divisionName}</p>
        </div>
        <span className="my-assignment-role">{assignment.role_display}</span>
      </div>

      <div className="my-assignment-meta">
        <p>
          <strong>Date:</strong>
          <span className="my-assignment-date-time">{formatGameDate(assignment.game_details)}</span>
        </p>
        <p><strong>Venue:</strong> {venueName}</p>
      </div>

      <div className="my-assignment-actions">
        {assignment.has_active_cover_request ? (
          <span className="my-assignment-existing-request">
            Cover request already active
          </span>
        ) : (
          <button
            className="my-assignment-button"
            onClick={() => onRequestCover(assignment)}
            disabled={loading}
          >
            {loading ? "Requesting..." : "Request Cover"}
          </button>
        )}
      </div>
    </div>
  );
}
