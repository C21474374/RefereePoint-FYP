import type { EventItem } from "../../services/events";

type EventStatsProps = {
  events: EventItem[];
};

export default function EventStats({ events }: EventStatsProps) {
  const joinedCount = events.filter((event) => event.current_user_joined).length;
  const openCount = events.filter(
    (event) => !event.current_user_joined && (event.slots_left === null || event.slots_left > 0)
  ).length;
  const totalSlots = events.reduce((total, event) => {
    if (event.slots_left === null) {
      return total;
    }
    return total + event.slots_left;
  }, 0);

  return (
    <div className="events-stats">
      <div className="events-stat-card">
        <span>Upcoming Events</span>
        <strong>{events.length}</strong>
      </div>
      <div className="events-stat-card">
        <span>My Assignments</span>
        <strong>{joinedCount}</strong>
      </div>
      <div className="events-stat-card">
        <span>Open Events</span>
        <strong>{openCount}</strong>
      </div>
      <div className="events-stat-card">
        <span>Open Slots</span>
        <strong>{totalSlots}</strong>
      </div>
    </div>
  );
}
