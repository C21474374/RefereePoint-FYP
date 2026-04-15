import { useCallback, useEffect, useMemo, useState } from "react";
import GamesMap from "../components/GamesMap";
import Gameslist from "../components/Gameslist";
import AppIcon from "../components/AppIcon";
import ConfirmDialog from "../components/ConfirmDialog";
import BulkGameUpload from "./BulkGameUpload";
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
import { hasGameUploadAccess, hasRefereeAccess } from "../utils/access";
import { useToast } from "../context/ToastContext";
import "./Games.css";

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
  recommendation_score?: number;
  recommendation_reasons?: string[];
  is_recommended?: boolean;
};

type RecommendedOpportunitiesResponse = {
  recommended_count?: number;
  items?: Opportunity[];
};

type GamesSectionKey = "manageUploadedGames";

type ManageGameType = UploadedGame["game_type"];
type ManagePaymentType = "CASH" | "REVOLUT" | "CLAIM";

const MANAGE_GAME_TYPE_LABELS: Record<ManageGameType, string> = {
  CLUB: "Club",
  SCHOOL: "School",
  COLLEGE: "College",
  FRIENDLY: "Friendly",
  DOA: "DOA",
  NL: "National League",
};

const NON_APPOINTED_MANAGE_GAME_TYPES = new Set<UploadedGame["game_type"]>([
  "CLUB",
  "SCHOOL",
  "COLLEGE",
  "FRIENDLY",
]);

type ManageForm = {
  game_type: ManageGameType;
  payment_type: ManagePaymentType;
  division: string;
  date: string;
  time: string;
  venue: string;
  home_team: string;
  away_team: string;
  crew_chief: boolean;
  umpire_1: boolean;
};

type FormOptions = {
  divisions: SimpleOption[];
  venues: SimpleOption[];
  teams: TeamOption[];
};

const API_BASE_URL = "http://127.0.0.1:8000/api";
// Persisted per-user UI state so filters/collapsed sections restore on revisit.
const GAMES_PREFS_KEY_PREFIX = "refereepoint.games.prefs";

const emptyForm: ManageForm = {
  game_type: "CLUB",
  payment_type: "CASH",
  division: "",
  date: "",
  time: "",
  venue: "",
  home_team: "",
  away_team: "",
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
  const gameType: ManageGameType = game.game_type;
  const paymentType: ManagePaymentType =
    game.payment_type === "REVOLUT"
      ? "REVOLUT"
      : game.payment_type === "CLAIM"
        ? "CLAIM"
        : "CASH";
  return {
    game_type: gameType,
    payment_type: paymentType,
    division: game.division ? String(game.division) : "",
    date: game.date || "",
    time: game.time ? game.time.slice(0, 5) : "",
    venue: game.venue ? String(game.venue) : "",
    home_team: game.home_team ? String(game.home_team) : "",
    away_team: game.away_team ? String(game.away_team) : "",
    crew_chief: roles.has("CREW_CHIEF"),
    umpire_1: roles.has("UMPIRE_1"),
  };
}

