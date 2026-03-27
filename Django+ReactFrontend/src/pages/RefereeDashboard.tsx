import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardHero from "../components/DashboardHero";
import DashboardStats from "../components/DashboardStats";
import DashboardQuickActions from "../components/DashboardQuickActions";
import { getAccessToken } from "../services/auth";
import "../pages_css/RefereeDashboard.css";

type GameDetails = {
  date?: string;
  time?: string;
  venue_name?: string | null;
  home_team_name?: string | null;
  away_team_name?: string | null;
  division_name?: string | null;
  game_type_display?: string | null;
};

type MyClaimedGame = {
  id: number;
  role_display: string;
  game_details: GameDetails;
};

type UpcomingAssignment = {
  assignment_id: number;
  role_display: string;
  game_details: GameDetails;
};

type OpportunityFeedItem = {
  type: "NON_APPOINTED_SLOT" | "COVER_REQUEST" | "EVENT";
  id: number;
  date: string;
  time: string;
  event_end_date?: string | null;
  venue_name: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  game_type_display: string | null;
  role_display: string | null;
  description?: string;
};

type JoinedEvent = {
  id: number;
  start_date: string;
  end_date: string;
  venue_name: string | null;
  description: string;
};

type MonthlyEarningsSummary = {
  total_claim_amount: string;
  mileage_km_total: string;
};

type NextTakenGame = {
  id: string;
  ageGroup: string;
  date: string;
  time: string | null;
  timestamp: number;
};

type CalendarItem = {
  id: string;
  date: string;
  time: string | null;
  timestamp: number;
  title: string;
  subtitle: string;
  badge: string;
  venueName: string | null;
  isTaken: boolean;
};

const API_BASE_URL = "http://127.0.0.1:8000/api";
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTimeValue(timeValue: string | null | undefined, allDay: boolean) {
  if (allDay) {
    return "23:59:59";
  }

  if (!timeValue) {
    return "00:00:00";
  }

  const trimmed = timeValue.trim();
  if (trimmed.length === 5) {
    return `${trimmed}:00`;
  }

  return trimmed.slice(0, 8);
}

