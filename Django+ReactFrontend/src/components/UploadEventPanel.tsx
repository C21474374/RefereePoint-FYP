import { useEffect, useState } from "react";
import EventForm from "./events/EventForm";
import {
  createEvent,
  getEventVenueOptions,
  type EventPayload,
  type EventVenueOption,
} from "../services/events";

type UploadEventPanelProps = {
  onUploaded?: () => void;
};

export default function UploadEventPanel({ onUploaded }: UploadEventPanelProps) {
  const [venues, setVenues] = useState<EventVenueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  const handleCreateEvent = async (payload: EventPayload) => {
    try {
      setSubmitting(true);
      setErrorMessage("");
      await createEvent(payload);
      onUploaded?.();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to upload event.");
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
      <EventForm
        venues={venues}
        loading={submitting}
        onSubmit={handleCreateEvent}
      />
    </div>
  );
}
