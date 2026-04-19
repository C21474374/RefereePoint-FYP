import { useEffect, useMemo, useState } from "react";
import "./UploadGameForm.css";
import { API_BASE_URL } from "../config/api";
import { getAccessToken } from "../services/auth";
import { useToast } from "../context/ToastContext";

type SimpleOption = {
  id: number;
  name: string;
  requires_appointed_referees?: boolean;
};

type TeamOption = {
  id: number;
  name: string;
  division_id?: number;
};

type AvailabilityResponse = {
  exists: boolean;
  game_id: number | null;
  home_available: boolean;
  away_available: boolean;
  existing_roles: string[];
  message: string;
};

type UploadGameFormProps = {
  divisions: SimpleOption[];
  venues: SimpleOption[];
  teams: TeamOption[];
  allowedGameTypes: Array<"CLUB" | "SCHOOL" | "COLLEGE" | "FRIENDLY" | "DOA" | "NL">;
  accountTypeDisplay: string;
  canUploadGames: boolean;
  embedded?: boolean;
  onPosted?: () => void;
  onCancel?: () => void;
};

type GameUploadType = "CLUB" | "SCHOOL" | "COLLEGE" | "FRIENDLY" | "DOA" | "NL";
type PaymentType = "CASH" | "REVOLUT" | "CLAIM";

type FormState = {
  game_type: GameUploadType;
  payment_type: PaymentType;
  division: string;
  date: string;
  time: string;
  venue: string;
  home_team: string;
  away_team: string;
  requesting_side: "" | "HOME" | "AWAY";
  second_ref_needed: boolean;
};

const NON_APPOINTED_GAME_TYPES: GameUploadType[] = [
  "CLUB",
  "SCHOOL",
  "COLLEGE",
  "FRIENDLY",
];

const APPOINTED_GAME_TYPES: GameUploadType[] = ["DOA", "NL"];

const GAME_TYPE_LABELS: Record<GameUploadType, string> = {
  CLUB: "Club",
  SCHOOL: "School",
  COLLEGE: "College",
  FRIENDLY: "Friendly",
  DOA: "DOA",
  NL: "National League",
};

function defaultPaymentType(gameType: GameUploadType): PaymentType {
  return APPOINTED_GAME_TYPES.includes(gameType) ? "CLAIM" : "CASH";
}

const initialForm: FormState = {
  game_type: "CLUB",
  payment_type: "CASH",
  division: "",
  date: "",
  time: "",
  venue: "",
  home_team: "",
  away_team: "",
  requesting_side: "",
  second_ref_needed: false,
};



function buildSlots(
  requestingSide: "" | "HOME" | "AWAY",
  secondRefNeeded: boolean
) {
  if (!requestingSide) return [];

  if (requestingSide === "HOME") {
    const slots = [
      {
        role: "CREW_CHIEF",
      },
    ];

    if (secondRefNeeded) {
      slots.push({
        role: "UMPIRE_1",
      });
    }

    return slots;
  }

  const slots = [
    {
      role: "UMPIRE_1",
    },
  ];

  if (secondRefNeeded) {
    slots.push({
      role: "CREW_CHIEF",
    });
  }

  return slots;
}

function roleLabelForSide(side: "" | "HOME" | "AWAY") {
  if (side === "HOME") {
    return "Crew Chief";
  }
  if (side === "AWAY") {
    return "Umpire 1";
  }
  return "";
}

