import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DashboardHero from "../components/DashboardHero";
import DashboardStats from "../components/DashboardStats";
import DashboardQuickActions from "../components/DashboardQuickActions";
import GameDetailsModal, {
  type GameDetailsModalData,
} from "../components/GameDetailsModal";
import { getAccessToken } from "../services/auth";
import { fetchPendingApprovalAccounts } from "../services/approvals";
import "../pages_css/RefereeDashboard.css";

type GameDetails = {
  date?: string;
  time?: string;
  venue_name?: string | null;
  lat?: number | null;
  lng?: number | null;
  home_team_name?: string | null;
  away_team_name?: string | null;
  division_name?: string | null;
  division_gender?: string | null;
  game_type_display?: string | null;
  payment_type_display?: string | null;
  status_display?: string | null;
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

type JoinedEvent = {
  id: number;
  start_date: string;
  end_date: string;
  venue_name: string | null;
  description: string;
  lat?: number | null;
  lng?: number | null;
};

type UploadedManagedGame = {
  id: number;
  game_type?: "CLUB" | "SCHOOL" | "COLLEGE" | "FRIENDLY" | "DOA" | "NL" | string | null;
  date: string;
  time?: string | null;
  venue_name?: string | null;
  lat?: number | null;
  lng?: number | null;
  home_team_name?: string | null;
  away_team_name?: string | null;
  division_name?: string | null;
  division_gender?: string | null;
  game_type_display?: string | null;
  payment_type_display?: string | null;
  status_display?: string | null;
  uploaded_slots?: Array<{
    id: number;
    role: "CREW_CHIEF" | "UMPIRE_1" | string;
    status: "OPEN" | "CLAIMED" | "CLOSED" | "CANCELLED" | string;
    is_active?: boolean;
  }>;
  appointed_assignments?: Array<{
    id: number;
    role: "CREW_CHIEF" | "UMPIRE_1" | "UMPIRE_2" | string;
    referee: number;
  }>;
};

type ManagedEvent = {
  id: number;
  start_date: string;
  end_date: string;
  venue_name: string | null;
  description: string;
  lat?: number | null;
  lng?: number | null;
  event_type_display?: string;
  fee_per_game?: string | null;
  joined_referees_count?: number | null;
  slots_left?: number | null;
  can_manage?: boolean;
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
  details: GameDetailsModalData;
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

function formatAgeGroupWithGender(
  ageGroup: string | null | undefined,
  gender: string | null | undefined
) {
  const safeAgeGroup = ageGroup || "Age Group TBC";
  if (!gender) {
    return safeAgeGroup;
  }

  const normalized = gender.trim().toLowerCase();
  let shortLabel = "";

  if (normalized.startsWith("m")) {
    shortLabel = "M";
  } else if (normalized.startsWith("f")) {
    shortLabel = "F";
  } else {
    shortLabel = gender.trim().charAt(0).toUpperCase();
  }

  if (!shortLabel) {
    return safeAgeGroup;
  }

  return `${safeAgeGroup} (${shortLabel})`;
}

function buildDivisionDisplay(
  divisionName: string | null | undefined,
  divisionGender: string | null | undefined
) {
  if (!divisionName) {
    return null;
  }

  return `${divisionName}${divisionGender ? ` ${divisionGender}` : ""}`;
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

function getResponseErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const detail = (data as { detail?: string }).detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
  }
  return fallback;
}

export default function RefereeDashboard() {
  const { user } = useAuth();
  const isRefereeUser = Boolean(user?.referee_profile);
  const hasEventManagerScope = Boolean(user?.allowed_upload_event_types?.length);
  const canApproveAccounts = Boolean(user?.can_approve_accounts);
  const isAdminDashboard = !isRefereeUser && canApproveAccounts;

  const [myClaimedGames, setMyClaimedGames] = useState<MyClaimedGame[]>([]);
  const [myUpcomingAssignments, setMyUpcomingAssignments] = useState<UpcomingAssignment[]>([]);
  const [myJoinedEvents, setMyJoinedEvents] = useState<JoinedEvent[]>([]);
  const [myUploadedGames, setMyUploadedGames] = useState<UploadedManagedGame[]>([]);
  const [myManagedEvents, setMyManagedEvents] = useState<ManagedEvent[]>([]);
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarningsSummary | null>(null);
  const [pendingApprovalCount, setPendingApprovalCount] = useState<number | null>(null);

  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedCalendarItem, setSelectedCalendarItem] = useState<CalendarItem | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoadingDashboard(true);
        setDashboardError("");

        const token = getAccessToken();
        if (!token) {
          setMyClaimedGames([]);
          setMyUpcomingAssignments([]);
          setMyJoinedEvents([]);
          setMyUploadedGames([]);
          setMyManagedEvents([]);
          setMonthlyEarnings(null);
          setPendingApprovalCount(null);
          return;
        }

        const authHeaders = {
          Authorization: `Bearer ${token}`,
        };

        if (isRefereeUser) {
          const [
            claimedGamesResponse,
            upcomingAssignmentsResponse,
            joinedEventsResponse,
            earningsResponse,
          ] = await Promise.all([
            fetch(`${API_BASE_URL}/games/my-games/`, {
              headers: authHeaders,
            }),
            fetch(`${API_BASE_URL}/cover-requests/my-upcoming-assignments/`, {
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
              throw new Error(
                getResponseErrorMessage(claimedGamesData, "Failed to load claimed games.")
              );
            }
            setMyClaimedGames(claimedGamesData as MyClaimedGame[]);
          }

          const upcomingAssignmentsData = await upcomingAssignmentsResponse.json();
          if (!upcomingAssignmentsResponse.ok) {
            throw new Error(
              getResponseErrorMessage(upcomingAssignmentsData, "Failed to load appointed games.")
            );
          }
          setMyUpcomingAssignments(upcomingAssignmentsData as UpcomingAssignment[]);

          const joinedEventsData = await joinedEventsResponse.json();
          if (!joinedEventsResponse.ok) {
            throw new Error(
              getResponseErrorMessage(joinedEventsData, "Failed to load joined events.")
            );
          }
          setMyJoinedEvents(joinedEventsData as JoinedEvent[]);

          const earningsData = await earningsResponse.json();
          if (!earningsResponse.ok) {
            throw new Error(
              getResponseErrorMessage(earningsData, "Failed to load earnings summary.")
            );
          }
          const totals = (earningsData as { totals?: MonthlyEarningsSummary }).totals;
          setMonthlyEarnings({
            total_claim_amount: totals?.total_claim_amount ?? "0.00",
            mileage_km_total: totals?.mileage_km_total ?? "0.00",
          });

          setMyUploadedGames([]);
          setMyManagedEvents([]);
          setPendingApprovalCount(null);
          return;
        }

        const pendingApprovalsPromise = canApproveAccounts
          ? fetchPendingApprovalAccounts()
              .then((accounts) => accounts.length)
              .catch(() => null)
          : Promise.resolve<number | null>(null);
        const eventsPromise = hasEventManagerScope
          ? fetch(`${API_BASE_URL}/events/?upcoming=true`, {
              headers: authHeaders,
            })
          : Promise.resolve<Response | null>(null);

        const [uploadedGamesResponse, eventsResponse, pendingApprovals] = await Promise.all([
          fetch(`${API_BASE_URL}/games/my-uploads/`, {
            headers: authHeaders,
          }),
          eventsPromise,
          pendingApprovalsPromise,
        ]);

        const uploadedGamesData = await uploadedGamesResponse.json();
        if (!uploadedGamesResponse.ok) {
          throw new Error(
            getResponseErrorMessage(uploadedGamesData, "Failed to load uploaded games.")
          );
        }
        setMyUploadedGames(uploadedGamesData as UploadedManagedGame[]);

        if (eventsResponse) {
          const eventsData = await eventsResponse.json();
          if (!eventsResponse.ok) {
            throw new Error(
              getResponseErrorMessage(eventsData, "Failed to load uploaded events.")
            );
          }
          const manageableEvents = (eventsData as ManagedEvent[]).filter((event) =>
            Boolean(event.can_manage)
          );
          setMyManagedEvents(manageableEvents);
        } else {
          setMyManagedEvents([]);
        }

        setPendingApprovalCount(pendingApprovals);

        setMyClaimedGames([]);
        setMyUpcomingAssignments([]);
        setMyJoinedEvents([]);
        setMonthlyEarnings(null);
      } catch (error) {
        setDashboardError(
          error instanceof Error ? error.message : "Failed to load dashboard data."
        );
      } finally {
        setLoadingDashboard(false);
      }
    }

    loadDashboardData();
  }, [canApproveAccounts, hasEventManagerScope, isRefereeUser]);

  const fullName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    (isRefereeUser ? "Referee" : "Manager");
  const accountType = user?.account_type || "";
  const displayGrade = user?.referee_profile?.grade?.replaceAll("_", " ") || "N/A";
  const heroBadgeLabel = isRefereeUser ? displayGrade : user?.account_type_display || "Manager";
  const heroSubtitle = isRefereeUser
    ? "Ready to referee? Check your next game and take action."
    : isAdminDashboard
      ? "Review approvals, monitor appointed uploads, and keep assignments on track."
      : "Manage uploaded games and upcoming schedules for your organisation.";

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
        ageGroup: formatAgeGroupWithGender(
          assignment.game_details?.division_name,
          assignment.game_details?.division_gender
        ),
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
        ageGroup: formatAgeGroupWithGender(
          claimedGame.game_details?.division_name,
          claimedGame.game_details?.division_gender
        ),
        date: dateValue,
        time: timeValue,
        timestamp: parsedDate.getTime(),
      });
    });

    return results.sort((a, b) => a.timestamp - b.timestamp);
  }, [myClaimedGames, myUpcomingAssignments]);

  const nextTakenGame = upcomingTakenGames.length > 0 ? upcomingTakenGames[0] : null;

  const upcomingCalendarItems = useMemo(() => {
    const nowMs = Date.now();
    const items: CalendarItem[] = [];

    if (isRefereeUser) {
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
          subtitle: `${assignment.game_details?.game_type_display || "Game"} - ${assignment.role_display}`,
          badge: "My Assignment",
          venueName: assignment.game_details?.venue_name || null,
          isTaken: true,
          details: {
            id: `my-assignment-${assignment.assignment_id}`,
            title: `${homeTeam} vs ${awayTeam}`,
            typeLabel: "Assignment",
            badge: "My Assignment",
            date: dateValue,
            time: timeValue,
            venueName: assignment.game_details?.venue_name || null,
            latitude: assignment.game_details?.lat ?? null,
            longitude: assignment.game_details?.lng ?? null,
            roleDisplay: assignment.role_display,
            gameTypeDisplay: assignment.game_details?.game_type_display || null,
            divisionDisplay: buildDivisionDisplay(
              assignment.game_details?.division_name,
              assignment.game_details?.division_gender
            ),
            paymentTypeDisplay: assignment.game_details?.payment_type_display || null,
            statusDisplay: assignment.game_details?.status_display || null,
          },
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
          subtitle: `${claimedGame.role_display} - ${claimedGame.game_details?.game_type_display || "Game"}`,
          badge: "Taken Game",
          venueName: claimedGame.game_details?.venue_name || null,
          isTaken: true,
          details: {
            id: `my-claimed-${claimedGame.id}`,
            title: `${homeTeam} vs ${awayTeam}`,
            typeLabel: "Taken Game",
            badge: "Taken Game",
            date: dateValue,
            time: timeValue,
            venueName: claimedGame.game_details?.venue_name || null,
            latitude: claimedGame.game_details?.lat ?? null,
            longitude: claimedGame.game_details?.lng ?? null,
            roleDisplay: claimedGame.role_display,
            gameTypeDisplay: claimedGame.game_details?.game_type_display || null,
            divisionDisplay: buildDivisionDisplay(
              claimedGame.game_details?.division_name,
              claimedGame.game_details?.division_gender
            ),
            paymentTypeDisplay: claimedGame.game_details?.payment_type_display || null,
            statusDisplay: claimedGame.game_details?.status_display || null,
            claimedByName: "You",
          },
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
            details: {
              id: `my-event-${event.id}-${dateKey}`,
              title: event.venue_name ? `My Event at ${event.venue_name}` : "My Event",
              typeLabel: "Event",
              badge: "My Event",
              date: dateKey,
              time: null,
              endDate: event.end_date,
              venueName: event.venue_name,
              latitude: event.lat ?? null,
              longitude: event.lng ?? null,
              description: event.description?.trim() || null,
            },
          });
        });
      });
    } else {
      myUploadedGames.forEach((game) => {
        const dateValue = game.date;
        const timeValue = game.time || null;
        const parsedDate = parseDateTime(dateValue, timeValue);

        if (!dateValue || !parsedDate) {
          return;
        }

        const homeTeam = game.home_team_name || "Home Team";
        const awayTeam = game.away_team_name || "Away Team";

        items.push({
          id: `uploaded-game-${game.id}`,
          date: dateValue,
          time: timeValue,
          timestamp: parsedDate.getTime(),
          title: `${homeTeam} vs ${awayTeam}`,
          subtitle: `${game.game_type_display || "Game"} upload`,
          badge: "Uploaded Game",
          venueName: game.venue_name || null,
          isTaken: true,
          details: {
            id: `uploaded-game-${game.id}`,
            title: `${homeTeam} vs ${awayTeam}`,
            typeLabel: "Uploaded Game",
            badge: "Uploaded Game",
            date: dateValue,
            time: timeValue,
            venueName: game.venue_name || null,
            latitude: game.lat ?? null,
            longitude: game.lng ?? null,
            gameTypeDisplay: game.game_type_display || null,
            divisionDisplay: buildDivisionDisplay(game.division_name, game.division_gender),
            paymentTypeDisplay: game.payment_type_display || null,
            statusDisplay: game.status_display || null,
          },
        });
      });

      myManagedEvents.forEach((event) => {
        const dates = enumerateDateRange(event.start_date, event.end_date);

        dates.forEach((dateKey) => {
          const parsedDate = parseDateTime(dateKey, null, true);
          if (!parsedDate) {
            return;
          }

          items.push({
            id: `uploaded-event-${event.id}-${dateKey}`,
            date: dateKey,
            time: null,
            timestamp: parsedDate.getTime(),
            title: event.venue_name ? `Uploaded Event at ${event.venue_name}` : "Uploaded Event",
            subtitle: event.description?.trim() || "Uploaded event",
            badge: "Uploaded Event",
            venueName: event.venue_name,
            isTaken: true,
            details: {
              id: `uploaded-event-${event.id}-${dateKey}`,
              title: event.venue_name ? `Uploaded Event at ${event.venue_name}` : "Uploaded Event",
              typeLabel: "Uploaded Event",
              badge: "Uploaded Event",
              date: dateKey,
              time: null,
              endDate: event.end_date,
              venueName: event.venue_name,
              latitude: event.lat ?? null,
              longitude: event.lng ?? null,
              gameTypeDisplay: event.event_type_display || "Event",
              description: event.description?.trim() || null,
              feePerGame: event.fee_per_game ?? null,
              joinedRefereesCount: event.joined_referees_count ?? null,
              slotsLeft: event.slots_left ?? null,
            },
          });
        });
      });
    }

    return items
      .filter((item) => item.timestamp >= nowMs)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [
    isRefereeUser,
    myClaimedGames,
    myJoinedEvents,
    myManagedEvents,
    myUpcomingAssignments,
    myUploadedGames,
  ]);

  const nextManagedCalendarItem =
    !isRefereeUser && upcomingCalendarItems.length > 0 ? upcomingCalendarItems[0] : null;
  const openUploadedSlotCount = useMemo(
    () =>
      myUploadedGames.reduce((sum, game) => {
        const openSlots = (game.uploaded_slots || []).filter(
          (slot) => slot.status === "OPEN" && slot.is_active !== false
        ).length;
        return sum + openSlots;
      }, 0),
    [myUploadedGames]
  );
  const appointedUploadCount = useMemo(
    () =>
      myUploadedGames.filter((game) => {
        const gameType = String(game.game_type || "").toUpperCase();
        return gameType === "DOA" || gameType === "NL";
      }).length,
    [myUploadedGames]
  );
  const gamesNeedingAssignmentsCount = useMemo(
    () =>
      myUploadedGames.reduce((sum, game) => {
        const gameType = String(game.game_type || "").toUpperCase();
        if (gameType !== "DOA" && gameType !== "NL") {
          return sum;
        }

        const roles = new Set(
          (game.appointed_assignments || []).map((assignment) => assignment.role)
        );
        const hasCrewChief = roles.has("CREW_CHIEF");
        const hasUmpireOne = roles.has("UMPIRE_1");
        return sum + (hasCrewChief && hasUmpireOne ? 0 : 1);
      }, 0),
    [myUploadedGames]
  );

  const stats = useMemo(() => {
    if (isRefereeUser) {
      return [
        {
          label: "Next Game",
          value: nextTakenGame ? nextTakenGame.ageGroup : "No upcoming game",
          detail: nextTakenGame
            ? `${toDisplayDate(nextTakenGame.date)} - ${toDisplayTime(nextTakenGame.time)}`
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
      ];
    }

    if (isAdminDashboard) {
      return [
        {
          label: "Pending Approvals",
          value: String(pendingApprovalCount ?? 0),
          detail: canApproveAccounts
            ? "Accounts waiting for manual review"
            : "Approval access not enabled",
        },
        {
          label: "Appointed Uploads",
          value: String(appointedUploadCount),
          detail: "DOA/NL games currently uploaded",
        },
        {
          label: "Needs Assignment",
          value: String(gamesNeedingAssignmentsCount),
          detail: nextManagedCalendarItem
            ? `Next game: ${toDisplayDate(nextManagedCalendarItem.date)} ${toDisplayTime(nextManagedCalendarItem.time)}`
            : "No upcoming games uploaded",
        },
      ];
    }

    return [
      {
        label: "Uploaded Games",
        value: String(myUploadedGames.length),
      },
      {
        label: "Open Referee Slots",
        value: String(openUploadedSlotCount),
        detail:
          openUploadedSlotCount > 0
            ? "Slots available for referees to claim"
            : "No open slots right now",
      },
      {
        label: "Next Upload",
        value: nextManagedCalendarItem
          ? toDisplayDate(nextManagedCalendarItem.date)
          : "No upcoming upload",
        detail: nextManagedCalendarItem
          ? `${nextManagedCalendarItem.title} - ${toDisplayTime(nextManagedCalendarItem.time)}`
          : "No upcoming games in your uploads",
      },
    ];
  }, [
    appointedUploadCount,
    canApproveAccounts,
    gamesNeedingAssignmentsCount,
    isRefereeUser,
    monthlyEarnings?.mileage_km_total,
    monthlyEarnings?.total_claim_amount,
    myUploadedGames.length,
    nextManagedCalendarItem,
    nextTakenGame,
    openUploadedSlotCount,
    pendingApprovalCount,
    isAdminDashboard,
  ]);

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

    if (!selectedDateKey) {
      const firstDate = upcomingCalendarItems[0].date;
      setSelectedDateKey(firstDate);

      const [year, month] = firstDate.split("-").map(Number);
      if (year && month) {
        setCalendarMonth(new Date(year, month - 1, 1));
      }
    }
  }, [selectedDateKey, upcomingCalendarItems]);

  const selectedDayItems = selectedDateKey ? (calendarItemsByDate[selectedDateKey] || []) : [];

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
  const upcomingWeekUploadCount = useMemo(() => {
    const now = Date.now();
    const sevenDaysAhead = now + 7 * 24 * 60 * 60 * 1000;

    return myUploadedGames.filter((game) => {
      const parsedDate = parseDateTime(game.date, game.time || null);
      if (!parsedDate) {
        return false;
      }

      const timestamp = parsedDate.getTime();
      return timestamp >= now && timestamp <= sevenDaysAhead;
    }).length;
  }, [myUploadedGames]);

  const currentDateKey = formatDateKey(new Date());
  const calendarSectionTitle = isRefereeUser
    ? "Upcoming Games Calendar"
    : isAdminDashboard
      ? "Upcoming Uploads Calendar"
      : "Uploaded Schedule Calendar";
  const calendarLoadingCopy = isRefereeUser
    ? "Loading upcoming games..."
    : "Loading uploaded schedule...";
  const calendarEmptyCopy = isRefereeUser
    ? "No upcoming games found."
    : "No upcoming uploaded games or events found.";
  const dateEmptyCopy = isRefereeUser
    ? "No games on this date."
    : "No uploaded games or events on this date.";
  const roleOverviewTitle = isAdminDashboard ? "Admin Overview" : "Organisation Overview";
  const roleOverviewCopy = isAdminDashboard
    ? "A quick view of approvals, coverage, and near-term schedule pressure."
    : "Track your uploads, event activity, and what is coming up this week.";

  return (
    <div className="dashboard-page">
      <DashboardHero
        name={fullName}
        badgeLabel={heroBadgeLabel}
        email={user?.email || ""}
        subtitle={heroSubtitle}
      />

      <DashboardStats stats={stats} />

      {!isRefereeUser && (
        <section className="dashboard-role-overview">
          <div className="dashboard-role-overview-header">
            <h2>{roleOverviewTitle}</h2>
            <p>{roleOverviewCopy}</p>
          </div>

          <div className="dashboard-role-overview-grid">
            {isAdminDashboard ? (
              <>
                <article className="dashboard-role-overview-card">
                  <h3>Approval Queue</h3>
                  <p className="dashboard-role-overview-value">{pendingApprovalCount ?? 0}</p>
                  <p className="dashboard-role-overview-detail">
                    Pending accounts waiting on admin approval.
                  </p>
                  <Link className="dashboard-role-overview-link" to="/account-approvals">
                    Review Approvals
                  </Link>
                </article>
                <article className="dashboard-role-overview-card">
                  <h3>Coverage Risk</h3>
                  <p className="dashboard-role-overview-value">
                    {gamesNeedingAssignmentsCount}
                  </p>
                  <p className="dashboard-role-overview-detail">
                    Appointed games still missing crew chief or umpire.
                  </p>
                </article>
                <article className="dashboard-role-overview-card">
                  <h3>Next 7 Days</h3>
                  <p className="dashboard-role-overview-value">{upcomingWeekUploadCount}</p>
                  <p className="dashboard-role-overview-detail">
                    Uploaded games scheduled in the coming week.
                  </p>
                </article>
              </>
            ) : (
              <>
                <article className="dashboard-role-overview-card">
                  <h3>Account Role</h3>
                  <p className="dashboard-role-overview-value">
                    {user?.account_type_display || accountType || "Manager"}
                  </p>
                  <p className="dashboard-role-overview-detail">
                    This dashboard is tailored to your uploader account.
                  </p>
                </article>
                <article className="dashboard-role-overview-card">
                  <h3>Managed Events</h3>
                  <p className="dashboard-role-overview-value">{myManagedEvents.length}</p>
                  <p className="dashboard-role-overview-detail">
                    Active upcoming events your account can manage.
                  </p>
                </article>
                <article className="dashboard-role-overview-card">
                  <h3>Next 7 Days</h3>
                  <p className="dashboard-role-overview-value">{upcomingWeekUploadCount}</p>
                  <p className="dashboard-role-overview-detail">
                    Uploaded games scheduled in the coming week.
                  </p>
                </article>
              </>
            )}
          </div>
        </section>
      )}

      <section className="dashboard-calendar-section">
        <div className="dashboard-calendar-header">
          <h2>{calendarSectionTitle}</h2>
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
            <p>{calendarLoadingCopy}</p>
          </div>
        ) : upcomingCalendarItems.length === 0 ? (
          <div className="dashboard-no-games-message">
            <p>{calendarEmptyCopy}</p>
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
                    onClick={() => {
                      setSelectedDateKey(dayKey);
                      if (!isCurrentMonth) {
                        setCalendarMonth(new Date(day.getFullYear(), day.getMonth(), 1));
                      }
                    }}
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
                        <span className="dashboard-day-item-time">{toDisplayTime(item.time)}</span>
                      </div>
                      <p className="dashboard-day-item-subtitle">
                        {item.badge}
                        {item.venueName ? ` - ${item.venueName}` : ""}
                      </p>
                      <div className="dashboard-day-item-actions">
                        <button
                          type="button"
                          className="dashboard-day-view-btn"
                          onClick={() => setSelectedCalendarItem(item)}
                        >
                          View Details
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="dashboard-no-games-message">
                  <p>
                    {selectedDateKey
                      ? dateEmptyCopy
                      : "Select a date to view schedule items."}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <GameDetailsModal
        open={Boolean(selectedCalendarItem)}
        details={selectedCalendarItem?.details || null}
        onClose={() => setSelectedCalendarItem(null)}
      />

      <DashboardQuickActions />

      {dashboardError && <p className="dashboard-error-message">{dashboardError}</p>}
    </div>
  );
}
