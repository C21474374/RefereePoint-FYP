import { useCallback, useEffect, useState } from "react";
import {
  createGameReport,
  getMyReports,
  getReportableGames,
  type GameDetails,
  type GameReport,
  type ReportableGame,
} from "../services/reports";
import "../pages_css/Reports.css";

type ReportFormState = {
  match_no: string;
  incident_time: string;
  people_involved_no_1: string;
  people_involved_name_1: string;
  people_involved_no_2: string;
  people_involved_name_2: string;
  people_involved_other: string;
  incident_details: string;
  action_taken: string;
  signed_by: string;
  signed_date: string;
};

const emptyFormState: ReportFormState = {
  match_no: "",
  incident_time: "",
  people_involved_no_1: "",
  people_involved_name_1: "",
  people_involved_no_2: "",
  people_involved_name_2: "",
  people_involved_other: "",
  incident_details: "",
  action_taken: "",
  signed_by: "",
  signed_date: "",
};

function toDisplayDate(dateValue?: string | null) {
  if (!dateValue) {
    return "Date TBC";
  }
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }
  return parsed.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toDisplayDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDisplayTime(timeValue?: string | null) {
  if (!timeValue) {
    return "Time TBC";
  }
  const safeValue = timeValue.trim().slice(0, 5);
  if (safeValue.length < 4) {
    return timeValue;
  }
  return safeValue;
}

function statusClassName(status: string | null | undefined) {
  if (status === "REVIEWED") {
    return "reviewed";
  }
  if (status === "RESOLVED") {
    return "resolved";
  }
  return "pending";
}

