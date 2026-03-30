import { useEffect, useState } from "react";
import EventForm from "./events/EventForm";
import {
  createEvent,
  getEventVenueOptions,
  type EventPayload,
  type EventVenueOption,
} from "../services/events";
import { useAuth } from "../context/AuthContext";

type UploadEventPanelProps = {
  onUploaded?: () => void;
};

export default function UploadEventPanel({ onUploaded }: UploadEventPanelProps) {
  const { user } = useAuth();

  const [venues, setVenues] = useState<EventVenueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedEventType, setSelectedEventType] = useState<
    "CLUB" | "SCHOOL" | "COLLEGE" | ""
  >("");

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
        console.error(error);
        setErrorMessage("Failed to load event form.");
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
      setErrorMessage(
        maybeAxiosError.response?.data?.detail ||
          maybeAxiosError.message ||
          "Failed to upload event."
      );
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
          {allowedEventTypes.length > 1 && (
            <label className="upload-cover-field">
              <span>Event Type</span>
              <select
                value={selectedEventType}
                onChange={(event) =>
                  setSelectedEventType(
                    event.target.value as "CLUB" | "SCHOOL" | "COLLEGE"
                  )
                }
                disabled={submitting}
              >
                {allowedEventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
          )}
          <EventForm
            venues={venues}
            loading={submitting}
            onSubmit={handleCreateEvent}
          />
        </>
      )}
    </div>
  );
}
