import { useCallback, useEffect, useMemo, useState } from "react";
import GamesMap from "../components/GamesMap";
import Gameslist from "../components/Gameslist";
import { getAccessToken } from "../services/auth";
import { useAuth } from "../context/AuthContext";
import {
  deleteUploadedGame,
  getMyUploadedGames,
  getUploadGameFormOptions,
  updateUploadedGame,
  type ManageUploadedGamePayload,
  type SimpleOption,
  type TeamOption,
  type UploadedGame,
} from "../services/games";
import "../pages_css/Games.css";

export type Opportunity = {
  id: number;
  type: "NON_APPOINTED_SLOT" | "COVER_REQUEST" | "EVENT";
  game_id: number;
  game_type: string;
  game_type_display: string;
  date: string;
  time: string;
  event_end_date?: string | null;
  fee_per_game?: string | null;
  referees_required?: number | null;
  joined_referees_count?: number | null;
  slots_left?: number | null;
  venue_id: number | null;
  venue_name: string | null;
  lat: number | null;
  lng: number | null;
  home_team_name: string | null;
  away_team_name: string | null;
  division_name: string | null;
  division_gender: string | null;
  payment_type: string | null;
  payment_type_display: string | null;
  role: string | null;
  role_display: string | null;
  status: string;
  status_display: string;
  posted_by_name?: string | null;
  claimed_by_name?: string | null;
  requested_by_name?: string | null;
  original_referee_name?: string | null;
  replaced_by_name?: string | null;
  description?: string;
  reason?: string;
  created_at: string;
};

type EditableGameType = "CLUB" | "SCHOOL" | "COLLEGE" | "FRIENDLY";
type EditablePaymentType = "CASH" | "REVOLUT";

const EDITABLE_GAME_TYPE_LABELS: Record<EditableGameType, string> = {
  CLUB: "Club",
  SCHOOL: "School",
  COLLEGE: "College",
  FRIENDLY: "Friendly",
};

type ManageForm = {
  game_type: EditableGameType;
  payment_type: EditablePaymentType;
  division: string;
  date: string;
  time: string;
  venue: string;
  home_team: string;
  away_team: string;
  notes: string;
  original_post_text: string;
  description: string;
  crew_chief: boolean;
  umpire_1: boolean;
};

