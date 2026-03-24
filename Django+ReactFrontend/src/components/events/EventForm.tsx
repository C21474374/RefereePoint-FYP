import { useState, type FormEvent } from "react";
import type { EventItem, EventPayload, EventVenueOption } from "../../services/events";

type EventFormProps = {
  venues: EventVenueOption[];
  initialEvent?: EventItem | null;
  loading?: boolean;
  onSubmit: (payload: EventPayload) => Promise<void>;
  onCancelEdit?: () => void;
};

type FormState = {
  start_date: string;
  end_date: string;
  venue: string;
  description: string;
  fee_per_game: string;
  contact_information: string;
  referees_required: string;
};

const emptyState: FormState = {
  start_date: "",
  end_date: "",
  venue: "",
  description: "",
  fee_per_game: "",
  contact_information: "",
  referees_required: "0",
};

function buildFormState(initialEvent?: EventItem | null): FormState {
  if (!initialEvent) {
    return emptyState;
  }

  return {
    start_date: initialEvent.start_date,
    end_date: initialEvent.end_date,
    venue: initialEvent.venue ? String(initialEvent.venue) : "",
    description: initialEvent.description || "",
    fee_per_game: initialEvent.fee_per_game || "",
    contact_information: initialEvent.contact_information || "",
    referees_required: String(initialEvent.referees_required),
  };
}

export default function EventForm({
  venues,
  initialEvent = null,
  loading = false,
  onSubmit,
  onCancelEdit,
}: EventFormProps) {
  const [form, setForm] = useState<FormState>(() => buildFormState(initialEvent));

  const onFieldChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const payload: EventPayload = {
      start_date: form.start_date,
      end_date: form.end_date,
      venue: form.venue ? Number(form.venue) : null,
      description: form.description.trim(),
      fee_per_game: form.fee_per_game ? form.fee_per_game : null,
      contact_information: form.contact_information.trim(),
      referees_required: Number(form.referees_required || 0),
    };

    await onSubmit(payload);

    if (!initialEvent) {
      setForm(buildFormState(null));
    }
  };

  return (
    <form className="events-form" onSubmit={handleSubmit}>
      <div className="events-form-grid">
        <label>
          <span>Start Date</span>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => onFieldChange("start_date", e.target.value)}
            required
          />
        </label>

        <label>
          <span>End Date</span>
          <input
            type="date"
            value={form.end_date}
            onChange={(e) => onFieldChange("end_date", e.target.value)}
            required
          />
        </label>

        <label>
          <span>Venue</span>
          <select
            value={form.venue}
            onChange={(e) => onFieldChange("venue", e.target.value)}
          >
            <option value="">No venue selected</option>
            {venues.map((venue) => (
              <option key={venue.id} value={String(venue.id)}>
                {venue.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Fee Per Game (EUR)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.fee_per_game}
            onChange={(e) => onFieldChange("fee_per_game", e.target.value)}
          />
        </label>

        <label>
          <span>Referees Required</span>
          <input
            type="number"
            min="0"
            value={form.referees_required}
            onChange={(e) => onFieldChange("referees_required", e.target.value)}
            required
          />
        </label>

        <label className="events-form-wide">
          <span>Contact Information</span>
          <input
            type="text"
            value={form.contact_information}
            onChange={(e) => onFieldChange("contact_information", e.target.value)}
            placeholder="Email, phone, or coordinator details"
          />
        </label>

        <label className="events-form-wide">
          <span>Description</span>
          <textarea
            value={form.description}
            onChange={(e) => onFieldChange("description", e.target.value)}
            rows={3}
            placeholder="Tournament info, schedule notes, requirements..."
          />
        </label>
      </div>

      <div className="events-form-actions">
        <button type="submit" className="events-form-submit" disabled={loading}>
          {loading
            ? initialEvent
              ? "Updating..."
              : "Creating..."
            : initialEvent
              ? "Update Event"
              : "Create Event"}
        </button>

        {initialEvent && onCancelEdit && (
          <button
            type="button"
            className="events-form-cancel"
            onClick={onCancelEdit}
            disabled={loading}
          >
            Cancel Edit
          </button>
        )}
      </div>
    </form>
  );
}
