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
  onCancel?: () => void;
};

export default function UploadEventPanel({ onUploaded, onCancel }: UploadEventPanelProps) {
  const { showToast } = useToast();
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
      showToast("Event uploaded successfully.", "success");
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
          <EventForm
            venues={venues}
            loading={submitting}
            onSubmit={handleCreateEvent}
            onCancel={onCancel}
          />
        </>
      )}
    </div>
  );
}