type FormOptions = {
  divisions: SimpleOption[];
  venues: SimpleOption[];
  teams: TeamOption[];
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

const emptyForm: ManageForm = {
  game_type: "CLUB",
  payment_type: "CASH",
  division: "",
  date: "",
  time: "",
  venue: "",
  home_team: "",
  away_team: "",
  notes: "",
  original_post_text: "",
  description: "",
  crew_chief: false,
  umpire_1: false,
};

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

function formFromGame(game: UploadedGame): ManageForm {
  const roles = new Set(game.uploaded_slots.map((slot) => slot.role));
  const gameType: EditableGameType =
    game.game_type === "SCHOOL" || game.game_type === "COLLEGE" || game.game_type === "FRIENDLY"
      ? game.game_type
      : "CLUB";
  const paymentType: EditablePaymentType = game.payment_type === "REVOLUT" ? "REVOLUT" : "CASH";
  const description = game.uploaded_slots.find((slot) => slot.description)?.description || "";

  return {
    game_type: gameType,
    payment_type: paymentType,
    division: game.division ? String(game.division) : "",
    date: game.date || "",
    time: game.time ? game.time.slice(0, 5) : "",
    venue: game.venue ? String(game.venue) : "",
    home_team: game.home_team ? String(game.home_team) : "",
    away_team: game.away_team ? String(game.away_team) : "",
    notes: game.notes || "",
    original_post_text: game.original_post_text || "",
    description,
    crew_chief: roles.has("CREW_CHIEF"),
    umpire_1: roles.has("UMPIRE_1"),
  };
}

export default function Games() {
  const { user } = useAuth();
  const isRefereeUser = Boolean(user?.referee_profile);

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [uploadedGames, setUploadedGames] = useState<UploadedGame[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [manageError, setManageError] = useState("");
  const [manageActionId, setManageActionId] = useState<number | null>(null);

  const [editingGame, setEditingGame] = useState<UploadedGame | null>(null);
  const [editForm, setEditForm] = useState<ManageForm>(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [optionsLoading, setOptionsLoading] = useState(false);
  const [formOptions, setFormOptions] = useState<FormOptions>({
    divisions: [],
    venues: [],
    teams: [],
  });

  const getOpportunityKey = (type: Opportunity["type"], id: number) => `${type}-${id}`;

  const loadPageData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token = getAccessToken();
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
      const opportunitiesPromise = isRefereeUser
        ? fetch(`${API_BASE_URL}/games/opportunities/`, {
            headers: authHeaders,
          })
        : Promise.resolve(null);
      const uploadsPromise = token ? getMyUploadedGames() : Promise.resolve([]);

      const [opportunitiesResponse, uploads] = await Promise.all([
        opportunitiesPromise,
        uploadsPromise,
      ]);

      if (opportunitiesResponse) {
        if (!opportunitiesResponse.ok) {
          throw new Error("Failed to fetch opportunities.");
        }
        setOpportunities((await opportunitiesResponse.json()) as Opportunity[]);
      } else {
        setOpportunities([]);
      }
      setUploadedGames(uploads);
    } catch (err) {
      setError(getErrorMessage(err, "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }, [isRefereeUser]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    const handleRefresh = () => loadPageData();
    window.addEventListener("refereepoint:data-refresh", handleRefresh);
    return () => window.removeEventListener("refereepoint:data-refresh", handleRefresh);
  }, [loadPageData]);

  const ensureOptionsLoaded = useCallback(async () => {
    if (formOptions.divisions.length && formOptions.venues.length && formOptions.teams.length) {
      return;
    }
    setOptionsLoading(true);
    try {
      const options = await getUploadGameFormOptions();
      setFormOptions(options);
    } finally {
      setOptionsLoading(false);
    }
  }, [formOptions.divisions.length, formOptions.teams.length, formOptions.venues.length]);

  const handleClaimSlot = async (slotId: number) => {
    try {
      setClaimingKey(getOpportunityKey("NON_APPOINTED_SLOT", slotId));
      setError("");
      const token = getAccessToken();
      if (!token) {
        throw new Error("You must be logged in to take a game.");
      }
      const response = await fetch(`${API_BASE_URL}/games/non-appointed-slots/${slotId}/claim/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to claim slot.");
      }
      await loadPageData();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to claim slot."));
    } finally {
      setClaimingKey(null);
    }
  };

  const handleOfferCover = async (coverRequestId: number) => {
    try {
      setClaimingKey(getOpportunityKey("COVER_REQUEST", coverRequestId));
      setError("");
      const token = getAccessToken();
      if (!token) {
        throw new Error("You must be logged in to offer cover.");
      }
      const response = await fetch(`${API_BASE_URL}/cover-requests/${coverRequestId}/offer/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to offer cover.");
      }
      await loadPageData();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to offer cover."));
    } finally {
      setClaimingKey(null);
    }
  };

  const handleJoinEvent = async (eventId: number) => {
    try {
      setClaimingKey(getOpportunityKey("EVENT", eventId));
      setError("");
      const token = getAccessToken();
      if (!token) {
        throw new Error("You must be logged in to join an event.");
      }
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/join/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to join event.");
      }
      await loadPageData();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to join event."));
    } finally {
      setClaimingKey(null);
    }
  };

  const openEditModal = async (game: UploadedGame) => {
    setManageError("");
    setEditingGame(game);
    setEditForm(formFromGame(game));
    try {
      await ensureOptionsLoaded();
    } catch (err) {
      setManageError(getErrorMessage(err, "Failed to load game form options."));
    }
  };

  const closeEditModal = () => {
    if (editSubmitting) {
      return;
    }
    setEditingGame(null);
    setEditForm(emptyForm);
  };

  const saveEditedGame = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingGame) {
      return;
    }

    setManageError("");
    if (
      !editForm.division ||
      !editForm.venue ||
      !editForm.home_team ||
      !editForm.away_team ||
      !editForm.date ||
      !editForm.time
    ) {
      setManageError("Please complete all required fields.");
      return;
    }
    if (editForm.home_team === editForm.away_team) {
      setManageError("Home team and away team must be different.");
      return;
    }
    if (!editForm.crew_chief && !editForm.umpire_1) {
      setManageError("Select at least one role to keep active.");
      return;
    }

    const slots: ManageUploadedGamePayload["slots"] = [];
    if (editForm.crew_chief) {
      slots.push({ role: "CREW_CHIEF", description: editForm.description.trim() });
    }
    if (editForm.umpire_1) {
      slots.push({ role: "UMPIRE_1", description: editForm.description.trim() });
    }

    const payload: ManageUploadedGamePayload = {
      game_type: editForm.game_type,
      payment_type: editForm.payment_type,
      division: Number(editForm.division),
      date: editForm.date,
      time: editForm.time,
      venue: Number(editForm.venue),
      home_team: Number(editForm.home_team),
      away_team: Number(editForm.away_team),
      notes: editForm.notes,
      original_post_text: editForm.original_post_text,
      slots,
    };

    try {
      setEditSubmitting(true);
      setManageActionId(editingGame.id);
      await updateUploadedGame(editingGame.id, payload);
      setEditingGame(null);
      setEditForm(emptyForm);
      await loadPageData();
    } catch (err) {
      setManageError(getErrorMessage(err, "Failed to update uploaded game."));
    } finally {
      setEditSubmitting(false);
      setManageActionId(null);
    }
  };

  const handleDeleteUploaded = async (gameId: number) => {
    if (!window.confirm("Delete this uploaded game and its slots?")) {
      return;
    }
    try {
      setManageError("");
      setManageActionId(gameId);
      await deleteUploadedGame(gameId);
      await loadPageData();
    } catch (err) {
      setManageError(getErrorMessage(err, "Failed to delete uploaded game."));
    } finally {
      setManageActionId(null);
    }
  };

  const filteredOpportunities = useMemo(() => {
    let filtered = [...opportunities];
    if (selectedVenueId !== null) {
      filtered = filtered.filter((item) => item.venue_id === selectedVenueId);
    }
    if (selectedType !== "ALL") {
      filtered = filtered.filter((item) => item.type === selectedType);
    }
    return filtered;
  }, [opportunities, selectedVenueId, selectedType]);

  const manageableUploadedGames = useMemo(
    () => uploadedGames.filter((game) => game.can_edit && game.can_delete),
    [uploadedGames]
  );

  const editableDivisionOptions = useMemo(
    () => formOptions.divisions.filter((division) => !division.requires_appointed_referees),
    [formOptions.divisions]
  );

  const editableGameTypeOptions = useMemo(() => {
    const allowed = (user?.allowed_upload_game_types || []).filter((gameType) =>
      ["CLUB", "SCHOOL", "COLLEGE", "FRIENDLY"].includes(gameType)
    ) as EditableGameType[];

    if (allowed.length > 0) {
      return allowed;
    }

    return ["CLUB", "SCHOOL", "COLLEGE", "FRIENDLY"] as EditableGameType[];
  }, [user?.allowed_upload_game_types]);

  return (
    <div className="games-page">
      <div className="games-header">
        <div>
          <h1>{isRefereeUser ? "Opportunities" : "Games"}</h1>
          <p>
            {isRefereeUser
              ? "Find non-appointed games, cover requests, and events."
              : "Upload and manage the games your organisation has posted."}
          </p>
        </div>
        {isRefereeUser && (
          <div className="games-filters">
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
              className="games-filter-select"
            >
              <option value="ALL">All Opportunities</option>
              <option value="NON_APPOINTED_SLOT">Non-Appointed Games</option>
              <option value="COVER_REQUEST">Cover Requests</option>
              <option value="EVENT">Events</option>
            </select>
            <button
              className="clear-venue-btn"
              onClick={() => setSelectedVenueId(null)}
              disabled={selectedVenueId === null}
            >
              Clear Venue
            </button>
          </div>
        )}
      </div>

      {loading && <p className="games-info-message">Loading opportunities...</p>}
      {error && <p className="games-error-message">{error}</p>}

      {!loading && !error && isRefereeUser && (
        <div className="games-content">
          <div className="games-map-panel">
            <GamesMap
              opportunities={filteredOpportunities}
              selectedVenueId={selectedVenueId}
              onVenueSelect={setSelectedVenueId}
            />
          </div>
          <div className="games-list-panel">
            <Gameslist
              opportunities={filteredOpportunities}
              onClaimSlot={handleClaimSlot}
              onOfferCover={handleOfferCover}
              onJoinEvent={handleJoinEvent}
              claimingKey={claimingKey}
            />
          </div>
        </div>
      )}

      <section className="games-manage-section">
        <div className="games-manage-header">
          <h2>Manage Uploaded Games</h2>
          <p>Games you uploaded. Edit or delete your uploaded game opportunities.</p>
        </div>

        {manageError && <p className="games-manage-error">{manageError}</p>}

        {manageableUploadedGames.length === 0 ? (
          <p className="games-manage-empty">
            No editable uploaded games right now.
          </p>
        ) : (
          <div className="games-manage-list">
            {manageableUploadedGames.map((game) => (
              <article key={game.id} className="games-manage-item">
                <div className="games-manage-item-top">
                  <div>
                    <h3>{game.home_team_name || "Home Team"} vs {game.away_team_name || "Away Team"}</h3>
                    <p>
                      {game.division_display || game.division_name || "Division"} | {game.date}{" "}
                      {game.time?.slice(0, 5)} | {game.venue_name || "Venue TBC"}
                    </p>
                  </div>
                  <div className="games-manage-actions">
                    <button
                      type="button"
                      className="games-manage-button"
                      onClick={() => openEditModal(game)}
                      disabled={manageActionId === game.id}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="games-manage-button games-manage-button-danger"
                      onClick={() => handleDeleteUploaded(game.id)}
                      disabled={manageActionId === game.id}
                    >
                      {manageActionId === game.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>

                <div className="games-manage-tags">
                  <span>{game.game_type_display}</span>
                  <span>{game.payment_type_display || "Payment TBC"}</span>
                  {game.uploaded_slots.map((slot) => (
                    <span key={`${game.id}-${slot.id}`}>
                      {slot.role_display}: {slot.status_display}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editingGame && (
        <div className="upload-modal-overlay" onClick={closeEditModal}>
          <div className="upload-modal manage-game-modal" onClick={(event) => event.stopPropagation()}>
            <div className="upload-modal-header">
              <h2>Edit Uploaded Game</h2>
              <button type="button" className="upload-modal-close" onClick={closeEditModal}>
                Close
              </button>
            </div>
            <div className="upload-modal-body">
              {optionsLoading ? (
                <p className="upload-modal-state">Loading game form...</p>
              ) : (
                <form className="games-manage-form" onSubmit={saveEditedGame}>
                  <div className="games-manage-form-grid">
                    <label><span>Game Type</span><select value={editForm.game_type} onChange={(e) => setEditForm((prev) => ({ ...prev, game_type: e.target.value as EditableGameType }))}>{editableGameTypeOptions.map((gameType) => <option key={gameType} value={gameType}>{EDITABLE_GAME_TYPE_LABELS[gameType]}</option>)}</select></label>
                    <label><span>Payment Type</span><select value={editForm.payment_type} onChange={(e) => setEditForm((prev) => ({ ...prev, payment_type: e.target.value as EditablePaymentType }))}><option value="CASH">Cash</option><option value="REVOLUT">Revolut</option></select></label>
                    <label><span>Division</span><select value={editForm.division} onChange={(e) => setEditForm((prev) => ({ ...prev, division: e.target.value }))} required><option value="">Select division</option>{editableDivisionOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                    <label><span>Venue</span><select value={editForm.venue} onChange={(e) => setEditForm((prev) => ({ ...prev, venue: e.target.value }))} required><option value="">Select venue</option>{formOptions.venues.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                    <label><span>Home Team</span><select value={editForm.home_team} onChange={(e) => setEditForm((prev) => ({ ...prev, home_team: e.target.value }))} required><option value="">Select home team</option>{formOptions.teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                    <label><span>Away Team</span><select value={editForm.away_team} onChange={(e) => setEditForm((prev) => ({ ...prev, away_team: e.target.value }))} required><option value="">Select away team</option>{formOptions.teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                    <label><span>Date</span><input type="date" value={editForm.date} onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))} required /></label>
                    <label><span>Time</span><input type="time" value={editForm.time} onChange={(e) => setEditForm((prev) => ({ ...prev, time: e.target.value }))} required /></label>
                    <label className="games-manage-form-wide"><span>Slot Description</span><textarea rows={3} value={editForm.description} onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))} /></label>
                    <label className="games-manage-form-wide"><span>Notes</span><textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))} /></label>
                    <label className="games-manage-form-wide"><span>Original Post Text</span><textarea rows={4} value={editForm.original_post_text} onChange={(e) => setEditForm((prev) => ({ ...prev, original_post_text: e.target.value }))} /></label>
                  </div>
                  <div className="games-manage-role-row">
                    <label className="games-manage-role-option"><input type="checkbox" checked={editForm.crew_chief} onChange={(e) => setEditForm((prev) => ({ ...prev, crew_chief: e.target.checked }))} />Crew Chief Slot</label>
                    <label className="games-manage-role-option"><input type="checkbox" checked={editForm.umpire_1} onChange={(e) => setEditForm((prev) => ({ ...prev, umpire_1: e.target.checked }))} />Umpire 1 Slot</label>
                  </div>
                  <div className="games-manage-form-actions">
                    <button type="submit" disabled={editSubmitting}>{editSubmitting ? "Saving..." : "Save Changes"}</button>
                    <button type="button" onClick={closeEditModal} disabled={editSubmitting}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
