import { useEffect, useState } from "react";
import EventForm from "./events/EventForm";
import {
  createEvent,
  getEventVenueOptions,
  type EventPayload,
  type EventVenueOption,
} from "../services/events";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

type UploadEventPanelProps = {
  onUploaded?: () => void;
};

export default function UploadEventPanel({ onUploaded }: UploadEventPanelProps) {
  const { showToast } = useToast();
  const { user } = useAuth();

  const [venues, setVenues] = useState<EventVenueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedEventType, setSelectedEventType] = useState<
    "CLUB" | "SCHOOL" | "COLLEGE" | ""
  >("");
  const eventTypeLabel =
    selectedEventType === "CLUB"
      ? "Club"
      : selectedEventType === "SCHOOL"
        ? "School"
        : selectedEventType === "COLLEGE"
          ? "College"
          : "";

  const allowedEventTypes = (user?.allowed_upload_event_types || []).filter((value) =>
    ["CLUB", "SCHOOL", "COLLEGE"].includes(value)
  ) as Array<"CLUB" | "SCHOOL" | "COLLEGE">;

  useEffect(() => {
    async function loadVenues() {
      try {
        setLoading(true);
        setErrorMessage("");
        const data = await getEventVenueOptions();
        setVenues(data);
      } catch (error) {
        setErrorMessage("Failed to load event form.");
        showToast("Failed to load event form.", "error");
      } finally {
        setLoading(false);
      }
    }

    loadVenues();
  }, []);

  useEffect(() => {
    setSelectedEventType(allowedEventTypes[0] || "");
  }, [allowedEventTypes]);

  const handleCreateEvent = async (payload: EventPayload) => {
    try {
      setSubmitting(true);
      setErrorMessage("");
      if (!selectedEventType) {
        throw new Error("Your account is not approved to upload events.");
      }

      await createEvent({
        ...payload,
        event_type: selectedEventType,
      });
      onUploaded?.();
    } catch (error) {
      const maybeAxiosError = error as {
        response?: { data?: { detail?: string } };
        message?: string;
      };
      const message =
        maybeAxiosError.response?.data?.detail ||
          maybeAxiosError.message ||
          "Failed to upload event.";
      setErrorMessage(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="upload-modal-state">Loading event form...</p>;
  }

  return (
    <div className="upload-modal-panel">
      {errorMessage && <p className="upload-modal-state error">{errorMessage}</p>}
      {allowedEventTypes.length === 0 ? (
        <p className="upload-modal-state error">
          Your account does not have permission to upload events.
        </p>
      ) : (
        <>
          {allowedEventTypes.length > 1 ? (
            <div className="upload-event-type-wrap">
              <span className="upload-event-type-label">Event Type</span>
              <div className="upload-event-type-grid">
                {allowedEventTypes.map((type) => {
                  const label = type.charAt(0) + type.slice(1).toLowerCase();
                  const active = selectedEventType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`upload-event-type-card ${active ? "active" : ""}`}
                      onClick={() => setSelectedEventType(type)}
                      disabled={submitting}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="upload-event-type-readonly">
              <span>Event Type</span>
              <strong>{eventTypeLabel}</strong>
            </div>
          )}

          <p className="upload-event-type-hint">
            This event will be posted under <strong>{eventTypeLabel}</strong>.
          </p>
          <EventForm
            venues={venues}
            eventTypeLabel={eventTypeLabel}
            loading={submitting}
            onSubmit={handleCreateEvent}
          />
        </>
      )}
    </div>
  );
}
