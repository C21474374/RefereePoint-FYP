import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import EventCard from "../components/events/EventCard";
import EventForm from "../components/events/EventForm";
import EventStats from "../components/events/EventStats";
import {
  createEvent,
  deleteEvent,
  getEventVenueOptions,
  getUpcomingEvents,
  joinEvent,
  leaveEvent,
  updateEvent,
  type EventItem,
  type EventPayload,
  type EventVenueOption,
} from "../services/events";
import "../pages_css/Events.css";

export default function Events() {
  const location = useLocation();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [venues, setVenues] = useState<EventVenueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [myEventsOnly, setMyEventsOnly] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<string>("ALL");
  const [selectedDate, setSelectedDate] = useState("");
  const formSectionRef = useRef<HTMLElement | null>(null);

  const loadPageData = async () => {
    try {
      setLoading(true);
      setError("");

      const [eventsData, venueData] = await Promise.all([
        getUpcomingEvents(),
        getEventVenueOptions(),
      ]);

      setEvents(eventsData);
      setVenues(venueData);
    } catch (err) {
      console.error(err);
      setError("Failed to load events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    if (loading || location.hash !== "#upload-event") {
      return;
    }

    requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading, location.hash]);

  const handleJoin = async (eventId: number) => {
    try {
      setActionLoadingId(eventId);
      setError("");
      await joinEvent(eventId);
      await loadPageData();
    } catch (err) {
      console.error(err);
      setError("Failed to join event.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLeave = async (eventId: number) => {
    try {
      setActionLoadingId(eventId);
      setError("");
      await leaveEvent(eventId);
      await loadPageData();
    } catch (err) {
      console.error(err);
      setError("Failed to leave event.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveEvent = async (payload: EventPayload) => {
    try {
      setFormLoading(true);
      setError("");

      if (editingEvent) {
        await updateEvent(editingEvent.id, payload);
      } else {
        await createEvent(payload);
      }

      await loadPageData();
      setEditingEvent(null);
    } catch (err) {
      console.error(err);
      setError(editingEvent ? "Failed to update event." : "Failed to create event.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    const confirmed = window.confirm("Delete this event?");
    if (!confirmed) {
      return;
    }

    try {
      setActionLoadingId(eventId);
      setError("");
      await deleteEvent(eventId);
      if (editingEvent?.id === eventId) {
        setEditingEvent(null);
      }
      await loadPageData();
    } catch (err) {
      console.error(err);
      setError("Failed to delete event.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEditEvent = (eventItem: EventItem) => {
    setEditingEvent(eventItem);
    requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        if (myEventsOnly && !event.current_user_joined) {
          return false;
        }

        if (selectedVenue !== "ALL" && String(event.venue) !== selectedVenue) {
          return false;
        }

        if (selectedDate) {
          if (selectedDate < event.start_date || selectedDate > event.end_date) {
            return false;
          }
        }

        return true;
      }),
    [events, myEventsOnly, selectedVenue, selectedDate]
  );

  const myEvents = useMemo(
    () => filteredEvents.filter((event) => event.current_user_joined),
    [filteredEvents]
  );

  const openEvents = useMemo(
    () =>
      filteredEvents.filter(
        (event) => !event.current_user_joined && (event.slots_left === null || event.slots_left > 0)
      ),
    [filteredEvents]
  );

  const fullEvents = useMemo(
    () =>
      filteredEvents.filter(
        (event) => !event.current_user_joined && event.slots_left !== null && event.slots_left <= 0
      ),
    [filteredEvents]
  );

  const clearFilters = () => {
    setMyEventsOnly(false);
    setSelectedVenue("ALL");
    setSelectedDate("");
  };

  const hasActiveFilters = myEventsOnly || selectedVenue !== "ALL" || selectedDate !== "";

  return (
    <div className="events-page">
      <div className="events-page-header">
        <h1>Events</h1>
        <p>
          Join tournament events, track referee coverage, and manage who is assigned.
        </p>
      </div>

      {!loading && (
        <section id="upload-event" className="events-section" ref={formSectionRef}>
          <div className="events-section-header">
            <h2>{editingEvent ? "Edit Event" : "Upload Event"}</h2>
            <p>Create tournament events so referees can join and coordinate coverage.</p>
          </div>
          <EventForm
            key={editingEvent ? `edit-${editingEvent.id}` : "create-new"}
            venues={venues}
            initialEvent={editingEvent}
            loading={formLoading}
            onSubmit={handleSaveEvent}
            onCancelEdit={() => setEditingEvent(null)}
          />
        </section>
      )}

      {!loading && (
        <div className="events-filters">
          <label className="events-filter-toggle">
            <input
              type="checkbox"
              checked={myEventsOnly}
              onChange={(e) => setMyEventsOnly(e.target.checked)}
            />
            <span>My events only</span>
          </label>

          <select
            className="events-filter-select"
            value={selectedVenue}
            onChange={(e) => setSelectedVenue(e.target.value)}
          >
            <option value="ALL">All Venues</option>
            {venues.map((venue) => (
              <option key={venue.id} value={String(venue.id)}>
                {venue.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="events-filter-date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />

          <button
            className="events-filter-clear"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
          >
            Clear Filters
          </button>
        </div>
      )}

      {loading && <p className="events-page-message">Loading events...</p>}
      {error && <p className="events-page-error">{error}</p>}

      {!loading && (
        <>
          <EventStats events={filteredEvents} />

          <section className="events-section">
            <div className="events-section-header">
              <h2>My Event Assignments</h2>
              <p>Events you are currently assigned to referee.</p>
            </div>
            {myEvents.length === 0 ? (
              <div className="events-empty">
                <p>You have not joined any upcoming events yet.</p>
              </div>
            ) : (
              <div className="events-grid">
                {myEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    actionLoadingId={actionLoadingId}
                    onLeave={handleLeave}
                    onEdit={handleEditEvent}
                    onDelete={handleDeleteEvent}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="events-section">
            <div className="events-section-header">
              <h2>Open Tournament Events</h2>
              <p>Join open events and help cover tournament schedules.</p>
            </div>
            {openEvents.length === 0 ? (
              <div className="events-empty">
                <p>No open events right now.</p>
              </div>
            ) : (
              <div className="events-grid">
                {openEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    actionLoadingId={actionLoadingId}
                    onJoin={handleJoin}
                    onEdit={handleEditEvent}
                    onDelete={handleDeleteEvent}
                  />
                ))}
              </div>
            )}
          </section>

          {fullEvents.length > 0 && (
            <section className="events-section">
              <div className="events-section-header">
                <h2>Currently Full</h2>
                <p>Events that are at capacity and waiting for a spot.</p>
              </div>
              <div className="events-grid">
                {fullEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    actionLoadingId={actionLoadingId}
                    onJoin={handleJoin}
                    onEdit={handleEditEvent}
                    onDelete={handleDeleteEvent}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