function getErrorMessage(error: unknown, fallback: string) {
  const maybe = error as {
    response?: { data?: { detail?: string } | Record<string, unknown> };
    message?: string;
  };
  const data = maybe?.response?.data;

  if (data && typeof data === "object" && "detail" in data && typeof data.detail === "string") {
    return data.detail;
  }

  if (data && typeof data === "object") {
    const firstValue = Object.values(data)[0];
    if (typeof firstValue === "string") {
      return firstValue;
    }
    if (Array.isArray(firstValue) && typeof firstValue[0] === "string") {
      return firstValue[0];
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function gameTitle(gameDetails: GameDetails | undefined) {
  const home = gameDetails?.home_team_name || "Home Team";
  const away = gameDetails?.away_team_name || "Visitors";
  return `${home} vs ${away}`;
}

export default function Reports() {
  const [reportableGames, setReportableGames] = useState<ReportableGame[]>([]);
  const [reports, setReports] = useState<GameReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedGame, setSelectedGame] = useState<ReportableGame | null>(null);
  const [formState, setFormState] = useState<ReportFormState>(emptyFormState);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadPageData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [reportableGamesData, myReportsData] = await Promise.all([
        getReportableGames(),
        getMyReports(),
      ]);

      setReportableGames(reportableGamesData);
      setReports(myReportsData);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load reports."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    const handleRefresh = () => loadPageData();
    window.addEventListener("refereepoint:data-refresh", handleRefresh);
    return () => window.removeEventListener("refereepoint:data-refresh", handleRefresh);
  }, [loadPageData]);

  const openReportModal = (game: ReportableGame) => {
    setSuccess("");
    setSubmitError("");
    setSelectedGame(game);
    setFormState({
      ...emptyFormState,
      signed_date: getTodayIsoDate(),
    });
  };

  const closeReportModal = () => {
    if (submitting) {
      return;
    }
    setSelectedGame(null);
    setFormState(emptyFormState);
    setSubmitError("");
  };

  const handleSubmitReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedGame) {
      return;
    }

    setSubmitError("");
    setSuccess("");

    if (!formState.incident_details.trim() || !formState.action_taken.trim()) {
      setSubmitError("Incident details and action taken are required.");
      return;
    }

    try {
      setSubmitting(true);
      await createGameReport({
        game: selectedGame.game_id,
        match_no: formState.match_no.trim(),
        incident_time: formState.incident_time || null,
        people_involved_no_1: formState.people_involved_no_1.trim(),
        people_involved_name_1: formState.people_involved_name_1.trim(),
        people_involved_no_2: formState.people_involved_no_2.trim(),
        people_involved_name_2: formState.people_involved_name_2.trim(),
        people_involved_other: formState.people_involved_other.trim(),
        incident_details: formState.incident_details.trim(),
        action_taken: formState.action_taken.trim(),
        signed_by: formState.signed_by.trim(),
        signed_date: formState.signed_date || null,
      });
      closeReportModal();
      await loadPageData();
      setSuccess("Report submitted successfully.");
    } catch (err) {
      setSubmitError(getErrorMessage(err, "Failed to submit report."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reports-page">
      <div className="reports-page-header">
        <h1>Reports</h1>
        <p>
          Submit incident reports for games you refereed in the last 7 days,
          then track review status below.
        </p>
      </div>

      {loading && <p className="reports-page-message">Loading report data...</p>}
      {error && <p className="reports-page-error">{error}</p>}
      {success && <p className="reports-page-success">{success}</p>}

      {!loading && (
        <>
          <section className="reports-section">
            <div className="reports-section-header">
              <h2>Past Games (Last 7 Days)</h2>
              <p>Only completed/past games inside the 7-day report window are shown.</p>
            </div>

            {reportableGames.length === 0 ? (
              <div className="reports-empty-state">
                <p>No reportable games found in the last 7 days.</p>
              </div>
            ) : (
              <div className="reports-game-list">
                {reportableGames.map((item) => (
                  <article key={item.game_id} className="reports-game-card">
                    <div className="reports-game-card-top">
                      <h3>{gameTitle(item.game_details)}</h3>
                      {item.has_report && (
                        <span className={`reports-status-chip ${statusClassName(item.report_status)}`}>
                          {item.report_status_display || "Reported"}
                        </span>
                      )}
                    </div>

                    <p className="reports-game-meta">
                      {toDisplayDate(item.game_details?.date)} | {toDisplayTime(item.game_details?.time)} |{" "}
                      {item.game_details?.venue_name || "Venue TBC"}
                    </p>

                    <div className="reports-game-tags">
                      <span>{item.game_details?.division_display || item.game_details?.division_name || "Division TBC"}</span>
                      <span>{item.game_details?.game_type_display || "Game"}</span>
                      {item.roles_display.map((role) => (
                        <span key={`${item.game_id}-${role}`}>{role}</span>
                      ))}
                    </div>

                    <div className="reports-game-actions">
                      <button
                        type="button"
                        className="reports-action-button"
                        onClick={() => openReportModal(item)}
                        disabled={item.has_report}
                      >
                        {item.has_report ? "Report Submitted" : "Report"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="reports-section">
            <div className="reports-section-header">
              <h2>Report Status</h2>
              <p>Track your submitted reports by status: Pending, Reviewed, and Resolved.</p>
            </div>

            {reports.length === 0 ? (
              <div className="reports-empty-state">
                <p>You have not submitted any reports yet.</p>
              </div>
            ) : (
              <div className="reports-status-list">
                {reports.map((report) => (
                  <article key={report.id} className="reports-status-card">
                    <div className="reports-status-card-top">
                      <h3>{gameTitle(report.game_details)}</h3>
                      <span className={`reports-status-chip ${statusClassName(report.status)}`}>
                        {report.status_display}
                      </span>
                    </div>

                    <p className="reports-status-meta">
                      Submitted: {toDisplayDateTime(report.created_at)} | Game date:{" "}
                      {toDisplayDate(report.game_details?.date)}
                    </p>

                    <p className="reports-status-summary">
                      {report.incident_details}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {selectedGame && (
        <div className="upload-modal-overlay" onClick={closeReportModal}>
          <div className="upload-modal reports-modal" onClick={(event) => event.stopPropagation()}>
            <div className="upload-modal-header">
              <h2>Submit Match Report</h2>
              <button
                type="button"
                className="upload-modal-close"
                onClick={closeReportModal}
                disabled={submitting}
              >
                Close
              </button>
            </div>

            <div className="upload-modal-body">
              <div className="reports-modal-game-summary">
                <h3>{gameTitle(selectedGame.game_details)}</h3>
                <p>
                  {toDisplayDate(selectedGame.game_details?.date)} |{" "}
                  {toDisplayTime(selectedGame.game_details?.time)} |{" "}
                  {selectedGame.game_details?.venue_name || "Venue TBC"}
                </p>
              </div>

              {submitError && <p className="reports-page-error reports-inline-error">{submitError}</p>}

              <form className="reports-form" onSubmit={handleSubmitReport}>
                <div className="reports-form-grid">
                  <label>
                    <span>Match No</span>
                    <input
                      type="text"
                      value={formState.match_no}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, match_no: event.target.value }))
                      }
                      placeholder="Optional match reference"
                    />
                  </label>

                  <label>
                    <span>Time of Incident</span>
                    <input
                      type="time"
                      value={formState.incident_time}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, incident_time: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    <span>Signed By</span>
                    <input
                      type="text"
                      value={formState.signed_by}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, signed_by: event.target.value }))
                      }
                      placeholder="Defaults to your name"
                    />
                  </label>

                  <label>
                    <span>Signed Date</span>
                    <input
                      type="date"
                      value={formState.signed_date}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, signed_date: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    <span>People Involved No. 1</span>
                    <input
                      type="text"
                      value={formState.people_involved_no_1}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          people_involved_no_1: event.target.value,
                        }))
                      }
                      placeholder="Jersey number"
                    />
                  </label>

                  <label>
                    <span>People Involved Name 1</span>
                    <input
                      type="text"
                      value={formState.people_involved_name_1}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          people_involved_name_1: event.target.value,
                        }))
                      }
                      placeholder="Player/coach name"
                    />
                  </label>

                  <label>
                    <span>People Involved No. 2</span>
                    <input
                      type="text"
                      value={formState.people_involved_no_2}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          people_involved_no_2: event.target.value,
                        }))
                      }
                      placeholder="Jersey number"
                    />
                  </label>

                  <label>
                    <span>People Involved Name 2</span>
                    <input
                      type="text"
                      value={formState.people_involved_name_2}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          people_involved_name_2: event.target.value,
                        }))
                      }
                      placeholder="Player/coach name"
                    />
                  </label>

                  <label className="reports-form-wide">
                    <span>Other People Involved</span>
                    <textarea
                      rows={3}
                      value={formState.people_involved_other}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          people_involved_other: event.target.value,
                        }))
                      }
                      placeholder="Any additional people involved"
                    />
                  </label>

                  <label className="reports-form-wide">
                    <span>Incident Details</span>
                    <textarea
                      rows={5}
                      value={formState.incident_details}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          incident_details: event.target.value,
                        }))
                      }
                      placeholder="Describe exactly what happened."
                      required
                    />
                  </label>

                  <label className="reports-form-wide">
                    <span>Action Taken</span>
                    <textarea
                      rows={4}
                      value={formState.action_taken}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          action_taken: event.target.value,
                        }))
                      }
                      placeholder="Describe the action taken by officials."
                      required
                    />
                  </label>
                </div>

                <div className="reports-form-actions">
                  <button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit Report"}
                  </button>
                  <button type="button" onClick={closeReportModal} disabled={submitting}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
