import { useCallback, useEffect, useMemo, useState } from "react";
import EventCard from "../components/events/EventCard";
import EventForm from "../components/events/EventForm";
import { useAuth } from "../context/AuthContext";
import {
  deleteEvent,
  getEventVenueOptions,
  getUpcomingEvents,
  joinEvent,
  leaveEvent,
  type EventItem,
  type EventPayload,
  type EventVenueOption,
  updateEvent,
} from "../services/events";
import "../pages_css/Events.css";

type EventSectionKey = "manageEvents" | "myEvents" | "openEvents" | "fullEvents";

export default function Events() {
  const { user } = useAuth();
  const isRefereeUser = Boolean(user?.referee_profile);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [venues, setVenues] = useState<EventVenueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [myEventsOnly, setMyEventsOnly] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<string>("ALL");
  const [selectedDate, setSelectedDate] = useState("");
  const [expandedSections, setExpandedSections] = useState<
    Record<EventSectionKey, boolean>
  >({
    manageEvents: false,
    myEvents: false,
    openEvents: false,
    fullEvents: false,
  });

  const toggleSection = (key: EventSectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const loadPageData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    const handleRefresh = () => {
      loadPageData();
    };

    window.addEventListener("refereepoint:data-refresh", handleRefresh);
    return () => {
      window.removeEventListener("refereepoint:data-refresh", handleRefresh);
    };
  }, [loadPageData]);

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

  const handleDeleteEvent = async (eventId: number) => {
    const confirmed = window.confirm("Delete this event?");
    if (!confirmed) {
      return;
    }

    try {
      setActionLoadingId(eventId);
      setError("");
      await deleteEvent(eventId);
      await loadPageData();
    } catch (err) {
      console.error(err);
      setError("Failed to delete event.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEditEvent = (event: EventItem) => {
    setError("");
    setEditingEvent(event);
  };

  const handleUpdateEvent = async (payload: EventPayload) => {
    if (!editingEvent) {
      return;
    }

    try {
      setEditing(true);
      setError("");
      await updateEvent(editingEvent.id, payload);
      setEditingEvent(null);
      await loadPageData();
    } catch (err) {
      console.error(err);
      setError("Failed to update event.");
    } finally {
      setEditing(false);
    }
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

  const manageableEvents = useMemo(
    () => filteredEvents.filter((event) => event.can_manage),
    [filteredEvents]
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
          {isRefereeUser
            ? "Join tournament events, track referee coverage, and manage who is assigned."
            : "Upload and manage tournament events created by your organisation."}
        </p>
      </div>

      {!loading && (
        <div className="events-filters">
          {isRefereeUser && (
            <label className="events-filter-toggle">
              <input
                type="checkbox"
                checked={myEventsOnly}
                onChange={(e) => setMyEventsOnly(e.target.checked)}
              />
              <span>My events only</span>
            </label>
          )}

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
          <section
            className={`events-section ${
              expandedSections.manageEvents ? "expanded" : "collapsed"
            }`}
          >
            <div className="events-section-header">
              <h2>Manage Uploaded Events</h2>
              <p>Events you uploaded. Use this section to manage or delete your events.</p>
            </div>

            {expandedSections.manageEvents && (
              <div className="events-section-content">
                {manageableEvents.length === 0 ? (
                  <div className="events-empty">
                    <p>You have no events to manage yet.</p>
                  </div>
                ) : (
                  <div className="events-grid">
                    {manageableEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        actionLoadingId={actionLoadingId}
                        onEdit={handleEditEvent}
                        onDelete={handleDeleteEvent}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className="events-section-toggle"
              onClick={() => toggleSection("manageEvents")}
              aria-expanded={expandedSections.manageEvents}
            >
              <span>{expandedSections.manageEvents ? "Collapse" : "Expand"}</span>
              <span className="events-section-toggle-icon" aria-hidden="true">
                {expandedSections.manageEvents ? "^" : "v"}
              </span>
            </button>
          </section>

          {isRefereeUser && (
            <>
              <section
                className={`events-section ${
                  expandedSections.myEvents ? "expanded" : "collapsed"
                }`}
              >
                <div className="events-section-header">
                  <h2>My Event Assignments</h2>
                  <p>Events you are currently assigned to referee.</p>
                </div>

                {expandedSections.myEvents && (
                  <div className="events-section-content">
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
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="events-section-toggle"
                  onClick={() => toggleSection("myEvents")}
                  aria-expanded={expandedSections.myEvents}
                >
                  <span>{expandedSections.myEvents ? "Collapse" : "Expand"}</span>
                  <span className="events-section-toggle-icon" aria-hidden="true">
                    {expandedSections.myEvents ? "^" : "v"}
                  </span>
                </button>
              </section>

              <section
                className={`events-section ${
                  expandedSections.openEvents ? "expanded" : "collapsed"
                }`}
              >
                <div className="events-section-header">
                  <h2>Open Tournament Events</h2>
                  <p>Join open events and help cover tournament schedules.</p>
                </div>

                {expandedSections.openEvents && (
                  <div className="events-section-content">
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
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="events-section-toggle"
                  onClick={() => toggleSection("openEvents")}
                  aria-expanded={expandedSections.openEvents}
                >
                  <span>{expandedSections.openEvents ? "Collapse" : "Expand"}</span>
                  <span className="events-section-toggle-icon" aria-hidden="true">
                    {expandedSections.openEvents ? "^" : "v"}
                  </span>
                </button>
              </section>

              {fullEvents.length > 0 && (
                <section
                  className={`events-section ${
                    expandedSections.fullEvents ? "expanded" : "collapsed"
                  }`}
                >
                  <div className="events-section-header">
                    <h2>Currently Full</h2>
                    <p>Events that are at capacity and waiting for a spot.</p>
                  </div>

                  {expandedSections.fullEvents && (
                    <div className="events-section-content">
                      <div className="events-grid">
                        {fullEvents.map((event) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            actionLoadingId={actionLoadingId}
                            onJoin={handleJoin}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    className="events-section-toggle"
                    onClick={() => toggleSection("fullEvents")}
                    aria-expanded={expandedSections.fullEvents}
                  >
                    <span>{expandedSections.fullEvents ? "Collapse" : "Expand"}</span>
                    <span className="events-section-toggle-icon" aria-hidden="true">
                      {expandedSections.fullEvents ? "^" : "v"}
                    </span>
                  </button>
                </section>
              )}
            </>
          )}
        </>
      )}

      {editingEvent && (
        <div
          className="upload-modal-overlay"
          onClick={() => {
            if (!editing) {
              setEditingEvent(null);
            }
          }}
        >
          <div
            className="upload-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="upload-modal-header">
              <h2>Edit Event</h2>
              <button
                type="button"
                className="upload-modal-close"
                disabled={editing}
                onClick={() => setEditingEvent(null)}
              >
                Close
              </button>
            </div>
            <div className="upload-modal-body">
              <EventForm
                key={editingEvent.id}
                venues={venues}
                initialEvent={editingEvent}
                loading={editing}
                onSubmit={handleUpdateEvent}
                onCancelEdit={() => setEditingEvent(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
