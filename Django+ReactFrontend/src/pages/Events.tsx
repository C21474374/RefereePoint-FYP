import { useCallback, useEffect, useMemo, useState } from "react";
import EventCard from "../components/events/EventCard";
import EventForm from "../components/events/EventForm";
import AppIcon from "../components/AppIcon";
import ConfirmDialog from "../components/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
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
import "./Events.css";

type EventSectionKey = "manageEvents" | "myEvents" | "openEvents" | "fullEvents";

export default function Events() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isRefereeUser = Boolean(user?.referee_profile);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [venues, setVenues] = useState<EventVenueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [pendingDeleteEventId, setPendingDeleteEventId] = useState<number | null>(null);
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
      setError("Failed to load events.");
      showToast("Failed to load events.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

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
      setError("Failed to join event.");
      showToast("Failed to join event.", "error");
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
      setError("Failed to leave event.");
      showToast("Failed to leave event.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    setPendingDeleteEventId(eventId);
  };

  const confirmDeleteEvent = async () => {
    if (pendingDeleteEventId === null) {
      return;
    }
    const eventId = pendingDeleteEventId;
    try {
      setActionLoadingId(eventId);
      setError("");
      await deleteEvent(eventId);
      showToast("Event deleted.", "success");
      setPendingDeleteEventId(null);
      await loadPageData();
    } catch (err) {
      setError("Failed to delete event.");
      showToast("Failed to delete event.", "error");
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
      setError("Failed to update event.");
      showToast("Failed to update event.", "error");
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
        <h1 className="page-title-with-icon">
          <AppIcon name="events" className="page-title-icon" />
          <span>Events</span>
        </h1>
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
            <span className="button-with-icon">
              <AppIcon name="filter" />
              <span>Clear Filters</span>
            </span>
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
              <h2 className="section-title-with-icon">
                <AppIcon name="upload" className="section-title-icon" />
                <span>Manage Uploaded Events</span>
              </h2>
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
              aria-label={expandedSections.manageEvents ? "Collapse section" : "Expand section"}
              title={expandedSections.manageEvents ? "Collapse section" : "Expand section"}
            >
              <span className="inline-icon-label">
                <AppIcon
                  name={expandedSections.manageEvents ? "filter" : "plus"}
                  className="events-section-toggle-icon"
                />
                <span>{expandedSections.manageEvents ? "Collapse" : "Expand"}</span>
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
                  <h2 className="section-title-with-icon">
                    <AppIcon name="calendar" className="section-title-icon" />
                    <span>My Event Assignments</span>
                  </h2>
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
                  aria-label={expandedSections.myEvents ? "Collapse section" : "Expand section"}
                  title={expandedSections.myEvents ? "Collapse section" : "Expand section"}
                >
                  <span className="inline-icon-label">
                    <AppIcon
                      name={expandedSections.myEvents ? "filter" : "plus"}
                      className="events-section-toggle-icon"
                    />
                    <span>{expandedSections.myEvents ? "Collapse" : "Expand"}</span>
                  </span>
                </button>
              </section>

              <section
                className={`events-section ${
                  expandedSections.openEvents ? "expanded" : "collapsed"
                }`}
              >
                <div className="events-section-header">
                  <h2 className="section-title-with-icon">
                    <AppIcon name="events" className="section-title-icon" />
                    <span>Open Tournament Events</span>
                  </h2>
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
                  aria-label={expandedSections.openEvents ? "Collapse section" : "Expand section"}
                  title={expandedSections.openEvents ? "Collapse section" : "Expand section"}
                >
                  <span className="inline-icon-label">
                    <AppIcon
                      name={expandedSections.openEvents ? "filter" : "plus"}
                      className="events-section-toggle-icon"
                    />
                    <span>{expandedSections.openEvents ? "Collapse" : "Expand"}</span>
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
                    <h2 className="section-title-with-icon">
                      <AppIcon name="user" className="section-title-icon" />
                      <span>Currently Full</span>
                    </h2>
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
                    aria-label={expandedSections.fullEvents ? "Collapse section" : "Expand section"}
                    title={expandedSections.fullEvents ? "Collapse section" : "Expand section"}
                  >
                    <span className="inline-icon-label">
                      <AppIcon
                        name={expandedSections.fullEvents ? "filter" : "plus"}
                        className="events-section-toggle-icon"
                      />
                      <span>{expandedSections.fullEvents ? "Collapse" : "Expand"}</span>
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
              <h2 className="section-title-with-icon">
                <AppIcon name="settings" className="section-title-icon" />
                <span>Edit Event</span>
              </h2>
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
                eventTypeLabel={editingEvent.event_type_display}
                loading={editing}
                onSubmit={handleUpdateEvent}
                onCancelEdit={() => setEditingEvent(null)}
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteEventId !== null}
        title="Delete Event"
        message="Delete this event? This action cannot be undone."
        confirmLabel="Delete Event"
        cancelLabel="Keep Event"
        confirmTone="danger"
        busy={actionLoadingId === pendingDeleteEventId}
        onCancel={() => setPendingDeleteEventId(null)}
        onConfirm={() => {
          void confirmDeleteEvent();
        }}
      />
    </div>
  );
}