function parseDateTime(
  dateValue: string | null | undefined,
  timeValue: string | null | undefined,
  allDay = false
) {
  if (!dateValue) {
    return null;
  }

  const parsed = new Date(`${dateValue}T${normalizeTimeValue(timeValue, allDay)}`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function toDisplayDate(dateValue: string) {
  const parsed = parseDateTime(dateValue, "00:00:00");
  if (!parsed) {
    return dateValue;
  }
  return parsed.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function toDisplayTime(timeValue: string | null | undefined) {
  if (!timeValue) {
    return "All day";
  }

  const trimmed = timeValue.trim();
  if (trimmed.length >= 5) {
    return trimmed.slice(0, 5);
  }

  return trimmed;
}

function getMonthLabel(date: Date) {
  return date.toLocaleDateString("en-IE", {
    month: "long",
    year: "numeric",
  });
}

function enumerateDateRange(startDate: string, endDate: string) {
  const start = parseDateTime(startDate, "00:00:00");
  const end = parseDateTime(endDate, "00:00:00");

  if (!start || !end || end < start) {
    return [startDate];
  }

  const result: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    result.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

export default function RefereeDashboard() {
  const { user } = useAuth();

  const [myClaimedGames, setMyClaimedGames] = useState<MyClaimedGame[]>([]);
  const [myUpcomingAssignments, setMyUpcomingAssignments] = useState<UpcomingAssignment[]>([]);
  const [openOpportunities, setOpenOpportunities] = useState<OpportunityFeedItem[]>([]);
  const [myJoinedEvents, setMyJoinedEvents] = useState<JoinedEvent[]>([]);
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarningsSummary | null>(null);

  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoadingDashboard(true);
        setDashboardError("");

        const token = getAccessToken();

        if (!token) {
          setMyClaimedGames([]);
          setMyUpcomingAssignments([]);
          setOpenOpportunities([]);
          setMyJoinedEvents([]);
          setMonthlyEarnings(null);
          return;
        }

        const authHeaders = {
          Authorization: `Bearer ${token}`,
        };

        const [
          claimedGamesResponse,
          upcomingAssignmentsResponse,
          opportunitiesResponse,
          joinedEventsResponse,
          earningsResponse,
        ] = await Promise.all([
          fetch(`${API_BASE_URL}/games/my-games/`, {
            headers: authHeaders,
          }),
          fetch(`${API_BASE_URL}/cover-requests/my-upcoming-assignments/`, {
            headers: authHeaders,
          }),
          fetch(`${API_BASE_URL}/games/opportunities/`, {
            headers: authHeaders,
          }),
          fetch(`${API_BASE_URL}/events/?upcoming=true&joined=true`, {
            headers: authHeaders,
          }),
          fetch(`${API_BASE_URL}/expenses/earnings/?period=month`, {
            headers: authHeaders,
          }),
        ]);

        if (claimedGamesResponse.status === 404) {
          setMyClaimedGames([]);
        } else {
          const claimedGamesData = await claimedGamesResponse.json();
          if (!claimedGamesResponse.ok) {
            throw new Error(claimedGamesData.detail || "Failed to load claimed games.");
          }
          setMyClaimedGames(claimedGamesData);
        }

        const upcomingAssignmentsData = await upcomingAssignmentsResponse.json();
        if (!upcomingAssignmentsResponse.ok) {
          throw new Error(upcomingAssignmentsData.detail || "Failed to load appointed games.");
        }
        setMyUpcomingAssignments(upcomingAssignmentsData);

        const opportunitiesData = await opportunitiesResponse.json();
        if (!opportunitiesResponse.ok) {
          throw new Error(opportunitiesData.detail || "Failed to load opportunities.");
        }
        setOpenOpportunities(opportunitiesData);

        const joinedEventsData = await joinedEventsResponse.json();
        if (!joinedEventsResponse.ok) {
          throw new Error(joinedEventsData.detail || "Failed to load joined events.");
        }
        setMyJoinedEvents(joinedEventsData);

        const earningsData = await earningsResponse.json();
        if (!earningsResponse.ok) {
          throw new Error(earningsData.detail || "Failed to load earnings summary.");
        }
        setMonthlyEarnings({
          total_claim_amount: earningsData.totals.total_claim_amount,
          mileage_km_total: earningsData.totals.mileage_km_total,
        });
      } catch (error) {
        setDashboardError(
          error instanceof Error ? error.message : "Failed to load dashboard data."
        );
      } finally {
        setLoadingDashboard(false);
      }
    }

    loadDashboardData();
  }, []);

  const fullName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Referee";

  const displayGrade = user?.referee_profile?.grade?.replaceAll("_", " ") || "N/A";

  const upcomingTakenGames = useMemo(() => {
    const nowMs = Date.now();
    const results: NextTakenGame[] = [];

    myUpcomingAssignments.forEach((assignment) => {
      const dateValue = assignment.game_details?.date;
      const timeValue = assignment.game_details?.time || null;
      const parsedDate = parseDateTime(dateValue, timeValue);

      if (!dateValue || !parsedDate || parsedDate.getTime() < nowMs) {
        return;
      }

      results.push({
        id: `assignment-${assignment.assignment_id}`,
        ageGroup: assignment.game_details?.division_name || "Age Group TBC",
        date: dateValue,
        time: timeValue,
        timestamp: parsedDate.getTime(),
      });
    });

    myClaimedGames.forEach((claimedGame) => {
      const dateValue = claimedGame.game_details?.date;
      const timeValue = claimedGame.game_details?.time || null;
      const parsedDate = parseDateTime(dateValue, timeValue);

      if (!dateValue || !parsedDate || parsedDate.getTime() < nowMs) {
        return;
      }

      results.push({
        id: `claimed-${claimedGame.id}`,
        ageGroup: claimedGame.game_details?.division_name || "Age Group TBC",
        date: dateValue,
        time: timeValue,
        timestamp: parsedDate.getTime(),
      });
    });

    return results.sort((a, b) => a.timestamp - b.timestamp);
  }, [myUpcomingAssignments, myClaimedGames]);

  const nextTakenGame = upcomingTakenGames.length > 0 ? upcomingTakenGames[0] : null;

  const stats = useMemo(
    () => [
      {
        label: "Next Game",
        value: nextTakenGame ? nextTakenGame.ageGroup : "No upcoming game",
        detail: nextTakenGame
          ? `${toDisplayDate(nextTakenGame.date)} • ${toDisplayTime(nextTakenGame.time)}`
          : "No assigned games yet",
      },
      {
        label: "This Month Claim",
        value: `EUR ${monthlyEarnings?.total_claim_amount ?? "0.00"}`,
      },
      {
        label: "Mileage This Month",
        value: `${monthlyEarnings?.mileage_km_total ?? "0.00"} km`,
      },
    ],
    [monthlyEarnings, nextTakenGame]
  );

  const upcomingCalendarItems = useMemo(() => {
    const nowMs = Date.now();
    const items: CalendarItem[] = [];

    openOpportunities.forEach((opportunity) => {
      if (opportunity.type === "EVENT") {
        const dates = enumerateDateRange(
          opportunity.date,
          opportunity.event_end_date || opportunity.date
        );

        dates.forEach((dateKey) => {
          const parsedDate = parseDateTime(dateKey, null, true);
          if (!parsedDate) {
            return;
          }

          items.push({
            id: `open-event-${opportunity.id}-${dateKey}`,
            date: dateKey,
            time: null,
            timestamp: parsedDate.getTime(),
            title: opportunity.venue_name
              ? `Open Event at ${opportunity.venue_name}`
              : "Open Event",
            subtitle: opportunity.description?.trim() || "Tournament event opportunity",
            badge: "Event Opportunity",
            venueName: opportunity.venue_name,
            isTaken: false,
          });
        });

        return;
      }

      const parsedDate = parseDateTime(opportunity.date, opportunity.time);
      if (!parsedDate) {
        return;
      }

      const homeTeam = opportunity.home_team_name || "Home Team";
      const awayTeam = opportunity.away_team_name || "Away Team";

      if (opportunity.type === "COVER_REQUEST") {
        items.push({
          id: `open-cover-${opportunity.id}`,
          date: opportunity.date,
          time: opportunity.time,
          timestamp: parsedDate.getTime(),
          title: `${homeTeam} vs ${awayTeam}`,
          subtitle: `Cover request • ${opportunity.role_display || "Role TBC"}`,
          badge: "Cover Request",
          venueName: opportunity.venue_name,
          isTaken: false,
        });
        return;
      }

      items.push({
        id: `open-slot-${opportunity.id}`,
        date: opportunity.date,
        time: opportunity.time,
        timestamp: parsedDate.getTime(),
        title: `${homeTeam} vs ${awayTeam}`,
        subtitle: `${opportunity.game_type_display || "Game"} • ${opportunity.role_display || "Role TBC"}`,
        badge: "Open Game",
        venueName: opportunity.venue_name,
        isTaken: false,
      });
    });

    myUpcomingAssignments.forEach((assignment) => {
      const dateValue = assignment.game_details?.date;
      const timeValue = assignment.game_details?.time || null;
      const parsedDate = parseDateTime(dateValue, timeValue);

      if (!dateValue || !parsedDate) {
        return;
      }

      const homeTeam = assignment.game_details?.home_team_name || "Home Team";
      const awayTeam = assignment.game_details?.away_team_name || "Away Team";

      items.push({
        id: `my-assignment-${assignment.assignment_id}`,
        date: dateValue,
        time: timeValue,
        timestamp: parsedDate.getTime(),
        title: `${homeTeam} vs ${awayTeam}`,
        subtitle: `${assignment.game_details?.game_type_display || "Game"} • ${assignment.role_display}`,
        badge: "My Assignment",
        venueName: assignment.game_details?.venue_name || null,
        isTaken: true,
      });
    });

    myClaimedGames.forEach((claimedGame) => {
      const dateValue = claimedGame.game_details?.date;
      const timeValue = claimedGame.game_details?.time || null;
      const parsedDate = parseDateTime(dateValue, timeValue);

      if (!dateValue || !parsedDate) {
        return;
      }

      const homeTeam = claimedGame.game_details?.home_team_name || "Home Team";
      const awayTeam = claimedGame.game_details?.away_team_name || "Away Team";

      items.push({
        id: `my-claimed-${claimedGame.id}`,
        date: dateValue,
        time: timeValue,
        timestamp: parsedDate.getTime(),
        title: `${homeTeam} vs ${awayTeam}`,
        subtitle: `${claimedGame.role_display} • ${claimedGame.game_details?.game_type_display || "Game"}`,
        badge: "Taken Game",
        venueName: claimedGame.game_details?.venue_name || null,
        isTaken: true,
      });
    });

    myJoinedEvents.forEach((event) => {
      const dates = enumerateDateRange(event.start_date, event.end_date);

      dates.forEach((dateKey) => {
        const parsedDate = parseDateTime(dateKey, null, true);
        if (!parsedDate) {
          return;
        }

        items.push({
          id: `my-event-${event.id}-${dateKey}`,
          date: dateKey,
          time: null,
          timestamp: parsedDate.getTime(),
          title: event.venue_name ? `My Event at ${event.venue_name}` : "My Event",
          subtitle: event.description?.trim() || "Joined event assignment",
          badge: "My Event",
          venueName: event.venue_name,
          isTaken: true,
        });
      });
    });

    return items
      .filter((item) => item.timestamp >= nowMs)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [myClaimedGames, myJoinedEvents, myUpcomingAssignments, openOpportunities]);

  const calendarItemsByDate = useMemo(() => {
    const grouped: Record<string, CalendarItem[]> = {};

    upcomingCalendarItems.forEach((item) => {
      if (!grouped[item.date]) {
        grouped[item.date] = [];
      }
      grouped[item.date].push(item);
    });

    Object.keys(grouped).forEach((dateKey) => {
      grouped[dateKey].sort((a, b) => a.timestamp - b.timestamp);
    });

    return grouped;
  }, [upcomingCalendarItems]);

  useEffect(() => {
    if (upcomingCalendarItems.length === 0) {
      setSelectedDateKey(null);
      return;
    }

    if (!selectedDateKey || !calendarItemsByDate[selectedDateKey]?.length) {
      const firstDate = upcomingCalendarItems[0].date;
      setSelectedDateKey(firstDate);

      const [year, month] = firstDate.split("-").map(Number);
      if (year && month) {
        setCalendarMonth(new Date(year, month - 1, 1));
      }
    }
  }, [calendarItemsByDate, upcomingCalendarItems, selectedDateKey]);

  const selectedDayItems = selectedDateKey
    ? (calendarItemsByDate[selectedDateKey] || [])
    : [];

  const calendarDays = useMemo(() => {
    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [calendarMonth]);

  const currentDateKey = formatDateKey(new Date());

  return (
    <div className="dashboard-page">
      <DashboardHero
        name={fullName}
        grade={displayGrade}
        email={user?.email || ""}
      />

      <DashboardStats stats={stats} />

      <section className="dashboard-calendar-section">
        <div className="dashboard-calendar-header">
          <h2>Upcoming Opportunities Calendar</h2>
          <div className="dashboard-calendar-nav">
            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                )
              }
            >
              Prev
            </button>
            <p>{getMonthLabel(calendarMonth)}</p>
            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                )
              }
            >
              Next
            </button>
          </div>
        </div>

        {loadingDashboard ? (
          <div className="dashboard-no-games-message">
            <p>Loading upcoming opportunities...</p>
          </div>
        ) : upcomingCalendarItems.length === 0 ? (
          <div className="dashboard-no-games-message">
            <p>No upcoming opportunities found.</p>
          </div>
        ) : (
          <>
            <div className="dashboard-calendar-weekdays">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label} className="dashboard-calendar-weekday">
                  {label}
                </span>
              ))}
            </div>

            <div className="dashboard-calendar-grid">
              {calendarDays.map((day) => {
                const dayKey = formatDateKey(day);
                const hasItems = Boolean(calendarItemsByDate[dayKey]?.length);
                const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                const isSelected = selectedDateKey === dayKey;
                const isToday = dayKey === currentDateKey;

                const classes = ["dashboard-calendar-day"];
                if (!isCurrentMonth) classes.push("is-outside-month");
                if (hasItems) classes.push("has-items");
                if (isSelected) classes.push("is-selected");
                if (isToday) classes.push("is-today");

                return (
                  <button
                    key={dayKey}
                    type="button"
                    className={classes.join(" ")}
                    onClick={() => setSelectedDateKey(dayKey)}
                  >
                    <span className="dashboard-calendar-day-number">{day.getDate()}</span>
                    {hasItems && <span className="dashboard-calendar-dot" />}
                  </button>
                );
              })}
            </div>

            <div className="dashboard-day-details">
              <div className="dashboard-day-details-header">
                <h3>{selectedDateKey ? toDisplayDate(selectedDateKey) : "Select a date"}</h3>
                {selectedDateKey && (
                  <p>
                    {selectedDayItems.length} item
                    {selectedDayItems.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>

              {selectedDateKey && selectedDayItems.length > 0 ? (
                <div className="dashboard-day-list">
                  {selectedDayItems.map((item) => (
                    <article key={item.id} className="dashboard-day-item">
                      <div className="dashboard-day-item-top">
                        <h4>{item.title}</h4>
                        <span className="dashboard-day-item-time">
                          {toDisplayTime(item.time)}
                        </span>
                      </div>
                      <p className="dashboard-day-item-subtitle">{item.subtitle}</p>
                      <div className="dashboard-day-item-meta">
                        <span
                          className={`dashboard-day-badge ${item.isTaken ? "taken" : "open"}`}
                        >
                          {item.badge}
                        </span>
                        {item.venueName && (
                          <span className="dashboard-day-venue">{item.venueName}</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="dashboard-no-games-message">
                  <p>
                    {selectedDateKey
                      ? "No opportunities on this date."
                      : "Select a date with a red dot to view opportunities."}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <DashboardQuickActions />

      {dashboardError && <p className="dashboard-error-message">{dashboardError}</p>}
    </div>
  );
}