export default function Games() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isRefereeUser = hasRefereeAccess(user);
  const canManageUploadedGames = hasGameUploadAccess(user);
  const isDoaOrNlUploader =
    canManageUploadedGames && (user?.account_type === "DOA" || user?.account_type === "NL");

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [uploadedGames, setUploadedGames] = useState<UploadedGame[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [manageError, setManageError] = useState("");
  const [manageActionId, setManageActionId] = useState<number | null>(null);
  const [pendingDeleteGameId, setPendingDeleteGameId] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<GamesSectionKey, boolean>>({
    manageUploadedGames: false,
  });

  const [editingGame, setEditingGame] = useState<UploadedGame | null>(null);
  const [editForm, setEditForm] = useState<ManageForm>(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [optionsLoading, setOptionsLoading] = useState(false);
  const [formOptions, setFormOptions] = useState<FormOptions>({
    divisions: [],
    venues: [],
    teams: [],
  });
  const [manageMonthFilter, setManageMonthFilter] = useState("ALL");

  const toggleSection = (key: GamesSectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") {
      return;
    }

    const storageKey = `${GAMES_PREFS_KEY_PREFIX}.${user.id}`;
    try {
      const rawValue = window.localStorage.getItem(storageKey);
      if (!rawValue) {
        return;
      }

      const parsed = JSON.parse(rawValue) as {
        selectedType?: string;
        selectedVenueId?: number | null;
        manageMonthFilter?: string;
        expandedSections?: Partial<Record<GamesSectionKey, boolean>>;
      };

      if (typeof parsed.selectedType === "string") {
        setSelectedType(parsed.selectedType);
      }
      if (
        parsed.selectedVenueId === null ||
        typeof parsed.selectedVenueId === "number"
      ) {
        setSelectedVenueId(parsed.selectedVenueId ?? null);
      }
      if (typeof parsed.manageMonthFilter === "string") {
        setManageMonthFilter(parsed.manageMonthFilter);
      }
      if (parsed.expandedSections) {
        setExpandedSections((prev) => ({
          ...prev,
          ...parsed.expandedSections,
        }));
      }
    } catch {
      // Ignore invalid persisted preferences.
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") {
      return;
    }

    const storageKey = `${GAMES_PREFS_KEY_PREFIX}.${user.id}`;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          selectedType,
          selectedVenueId,
          manageMonthFilter,
          expandedSections,
        })
      );
    } catch {
      // Ignore local storage failures.
    }
  }, [expandedSections, manageMonthFilter, selectedType, selectedVenueId, user?.id]);

  const getOpportunityKey = (type: Opportunity["type"], id: number) => `${type}-${id}`;

  const loadPageData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token = getAccessToken();
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
      const uploadsPromise =
        token && canManageUploadedGames ? getMyUploadedGames() : Promise.resolve([]);

      const uploads = await uploadsPromise;

      if (isRefereeUser) {
        // Use recommendation feed when available, then gracefully fall back.
        let opportunitiesLoaded = false;
        try {
          const recommendedResponse = await fetch(
            `${API_BASE_URL}/recommendations/opportunities/`,
            {
              headers: authHeaders,
            }
          );

          if (recommendedResponse.ok) {
            const recommendedPayload =
              (await recommendedResponse.json()) as RecommendedOpportunitiesResponse;
            setOpportunities(recommendedPayload.items || []);
            opportunitiesLoaded = true;
          }
        } catch {
          opportunitiesLoaded = false;
        }

        if (!opportunitiesLoaded) {
          const opportunitiesResponse = await fetch(`${API_BASE_URL}/games/opportunities/`, {
            headers: authHeaders,
          });
          if (!opportunitiesResponse.ok) {
            throw new Error("Failed to fetch opportunities.");
          }
          setOpportunities((await opportunitiesResponse.json()) as Opportunity[]);
        }
      } else {
        setOpportunities([]);
      }

      setUploadedGames(uploads);
    } catch (err) {
      const message = getErrorMessage(err, "Something went wrong.");
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [canManageUploadedGames, isRefereeUser, showToast]);

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
      const message = getErrorMessage(err, "Failed to claim slot.");
      setError(message);
      showToast(message, "error");
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
      const message = getErrorMessage(err, "Failed to offer cover.");
      setError(message);
      showToast(message, "error");
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
      const message = getErrorMessage(err, "Failed to join event.");
      setError(message);
      showToast(message, "error");
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

    const isNonAppointedGameType = NON_APPOINTED_MANAGE_GAME_TYPES.has(editForm.game_type);

    if (isNonAppointedGameType && !editForm.crew_chief && !editForm.umpire_1) {
      setManageError("Select at least one role to keep active.");
      return;
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
    };

    if (isNonAppointedGameType) {
      const slots: NonNullable<ManageUploadedGamePayload["slots"]> = [];
      if (editForm.crew_chief) {
        slots.push({ role: "CREW_CHIEF" });
      }
      if (editForm.umpire_1) {
        slots.push({ role: "UMPIRE_1" });
      }
      payload.slots = slots;
    }

    try {
      setEditSubmitting(true);
      setManageActionId(editingGame.id);
      await updateUploadedGame(editingGame.id, payload);
      setEditingGame(null);
      setEditForm(emptyForm);
      showToast("Uploaded game updated.", "success");
      await loadPageData();
    } catch (err) {
      const message = getErrorMessage(err, "Failed to update uploaded game.");
      setManageError(message);
      showToast(message, "error");
    } finally {
      setEditSubmitting(false);
      setManageActionId(null);
    }
  };

  const handleDeleteUploaded = (gameId: number) => {
    setPendingDeleteGameId(gameId);
  };

  const confirmDeleteUploaded = async () => {
    if (pendingDeleteGameId === null) {
      return;
    }

    const gameId = pendingDeleteGameId;
    try {
      setManageError("");
      setManageActionId(gameId);
      await deleteUploadedGame(gameId);
      setPendingDeleteGameId(null);
      showToast("Uploaded game deleted.", "success");
      await loadPageData();
    } catch (err) {
      const message = getErrorMessage(err, "Failed to delete uploaded game.");
      setManageError(message);
      showToast(message, "error");
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

  const manageableUploadedGames = useMemo(() => uploadedGames, [uploadedGames]);

  const manageMonthOptions = useMemo(() => {
    const uniqueMonths = Array.from(
      new Set(
        uploadedGames
          .map((game) => game.date?.slice(0, 7))
          .filter((month): month is string => Boolean(month))
      )
    );
    return uniqueMonths.sort((a, b) => b.localeCompare(a));
  }, [uploadedGames]);

  useEffect(() => {
    if (manageMonthFilter === "ALL") {
      return;
    }
    if (!manageMonthOptions.includes(manageMonthFilter)) {
      setManageMonthFilter("ALL");
    }
  }, [manageMonthFilter, manageMonthOptions]);

  const displayedManageGames = useMemo(
    () =>
      manageMonthFilter === "ALL"
        ? manageableUploadedGames
        : manageableUploadedGames.filter((game) =>
            game.date?.startsWith(manageMonthFilter)
          ),
    [manageableUploadedGames, manageMonthFilter]
  );
  const pendingDeleteGame =
    pendingDeleteGameId === null
      ? null
      : uploadedGames.find((game) => game.id === pendingDeleteGameId) || null;

  const editableDivisionOptions = useMemo(() => {
    const appointedDivisions = formOptions.divisions.filter((division) =>
      Boolean(division.requires_appointed_referees)
    );
    const nonAppointedDivisions = formOptions.divisions.filter(
      (division) => !division.requires_appointed_referees
    );

    if (NON_APPOINTED_MANAGE_GAME_TYPES.has(editForm.game_type)) {
      return appointedDivisions.length > 0 ? nonAppointedDivisions : formOptions.divisions;
    }

    return appointedDivisions.length > 0 ? appointedDivisions : formOptions.divisions;
  }, [editForm.game_type, formOptions.divisions]);

  const editableGameTypeOptions = useMemo(() => {
    const allowed = (user?.allowed_upload_game_types || []) as ManageGameType[];

    if (allowed.length > 0) {
      return allowed;
    }

    return ["CLUB", "SCHOOL", "COLLEGE", "FRIENDLY", "DOA", "NL"] as ManageGameType[];
  }, [user?.allowed_upload_game_types]);

  const isEditingNonAppointed = NON_APPOINTED_MANAGE_GAME_TYPES.has(editForm.game_type);

  const editableTeamsForDivision = useMemo(() => {
    const selectedDivisionId = Number(editForm.division);
    if (!selectedDivisionId) {
      return [];
    }
    return formOptions.teams.filter((team) => team.division_id === selectedDivisionId);
  }, [editForm.division, formOptions.teams]);

  const editableHomeTeamOptions = useMemo(
    () =>
      editableTeamsForDivision.filter(
        (team) => String(team.id) !== editForm.away_team
      ),
    [editableTeamsForDivision, editForm.away_team]
  );

  const editableAwayTeamOptions = useMemo(
    () =>
      editableTeamsForDivision.filter(
        (team) => String(team.id) !== editForm.home_team
      ),
    [editableTeamsForDivision, editForm.home_team]
  );

  return (
    <div className="games-page">
      <div className="games-header">
        <div>
          <h1 className="page-title-with-icon">
            <AppIcon
              name={isRefereeUser ? "opportunities" : "games"}
              className="page-title-icon"
            />
            <span>{isRefereeUser ? "Opportunities" : "Games"}</span>
          </h1>
          <p>
            {isRefereeUser
              ? "Find non-appointed games, cover requests, and events."
              : isDoaOrNlUploader
                ? "Upload and manage games in one spreadsheet."
                : "Upload and manage the games your organisation has posted."}
            {isRefereeUser && canManageUploadedGames && !isDoaOrNlUploader
              ? " You can also manage your uploaded games below."
              : ""}
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
              <span className="button-with-icon">
                <AppIcon name="filter" />
                <span>Clear Venue</span>
              </span>
            </button>
          </div>
        )}
      </div>

      {loading && (
        <p className="games-info-message">
          {isRefereeUser ? "Loading opportunities..." : "Loading games..."}
        </p>
      )}
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
              showRecommendations
            />
          </div>
        </div>
      )}

      {isDoaOrNlUploader && (
        <section className="games-upload-section">
          <BulkGameUpload embedded onUploaded={loadPageData} />
        </section>
      )}

      {canManageUploadedGames && !isDoaOrNlUploader && (
        <section
          className={`games-manage-section ${
            expandedSections.manageUploadedGames ? "expanded" : "collapsed"
          }`}
        >
          <div className="games-manage-header">
            <h2 className="section-title-with-icon">
              <AppIcon name="upload" className="section-title-icon" />
              <span>Manage Uploaded Games</span>
            </h2>
            <p>Games your account uploaded. Edit, delete, and filter by month.</p>
          </div>
          {expandedSections.manageUploadedGames && (
            <div className="games-manage-section-content">
              <div className="games-manage-toolbar">
                <label>
                  <span className="inline-icon-label">
                    <AppIcon name="calendar" />
                    <span>Month</span>
                  </span>
                  <select
                    value={manageMonthFilter}
                    onChange={(event) => setManageMonthFilter(event.target.value)}
                  >
                    <option value="ALL">All Months</option>
                    {manageMonthOptions.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {manageError && <p className="games-manage-error">{manageError}</p>}

              {displayedManageGames.length === 0 ? (
                <p className="games-manage-empty">
                  No uploaded games for this month.
                </p>
              ) : (
                <div className="games-manage-list">
                  {displayedManageGames.map((game) => (
                    <article key={game.id} className="games-manage-item">
                      <div className="games-manage-item-top">
                        <div>
                          <h3>{game.home_team_name || "Home Team"} vs {game.away_team_name || "Away Team"}</h3>
                          <p>
                            {game.division_display || game.division_name || "Division"} | {game.date}{" "}
                            {game.time?.slice(0, 5)} | {game.venue_name || "Venue TBC"}
                          </p>
                        </div>
                        {game.can_edit && game.can_delete ? (
                          <div className="games-manage-actions">
                            <button
                              type="button"
                              className="games-manage-button"
                              onClick={() => openEditModal(game)}
                              disabled={manageActionId === game.id}
                            >
                              <span className="button-with-icon">
                                <AppIcon name="settings" />
                                <span>Edit</span>
                              </span>
                            </button>
                            <button
                              type="button"
                              className="games-manage-button games-manage-button-danger"
                              onClick={() => handleDeleteUploaded(game.id)}
                              disabled={manageActionId === game.id}
                            >
                              <span className="button-with-icon">
                                <AppIcon name="logout" />
                                <span>{manageActionId === game.id ? "Deleting..." : "Delete"}</span>
                              </span>
                            </button>
                          </div>
                        ) : (
                          <p className="games-manage-lock-reason">
                            Claimed or shared slots cannot be edited or deleted.
                          </p>
                        )}
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

                      {game.uploaded_slots.some(
                        (slot) => slot.status === "CLAIMED" && Boolean(slot.claimed_by_name)
                      ) && (
                        <div className="games-manage-claim-notifications">
                          <p className="games-manage-claim-title inline-icon-label">
                            <AppIcon name="notifications" />
                            <span>Referee Claim Notifications</span>
                          </p>
                          <div className="games-manage-claim-list">
                            {game.uploaded_slots
                              .filter(
                                (slot) => slot.status === "CLAIMED" && Boolean(slot.claimed_by_name)
                              )
                              .map((slot) => (
                                <p key={`${game.id}-claim-${slot.id}`}>
                                  {slot.role_display} taken by {slot.claimed_by_name}
                                  {slot.claimed_by_phone ? ` (${slot.claimed_by_phone})` : ""}
                                </p>
                              ))}
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="games-manage-section-toggle"
            onClick={() => toggleSection("manageUploadedGames")}
            aria-expanded={expandedSections.manageUploadedGames}
          >
            <span className="inline-icon-label">
              <AppIcon name={expandedSections.manageUploadedGames ? "filter" : "plus"} />
              <span>{expandedSections.manageUploadedGames ? "Collapse" : "Expand"}</span>
            </span>
            <span className="games-manage-section-toggle-icon" aria-hidden="true">
              {expandedSections.manageUploadedGames ? "^" : "v"}
            </span>
          </button>
        </section>
      )}

      {canManageUploadedGames && !isDoaOrNlUploader && editingGame && (
        <div className="upload-modal-overlay" onClick={closeEditModal}>
          <div className="upload-modal manage-game-modal" onClick={(event) => event.stopPropagation()}>
            <div className="upload-modal-header">
              <h2 className="section-title-with-icon">
                <AppIcon name="settings" className="section-title-icon" />
                <span>Edit Uploaded Game</span>
              </h2>
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
                    <label>
                      <span>Game Type</span>
                      <select
                        value={editForm.game_type}
                        onChange={(event) => {
                          const nextGameType = event.target.value as ManageGameType;
                          setEditForm((prev) => ({
                            ...prev,
                            game_type: nextGameType,
                            payment_type: NON_APPOINTED_MANAGE_GAME_TYPES.has(nextGameType)
                              ? prev.payment_type === "CLAIM"
                                ? "CASH"
                                : prev.payment_type
                              : "CLAIM",
                            ...(NON_APPOINTED_MANAGE_GAME_TYPES.has(nextGameType)
                              ? {}
                              : {
                                  crew_chief: false,
                                  umpire_1: false,
                                }),
                          }));
                        }}
                      >
                        {editableGameTypeOptions.map((gameType) => (
                          <option key={gameType} value={gameType}>
                            {MANAGE_GAME_TYPE_LABELS[gameType]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Payment Type</span>
                      <select
                        value={editForm.payment_type}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            payment_type: event.target.value as ManagePaymentType,
                          }))
                        }
                        disabled={!isEditingNonAppointed}
                      >
                        {isEditingNonAppointed ? (
                          <>
                            <option value="CASH">Cash</option>
                            <option value="REVOLUT">Revolut</option>
                          </>
                        ) : (
                          <option value="CLAIM">Claim</option>
                        )}
                      </select>
                    </label>
                    <label>
                      <span>Division</span>
                      <select
                        value={editForm.division}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            division: event.target.value,
                            home_team: "",
                            away_team: "",
                          }))
                        }
                        required
                      >
                        <option value="">Select division</option>
                        {editableDivisionOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Venue</span>
                      <select
                        value={editForm.venue}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, venue: event.target.value }))
                        }
                        required
                      >
                        <option value="">Select venue</option>
                        {formOptions.venues.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Home Team</span>
                      <select
                        value={editForm.home_team}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            home_team: event.target.value,
                            ...(event.target.value === prev.away_team ? { away_team: "" } : {}),
                          }))
                        }
                        required
                        disabled={!editForm.division}
                      >
                        <option value="">Select home team</option>
                        {editableHomeTeamOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Away Team</span>
                      <select
                        value={editForm.away_team}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            away_team: event.target.value,
                            ...(event.target.value === prev.home_team ? { home_team: "" } : {}),
                          }))
                        }
                        required
                        disabled={!editForm.division}
                      >
                        <option value="">Select away team</option>
                        {editableAwayTeamOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Date</span>
                      <input
                        type="date"
                        value={editForm.date}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, date: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>Time</span>
                      <input
                        type="time"
                        value={editForm.time}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, time: event.target.value }))
                        }
                        required
                      />
                    </label>
                  </div>
                  {isEditingNonAppointed && (
                    <div className="games-manage-role-row">
                      <label className="games-manage-role-option">
                        <input
                          type="checkbox"
                          checked={editForm.crew_chief}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              crew_chief: event.target.checked,
                            }))
                          }
                        />
                        Crew Chief Slot
                      </label>
                      <label className="games-manage-role-option">
                        <input
                          type="checkbox"
                          checked={editForm.umpire_1}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              umpire_1: event.target.checked,
                            }))
                          }
                        />
                        Umpire 1 Slot
                      </label>
                    </div>
                  )}
                  <div className="games-manage-form-actions">
                    <button type="submit" disabled={editSubmitting}>
                      {editSubmitting ? "Saving..." : "Save Changes"}
                    </button>
                    <button type="button" onClick={closeEditModal} disabled={editSubmitting}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteGameId !== null}
        title="Delete Uploaded Game"
        message={
          pendingDeleteGame
            ? `Delete ${pendingDeleteGame.home_team_name || "Home Team"} vs ${
                pendingDeleteGame.away_team_name || "Away Team"
              }? This action cannot be undone.`
            : "Delete this uploaded game? This action cannot be undone."
        }
        confirmLabel="Delete Game"
        cancelLabel="Keep Game"
        confirmTone="danger"
        busy={manageActionId === pendingDeleteGameId}
        onCancel={() => setPendingDeleteGameId(null)}
        onConfirm={() => {
          void confirmDeleteUploaded();
        }}
      />
    </div>
  );
}
