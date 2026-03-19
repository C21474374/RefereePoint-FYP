import { useEffect, useMemo, useState } from "react";
import "../pages_css/UploadGame.css";
import { getAccessToken } from "../services/auth";

type SimpleOption = {
  id: number;
  name: string;
};

type TeamOption = {
  id: number;
  name: string;
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
};

type FormState = {
  game_type: "CLUB" | "SCHOOL" | "COLLEGE" | "FRIENDLY";
  payment_type: "CASH" | "REVOLUT";
  division: string;
  date: string;
  time: string;
  venue: string;
  home_team: string;
  away_team: string;
  notes: string;
  original_post_text: string;
  requesting_side: "" | "HOME" | "AWAY";
  second_ref_needed: boolean;
  description: string;
};

const initialForm: FormState = {
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
  requesting_side: "",
  second_ref_needed: false,
  description: "",
};



function buildSlots(
  requestingSide: "" | "HOME" | "AWAY",
  secondRefNeeded: boolean,
  description: string
) {
  if (!requestingSide) return [];

  const baseSlot = {
    description,
  };

  if (requestingSide === "HOME") {
    const slots = [
      {
        role: "CREW_CHIEF",
        ...baseSlot,
      },
    ];

    if (secondRefNeeded) {
      slots.push({
        role: "UMPIRE_1",
        ...baseSlot,
      });
    }

    return slots;
  }

  const slots = [
    {
      role: "UMPIRE_1",
      ...baseSlot,
    },
  ];

  if (secondRefNeeded) {
    slots.push({
      role: "CREW_CHIEF",
      ...baseSlot,
    });
  }

  return slots;
}

export default function UploadGameForm({
  divisions,
  venues,
  teams,
}: UploadGameFormProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const canCheckAvailability = useMemo(() => {
    return (
      form.home_team.trim() !== "" &&
      form.away_team.trim() !== "" &&
      form.venue.trim() !== "" &&
      form.date.trim() !== "" &&
      form.time.trim() !== ""
    );
  }, [form.home_team, form.away_team, form.venue, form.date, form.time]);

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
                `http://127.0.0.1:8000/api/games/upload/check/?${params.toString()}`,
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

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = event.target;
    const checked = (event.target as HTMLInputElement).checked;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    
    if (name === "game_type") {
      setAvailability(null);
    }

    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

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

    if (!form.requesting_side) {
      setErrorMessage("Please choose which team needs a referee.");
      return;
    }

    if (bothSidesBlocked) {
      setErrorMessage("This game already has both referee requests recorded.");
      return;
    }

    const slots = buildSlots(
      form.requesting_side,
      form.second_ref_needed,
      form.description
    );

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
        notes: form.notes,
        original_post_text: form.original_post_text,
        slots,
      };

const token = getAccessToken();

if (!token) {
  throw new Error("You must be logged in to upload a game.");
}

                const response = await fetch("http://127.0.0.1:8000/api/games/upload/", {
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
      setForm(initialForm);
      setAvailability(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong while posting the game."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="upload-game-wrapper">
      <div className="upload-game-header">
        <h1>Upload Game</h1>
        <p>Post a game and create referee opportunities.</p>
      </div>

      <form className="upload-game-form" onSubmit={handleSubmit}>
        {errorMessage && <div className="upload-message error">{errorMessage}</div>}
        {successMessage && <div className="upload-message success">{successMessage}</div>}

        <section className="upload-section">
          <h2>Game Details</h2>

          <div className="upload-grid">
            <div className="form-field">
              <label>Game Type</label>
             <select name="game_type" value={form.game_type} onChange={handleChange}>
                <option value="CLUB">Club</option>
                <option value="SCHOOL">School</option>
                <option value="COLLEGE">College</option>
                <option value="FRIENDLY">Friendly</option>
              </select>
            </div>

            <div className="form-field">
              <label>Payment Type</label>
              <select name="payment_type" value={form.payment_type} onChange={handleChange}>
                <option value="CASH">Cash</option>
                <option value="REVOLUT">Revolut</option>
              </select>
            </div>

            <div className="form-field">
              <label>Division</label>
              <select name="division" value={form.division} onChange={handleChange}>
                <option value="">Select division</option>
                {divisions.map((division) => (
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
              <select name="home_team" value={form.home_team} onChange={handleChange}>
                <option value="">Select home team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Away Team</label>
              <select name="away_team" value={form.away_team} onChange={handleChange}>
                <option value="">Select away team</option>
                {teams.map((team) => (
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

        <section className="upload-section">
          <h2>Referee Requirement</h2>

          <div className="radio-group">
            <p className="radio-title">Which team needs a referee?</p>

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
              Home Team
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
              Away Team
            </label>
          </div>

          <label className="checkbox-option">
            <input
              type="checkbox"
              name="second_ref_needed"
              checked={form.second_ref_needed}
              onChange={handleChange}
            />
            Second referee also needed
          </label>

          

          <div className="helper-box">
            <strong>Slot logic:</strong>
            <span>
              Home team request creates a Crew Chief slot. Away team request creates an Umpire 1
              slot. If second referee is ticked, both slots are created.
            </span>
          </div>
        </section>

        <section className="upload-section">
          <h2>Extra Details</h2>

          <div className="form-field">
            <label>Slot Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Optional short description for the opportunity"
            />
          </div>

          <div className="form-field">
            <label>Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Optional notes about the game"
            />
          </div>

          <div className="form-field">
            <label>Original Post Text</label>
            <textarea
              name="original_post_text"
              value={form.original_post_text}
              onChange={handleChange}
              rows={4}
              placeholder="Optional copied message or original request text"
            />
          </div>
        </section>

        <div className="upload-actions">
          <button type="submit" disabled={submitting || bothSidesBlocked}>
            {submitting ? "Posting..." : "Post Game"}
          </button>
        </div>
      </form>
    </div>
  );
}