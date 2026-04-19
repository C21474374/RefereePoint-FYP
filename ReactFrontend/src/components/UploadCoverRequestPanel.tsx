import { useEffect, useMemo, useState } from "react";
import {
  createCoverRequest,
  getMyUpcomingAssignments,
  type UpcomingAssignment,
} from "../services/coverRequests";
import { useToast } from "../context/ToastContext";

type UploadCoverRequestPanelProps = {
  onUploaded?: () => void;
};

export default function UploadCoverRequestPanel({
  onUploaded,
}: UploadCoverRequestPanelProps) {
  const { showToast } = useToast();
  const [assignments, setAssignments] = useState<UpcomingAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadAssignments() {
      try {
        setLoading(true);
        setErrorMessage("");
        const data = await getMyUpcomingAssignments();
        setAssignments(data);
      } catch (error) {
        setErrorMessage("Failed to load your games.");
        showToast("Failed to load your games.", "error");
      } finally {
        setLoading(false);
      }
    }

    loadAssignments();
  }, []);

  const availableAssignments = useMemo(
    () => assignments.filter((assignment) => !assignment.has_active_cover_request),
    [assignments]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const assignment = availableAssignments.find(
      (item) => String(item.assignment_id) === selectedAssignmentId
    );

    if (!assignment) {
      setErrorMessage("Please select one of your upcoming games.");
      return;
    }

    try {
      setSubmitting(true);
      await createCoverRequest({
        game: assignment.game_id,
        referee_slot: assignment.assignment_id,
        reason: reason.trim(),
      });
      showToast("Cover request submitted successfully.", "success");
      onUploaded?.();
    } catch (error) {
      setErrorMessage("Failed to upload cover request.");
      showToast("Failed to upload cover request.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="upload-modal-state">Loading your upcoming games...</p>;
  }

  if (availableAssignments.length === 0) {
    return (
      <p className="upload-modal-state">
        No eligible upcoming games found. You already have active cover requests or no appointed games.
      </p>
    );
  }

  return (
    <form className="upload-cover-form" onSubmit={handleSubmit}>
      {errorMessage && <p className="upload-modal-state error">{errorMessage}</p>}

      <label className="upload-cover-field">
        <span>My Upcoming Game</span>
        <select
          value={selectedAssignmentId}
          onChange={(e) => setSelectedAssignmentId(e.target.value)}
          required
        >
          <option value="">Select a game</option>
          {availableAssignments.map((assignment) => {
            const home = assignment.game_details?.home_team_name || "Home Team";
            const away = assignment.game_details?.away_team_name || "Away Team";
            const division = assignment.game_details?.division_name || "Division";
            const date = assignment.game_details?.date || "";
            const time = assignment.game_details?.time || "";
            const venue = assignment.game_details?.venue_name || "Venue TBC";

            return (
              <option key={assignment.assignment_id} value={assignment.assignment_id}>
                {home} vs {away} | {division} | {date} {time} | {venue}
              </option>
            );
          })}
        </select>
      </label>

      <label className="upload-cover-field">
        <span>Reason (Optional)</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Add context for why cover is needed..."
        />
      </label>

      <div className="upload-cover-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? "Uploading..." : "Upload Cover Request"}
        </button>
      </div>
    </form>
  );
}