export default function UploadGameForm({
  divisions,
  venues,
  teams,
  allowedGameTypes,
  accountTypeDisplay,
  canUploadGames,
  embedded = false,
  onPosted,
  onCancel,
}: UploadGameFormProps) {
  const { showToast } = useToast();
  const firstAllowedGameType = (allowedGameTypes[0] || "CLUB") as GameUploadType;
  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    game_type: firstAllowedGameType,
    payment_type: defaultPaymentType(firstAllowedGameType),
  }));
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const canCheckAvailability = useMemo(() => {
    const isNonAppointedType = NON_APPOINTED_GAME_TYPES.includes(form.game_type);
    if (!isNonAppointedType) {
      return false;
    }

    return (
      form.home_team.trim() !== "" &&
      form.away_team.trim() !== "" &&
      form.venue.trim() !== "" &&
      form.date.trim() !== "" &&
      form.time.trim() !== ""
    );
  }, [form.game_type, form.home_team, form.away_team, form.venue, form.date, form.time]);

  useEffect(() => {
    if (allowedGameTypes.length === 0) {
      return;
    }

    if (!allowedGameTypes.includes(form.game_type)) {
      const nextGameType = allowedGameTypes[0] as GameUploadType;
      setForm((prev) => ({
        ...prev,
        game_type: nextGameType,
        payment_type: defaultPaymentType(nextGameType),
        requesting_side: "",
        second_ref_needed: false,
      }));
    }
  }, [allowedGameTypes, form.game_type]);

  useEffect(() => {
    const controller = new AbortController();

    async function checkAvailability() {
      if (!canCheckAvailability) {
        setAvailability(null);
        return;
      }

      if (form.home_team === form.away_team && form.home_team !== "") {
        setAvailability(null);
        return;
      }

      try {
        setCheckingAvailability(true);

              const params = new URLSearchParams({
                home_team: form.home_team,
                away_team: form.away_team,
                venue: form.venue,
                date: form.date,
                time: form.time,
                game_type: form.game_type,
              });

              const response = await fetch(
                `${API_BASE_URL}/games/upload/check/?${params.toString()}`,
                {
                  signal: controller.signal,
                }
              );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Failed to check game availability.");
        }

        setAvailability(data);

        if (form.requesting_side === "HOME" && !data.home_available) {
          setForm((prev) => ({ ...prev, requesting_side: "" }));
        }

        if (form.requesting_side === "AWAY" && !data.away_available) {
          setForm((prev) => ({ ...prev, requesting_side: "" }));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setAvailability(null);
      } finally {
        setCheckingAvailability(false);
      }
    }

    checkAvailability();

    return () => controller.abort();
  }, [
    canCheckAvailability,
    form.game_type,
    form.home_team,
    form.away_team,
    form.venue,
    form.date,
    form.time,
    form.requesting_side,
  ]);

  const homeDisabled = availability ? !availability.home_available : false;
  const awayDisabled = availability ? !availability.away_available : false;
  const bothSidesBlocked = homeDisabled && awayDisabled;
  const isNonAppointedType = NON_APPOINTED_GAME_TYPES.includes(form.game_type);
  const teamsForDivision = useMemo(() => {
    const divisionId = Number(form.division);
    if (!divisionId) {
      return [];
    }
    return teams.filter((team) => team.division_id === divisionId);
  }, [form.division, teams]);

  const homeTeamOptions = useMemo(
    () => teamsForDivision.filter((team) => String(team.id) !== form.away_team),
    [form.away_team, teamsForDivision]
  );

  const awayTeamOptions = useMemo(
    () => teamsForDivision.filter((team) => String(team.id) !== form.home_team),
    [form.home_team, teamsForDivision]
  );

  const homeTeamName = useMemo(
    () =>
      teams.find((team) => String(team.id) === form.home_team)?.name || "Home Team",
    [form.home_team, teams]
  );

  const awayTeamName = useMemo(
    () =>
      teams.find((team) => String(team.id) === form.away_team)?.name || "Away Team",
    [form.away_team, teams]
  );

  const requestingTeamName = form.requesting_side === "HOME" ? homeTeamName : awayTeamName;
  const oppositeTeamName = form.requesting_side === "HOME" ? awayTeamName : homeTeamName;
  const primaryRoleLabel = roleLabelForSide(form.requesting_side);
  const secondaryRoleLabel = roleLabelForSide(form.requesting_side === "HOME" ? "AWAY" : "HOME");
  const selectedSideUnavailable =
    availability?.exists && form.requesting_side === "HOME"
      ? !availability.home_available
      : availability?.exists && form.requesting_side === "AWAY"
        ? !availability.away_available
        : false;
  const canRequestSecondRef =
    Boolean(form.requesting_side) &&
    (!availability?.exists ||
      (form.requesting_side === "HOME"
        ? Boolean(availability.away_available)
        : Boolean(availability.home_available)));
  const effectiveSecondRefNeeded = form.second_ref_needed && canRequestSecondRef;

  useEffect(() => {
    if (form.second_ref_needed && !canRequestSecondRef) {
      setForm((prev) => ({ ...prev, second_ref_needed: false }));
    }
  }, [canRequestSecondRef, form.second_ref_needed]);

  const availableDivisions = useMemo(() => {
    const isAppointedType = APPOINTED_GAME_TYPES.includes(form.game_type);
    return divisions.filter((division) =>
      isAppointedType
        ? Boolean(division.requires_appointed_referees)
        : !Boolean(division.requires_appointed_referees)
    );
  }, [divisions, form.game_type]);

  useEffect(() => {
    if (!form.division) {
      return;
    }

    const stillValid = availableDivisions.some(
      (division) => String(division.id) === form.division
    );
    if (!stillValid) {
      setForm((prev) => ({ ...prev, division: "" }));
    }
  }, [availableDivisions, form.division]);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = event.target;
    const checked = (event.target as HTMLInputElement).checked;

    if (name === "game_type") {
      const nextGameType = value as GameUploadType;
      const isNextAppointed = APPOINTED_GAME_TYPES.includes(nextGameType);

      setForm((prev) => ({
        ...prev,
        game_type: nextGameType,
        payment_type: isNextAppointed
          ? "CLAIM"
          : prev.payment_type === "CLAIM"
            ? "CASH"
            : prev.payment_type,
        requesting_side: isNextAppointed ? "" : prev.requesting_side,
        second_ref_needed: isNextAppointed ? false : prev.second_ref_needed,
      }));
      setAvailability(null);
      setErrorMessage("");
      setSuccessMessage("");
      return;
    }

    if (name === "division") {
      setForm((prev) => ({
        ...prev,
        division: value,
        home_team: "",
        away_team: "",
        requesting_side: "",
        second_ref_needed: false,
      }));
      setAvailability(null);
      setErrorMessage("");
      setSuccessMessage("");
      return;
    }

    if (name === "home_team") {
      setForm((prev) => ({
        ...prev,
        home_team: value,
        ...(value !== "" && value === prev.away_team ? { away_team: "" } : {}),
      }));
      setErrorMessage("");
      setSuccessMessage("");
      return;
    }

    if (name === "away_team") {
      setForm((prev) => ({
        ...prev,
        away_team: value,
        ...(value !== "" && value === prev.home_team ? { home_team: "" } : {}),
      }));
      setErrorMessage("");
      setSuccessMessage("");
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!canUploadGames || allowedGameTypes.length === 0) {
      setErrorMessage(
        "Your account is not approved to upload games yet. Ask DOA admin to verify and approve your account."
      );
      return;
    }

    if (!allowedGameTypes.includes(form.game_type)) {
      setErrorMessage(
        `Your ${accountTypeDisplay} account cannot upload ${GAME_TYPE_LABELS[form.game_type]} games.`
      );
      return;
    }

    if (!form.division || !form.venue || !form.home_team || !form.away_team) {
      setErrorMessage("Please complete all required game fields.");
      return;
    }

    if (!form.date || !form.time) {
      setErrorMessage("Please select both a date and time.");
      return;
    }

    if (form.home_team === form.away_team) {
      setErrorMessage("Home team and away team must be different.");
      return;
    }

    if (isNonAppointedType) {
      if (!form.requesting_side) {
        setErrorMessage("Please choose which team needs a referee.");
        return;
      }

      if (bothSidesBlocked) {
        setErrorMessage("This game already has both referee requests recorded.");
        return;
      }

      if (selectedSideUnavailable) {
        setErrorMessage("That side already has an open referee request for this game.");
        return;
      }

      if (form.second_ref_needed && !canRequestSecondRef) {
        setErrorMessage(
          "Only one referee can be requested because the opposite side is already filled."
        );
        return;
      }
    }

    const slots = isNonAppointedType
      ? buildSlots(
          form.requesting_side,
          effectiveSecondRefNeeded
        )
      : [];

    try {
      setSubmitting(true);

      const payload = {
        game_type: form.game_type,
        payment_type: form.payment_type,
        division: Number(form.division),
        date: form.date,
        time: form.time,
        venue: Number(form.venue),
        home_team: Number(form.home_team),
        away_team: Number(form.away_team),
        slots,
      };

const token = getAccessToken();

if (!token) {
  throw new Error("You must be logged in to upload a game.");
}

                const response = await fetch(`${API_BASE_URL}/games/upload/`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify(payload),
                });

      const data = await response.json();

      if (!response.ok) {
        if (typeof data === "object" && data !== null) {
          const firstError = Object.values(data).flat().join(" ");
          throw new Error(firstError || "Failed to upload game.");
        }
        throw new Error("Failed to upload game.");
      }

      setSuccessMessage("Game posted successfully.");
      const resetGameType = (allowedGameTypes[0] || "CLUB") as GameUploadType;
      setForm({
        ...initialForm,
        game_type: resetGameType,
        payment_type: defaultPaymentType(resetGameType),
      });
      setAvailability(null);
      showToast("Game uploaded successfully.", "success");
      onPosted?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong while posting the game.";
      setErrorMessage(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  const formContent = (
    <form className="upload-game-form" onSubmit={handleSubmit}>
      {errorMessage && <div className="upload-message error">{errorMessage}</div>}
      {successMessage && <div className="upload-message success">{successMessage}</div>}
      {!canUploadGames && (
        <div className="upload-message error">
          Your account is pending approval. Uploads are available after required verification and admin approval.
        </div>
      )}
      {canUploadGames && allowedGameTypes.length === 0 && (
        <div className="upload-message error">
          Your account currently has no upload permissions for game types.
        </div>
      )}

      <section className="upload-section">
        <h2>Game Details</h2>

        <div className="upload-grid">
          <div className="form-field">
            <label>Game Type</label>
            <select
              name="game_type"
              value={form.game_type}
              onChange={handleChange}
              disabled={!canUploadGames || allowedGameTypes.length === 0}
            >
              {allowedGameTypes.map((gameType) => (
                <option key={gameType} value={gameType}>
                  {GAME_TYPE_LABELS[gameType]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Payment Type</label>
            <select
              name="payment_type"
              value={form.payment_type}
              onChange={handleChange}
              disabled={
                !canUploadGames ||
                APPOINTED_GAME_TYPES.includes(form.game_type)
              }
            >
              {APPOINTED_GAME_TYPES.includes(form.game_type) ? (
                <option value="CLAIM">Claim</option>
              ) : (
                <>
                  <option value="CASH">Cash</option>
                  <option value="REVOLUT">Revolut</option>
                </>
              )}
            </select>
          </div>

          <div className="form-field">
            <label>Division</label>
            <select name="division" value={form.division} onChange={handleChange}>
              <option value="">Select division</option>
              {availableDivisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Venue</label>
            <select name="venue" value={form.venue} onChange={handleChange}>
              <option value="">Select venue</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Home Team</label>
            <select
              name="home_team"
              value={form.home_team}
              onChange={handleChange}
              disabled={!form.division}
            >
              <option value="">{form.division ? "Select home team" : "Select division first"}</option>
              {homeTeamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Away Team</label>
            <select
              name="away_team"
              value={form.away_team}
              onChange={handleChange}
              disabled={!form.division}
            >
              <option value="">{form.division ? "Select away team" : "Select division first"}</option>
              {awayTeamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Date</label>
            <input type="date" name="date" value={form.date} onChange={handleChange} />
          </div>

          <div className="form-field">
            <label>Time</label>
            <input type="time" name="time" value={form.time} onChange={handleChange} />
          </div>
        </div>
      </section>

      {isNonAppointedType ? (
        <section className="upload-section">
          <h2>Referees Required</h2>
          <p className="upload-step-caption">Step 1: choose which team is requesting.</p>

          <div className="radio-group">
            <p className="radio-title">Which team needs the referee request?</p>

            {checkingAvailability && (
              <p className="availability-text">Checking if this game already exists...</p>
            )}

            {availability?.exists && !bothSidesBlocked && (
              <p className="availability-text warning">
                This game already exists. You can only request the missing side.
              </p>
            )}

            {bothSidesBlocked && (
              <p className="availability-text danger">
                Both referee requests already exist for this game.
              </p>
            )}

            <label className={`radio-option ${homeDisabled ? "disabled" : ""}`}>
              <input
                type="radio"
                name="requesting_side"
                value="HOME"
                checked={form.requesting_side === "HOME"}
                onChange={handleChange}
                disabled={homeDisabled}
              />
              {homeTeamName}
            </label>

            <label className={`radio-option ${awayDisabled ? "disabled" : ""}`}>
              <input
                type="radio"
                name="requesting_side"
                value="AWAY"
                checked={form.requesting_side === "AWAY"}
                onChange={handleChange}
                disabled={awayDisabled}
              />
              {awayTeamName}
            </label>
          </div>

          <p className="upload-step-caption">Step 2: choose how many referees are needed.</p>
          <div className="upload-choice-grid">
            <button
              type="button"
              className={`upload-choice-card ${!form.second_ref_needed ? "active" : ""}`}
              onClick={() => setForm((prev) => ({ ...prev, second_ref_needed: false }))}
              disabled={!form.requesting_side || selectedSideUnavailable}
              aria-pressed={!form.second_ref_needed}
            >
              <strong>1 Referee</strong>
              <span>Creates one role for the requesting side.</span>
            </button>
            <button
              type="button"
              className={`upload-choice-card ${form.second_ref_needed ? "active" : ""}`}
              onClick={() => setForm((prev) => ({ ...prev, second_ref_needed: true }))}
              disabled={!form.requesting_side || !canRequestSecondRef || selectedSideUnavailable}
              aria-pressed={form.second_ref_needed}
            >
              <strong>2 Referees</strong>
              <span>Creates both roles for this game.</span>
            </button>
          </div>

          {form.requesting_side && !canRequestSecondRef && availability?.exists && !selectedSideUnavailable && (
            <p className="availability-text warning">
              Only one referee can be requested here because the opposite side is already posted.
            </p>
          )}

          {form.requesting_side && !selectedSideUnavailable && (
            <div className="upload-requirement-summary">
              <strong>This request will create:</strong>
              <div className="upload-slot-preview">
                <span className="upload-slot-pill">
                  {primaryRoleLabel} for {requestingTeamName}
                </span>
                {effectiveSecondRefNeeded && (
                  <span className="upload-slot-pill">
                    {secondaryRoleLabel} for {oppositeTeamName}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="upload-section">
          <h2>Appointed Upload</h2>
          <div className="helper-box">
            <strong>Appointed game flow:</strong>
            <span>
              DOA/NL uploads create the game record only (Claim payment). Referee slots are not
              created in this form.
            </span>
          </div>
        </section>
      )}

      <div className="upload-actions">
        <button
          type="submit"
          disabled={
            submitting ||
            !canUploadGames ||
            allowedGameTypes.length === 0 ||
            (isNonAppointedType && bothSidesBlocked)
          }
        >
          {submitting ? "Posting..." : "Post Game"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="upload-cancel-btn"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );

  if (embedded) {
    return formContent;
  }

  return (
    <div className="upload-game-wrapper">
      <div className="upload-game-header">
        <h1>Upload Game</h1>
        <p>Post a game and create referee opportunities.</p>
      </div>
      {formContent}
    </div>
  );
}
