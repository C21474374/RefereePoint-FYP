import type { EventItem } from "../../services/events";
import AppIcon from "../AppIcon";
import "./EventCard.css";

type EventCardProps = {
  event: EventItem;
  actionLoadingId?: number | null;
  onJoin?: (id: number) => void;
  onLeave?: (id: number) => void;
  onEdit?: (event: EventItem) => void;
  onDelete?: (id: number) => void;
};

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const formattedStart = start.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const formattedEnd = end.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return `${formattedStart} to ${formattedEnd}`;
}

export default function EventCard({
  event,
  actionLoadingId = null,
  onJoin,
  onLeave,
  onEdit,
  onDelete,
}: EventCardProps) {
  const isLoading = actionLoadingId === event.id;
  const slotsLeft = event.slots_left ?? 0;
  const isFull = slotsLeft <= 0;
  const canJoin = !event.current_user_joined && !isFull;
  const canRunPrimaryAction =
    (event.current_user_joined && Boolean(onLeave)) ||
    (!event.current_user_joined && canJoin && Boolean(onJoin));
  const hasManageActions = event.can_manage && (Boolean(onEdit) || Boolean(onDelete));

  const handleAction = () => {
    if (event.current_user_joined) {
      onLeave?.(event.id);
      return;
    }
    if (canJoin) {
      onJoin?.(event.id);
    }
  };

  return (
    <article className="event-card">
      <div className="event-card-top">
        <h3 className="event-card-title section-title-with-icon">
          <AppIcon name="events" className="section-title-icon" />
          <span>{event.venue_name || "Tournament Venue TBC"}</span>
        </h3>
        <span className="event-card-fee">
          {event.fee_per_game ? `EUR ${event.fee_per_game} / game` : "Fee TBC"}
        </span>
      </div>

      <p className="event-card-date">{formatDateRange(event.start_date, event.end_date)}</p>

      <div className="event-card-metrics">
        <span className="event-pill">
          {event.joined_referees_count} joined
        </span>
        <span className="event-pill">
          {event.referees_required} required
        </span>
        <span className="event-pill">
          {slotsLeft} slots left
        </span>
      </div>

      {event.description && <p className="event-card-description">{event.description}</p>}

      {event.joined_referees.length > 0 && (
        <div className="event-card-refs">
          <span className="event-card-label">Referees</span>
          <div className="event-card-ref-list">
            {event.joined_referees.map((referee) => (
              <span key={`${event.id}-${referee.id}`} className="event-ref-chip">
                {referee.name} ({referee.grade})
              </span>
            ))}
          </div>
        </div>
      )}

      {event.contact_information && (
        <p className="event-card-contact">
          <strong>Contact:</strong> {event.contact_information}
        </p>
      )}

      {event.created_by_name && (
        <p className="event-card-contact">
          <strong>Uploaded by:</strong> {event.created_by_name}
        </p>
      )}

      {(canRunPrimaryAction || hasManageActions || (!event.current_user_joined && isFull)) && (
        <div className="event-card-actions">
          <div className="event-card-action-row">
            {canRunPrimaryAction && (
              <button
                className={`event-action-button ${event.current_user_joined ? "event-action-button-leave" : ""}`}
                onClick={handleAction}
                disabled={isLoading || (!event.current_user_joined && !canJoin)}
              >
                <span className="button-with-icon">
                  <AppIcon name={event.current_user_joined ? "logout" : "plus"} />
                  <span>
                    {isLoading
                      ? event.current_user_joined
                        ? "Leaving..."
                        : "Joining..."
                      : event.current_user_joined
                        ? "Leave Event"
                        : "Join Event"}
                  </span>
                </span>
              </button>
            )}

            {event.can_manage && onEdit && (
              <button
                className="event-action-button event-action-button-manage"
                onClick={() => onEdit(event)}
                type="button"
                disabled={isLoading}
              >
                <span className="button-with-icon">
                  <AppIcon name="settings" />
                  <span>Edit</span>
                </span>
              </button>
            )}
            {event.can_manage && onDelete && (
              <button
                className="event-action-button event-action-button-danger"
                onClick={() => onDelete(event.id)}
                type="button"
                disabled={isLoading}
              >
                <span className="button-with-icon">
                  <AppIcon name="logout" />
                  <span>Delete</span>
                </span>
              </button>
            )}
          </div>

          {!event.current_user_joined && isFull && (
            <small className="event-card-warning">This event is currently full.</small>
          )}
        </div>
      )}
    </article>
  );
}
