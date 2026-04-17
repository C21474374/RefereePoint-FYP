import { useCallback, useEffect, useMemo, useState } from "react";
import AppIcon from "../components/AppIcon";
import ConfirmDialog from "../components/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  deleteUploadedGame,
  getMyUploadedGames,
  getRefereeOptions,
  getUploadGameFormOptions,
  updateUploadedGame,
  uploadAppointedGame,
  type ManageUploadedGamePayload,
  type RefereeOption,
  type SimpleOption,
  type TeamOption,
  type UploadedGame,
} from "../services/games";
import "./BulkGameUpload.css";

type BulkGameUploadProps = {
  embedded?: boolean;
  onUploaded?: () => void;
};

type RowStatus = "READY" | "UPLOADING" | "UPLOADED" | "ERROR";
type RoleValue = "CREW_CHIEF" | "UMPIRE_1";

type SpreadsheetRowFields = {
  date: string;
  time: string;
  venue: string;
  division: string;
  home_team: string;
  away_team: string;
  crew_chief: string;
  umpire_1: string;
};

type UploadRow = SpreadsheetRowFields & {
  id: number;
  status: RowStatus;
  message: string;
  uploading: boolean;
  is_dirty: boolean;
};

type ExistingRow = SpreadsheetRowFields & {
  game_id: number;
  status: RowStatus;
  message: string;
  saving: boolean;
  deleting: boolean;
  can_edit: boolean;
  can_delete: boolean;
  lock_reason: string;
  is_dirty: boolean;
};

type SpreadsheetValidationError = {
  error: string;
};

type SpreadsheetValidationSuccess = {
  selectedDivisionId: number;
  venueId: number;
  homeTeamId: number;
  awayTeamId: number;
  appointedAssignments: Array<{ role: RoleValue; referee: number }>;
};

type SpreadsheetValidationResult =
  | SpreadsheetValidationError
  | SpreadsheetValidationSuccess;

function sortExistingSpreadsheetRows(rows: ExistingRow[]) {
  return [...rows].sort((a, b) =>
    `${a.date} ${normalizeTimeValue(a.time)}`.localeCompare(
      `${b.date} ${normalizeTimeValue(b.time)}`
    )
  );
}

const MONTH_FILTER_ALL = "ALL_MONTHS";

function normalizeTimeValue(value: string) {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

function dateTimeKey(dateValue: string, timeValue: string) {
  const normalizedTime = normalizeTimeValue(timeValue);
  if (!dateValue || !normalizedTime) {
    return "";
  }
  return `${dateValue}|${normalizedTime}`;
}

function buildAllowedTimeOptions(dateValue: string) {
  if (!dateValue) {
    return [];
  }
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return [];
  }

  const dayOfWeek = parsed.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const startMinutes = isWeekend ? 10 * 60 : 19 * 60;
  const endMinutes = 22 * 60;

  const options: string[] = [];
  for (let minute = startMinutes; minute <= endMinutes; minute += 30) {
    const hours = Math.floor(minute / 60)
      .toString()
      .padStart(2, "0");
    const mins = (minute % 60).toString().padStart(2, "0");
    options.push(`${hours}:${mins}`);
  }
  return options;
}

function isAllowedGameTime(dateValue: string, timeValue: string) {
  const normalizedTime = normalizeTimeValue(timeValue);
  if (!dateValue || !normalizedTime) {
    return false;
  }
  return buildAllowedTimeOptions(dateValue).includes(normalizedTime);
}

function createEmptyRow(id: number): UploadRow {
  return {
    id,
    date: "",
    time: "",
    venue: "",
    division: "",
    home_team: "",
    away_team: "",
    crew_chief: "",
    umpire_1: "",
    status: "READY",
    message: "",
    uploading: false,
    is_dirty: false,
  };
}

function hasAnyRowInput(row: SpreadsheetRowFields) {
  return Boolean(
    row.date ||
      row.time ||
      row.venue ||
      row.division ||
      row.home_team ||
      row.away_team ||
      row.crew_chief ||
      row.umpire_1
  );
}

function toMonthKey(dateValue: string) {
  if (!dateValue || dateValue.length < 7) {
    return "";
  }
  return dateValue.slice(0, 7);
}

function getCurrentMonthKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

type PersistedDraftRow = SpreadsheetRowFields & {
  id: number;
};

function getDraftStorageKey(userId?: number, accountType?: string) {
  if (!userId || !accountType) {
    return "";
  }
  return `refereepoint.bulk-upload-drafts.${accountType}.${userId}`;
}

function sanitizePersistedDraftRows(
  value: unknown
): { rows: UploadRow[]; nextRowId: number; monthFilter: string | null } | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as {
    rows?: unknown;
    nextRowId?: unknown;
    monthFilter?: unknown;
  };

  const rawRows = Array.isArray(payload.rows) ? payload.rows : [];
  const rows: UploadRow[] = rawRows
    .map((row): UploadRow | null => {
      if (!row || typeof row !== "object") {
        return null;
      }
      const candidate = row as Partial<PersistedDraftRow>;
      const id = Number(candidate.id);
      if (!Number.isFinite(id) || id <= 0) {
        return null;
      }
      return {
        id,
        date: typeof candidate.date === "string" ? candidate.date : "",
        time: typeof candidate.time === "string" ? candidate.time : "",
        venue: typeof candidate.venue === "string" ? candidate.venue : "",
        division: typeof candidate.division === "string" ? candidate.division : "",
        home_team: typeof candidate.home_team === "string" ? candidate.home_team : "",
        away_team: typeof candidate.away_team === "string" ? candidate.away_team : "",
        crew_chief: typeof candidate.crew_chief === "string" ? candidate.crew_chief : "",
        umpire_1: typeof candidate.umpire_1 === "string" ? candidate.umpire_1 : "",
        status: "READY",
        message: "",
        uploading: false,
        is_dirty: hasAnyRowInput({
          date: typeof candidate.date === "string" ? candidate.date : "",
          time: typeof candidate.time === "string" ? candidate.time : "",
          venue: typeof candidate.venue === "string" ? candidate.venue : "",
          division: typeof candidate.division === "string" ? candidate.division : "",
          home_team: typeof candidate.home_team === "string" ? candidate.home_team : "",
          away_team: typeof candidate.away_team === "string" ? candidate.away_team : "",
          crew_chief: typeof candidate.crew_chief === "string" ? candidate.crew_chief : "",
          umpire_1: typeof candidate.umpire_1 === "string" ? candidate.umpire_1 : "",
        }),
      };
    })
    .filter((row): row is UploadRow => Boolean(row));

  const safeRows = rows.length > 0 ? rows : [createEmptyRow(1)];
  const maxRowId = safeRows.reduce((maxId, row) => Math.max(maxId, row.id), 0);
  const rawNextRowId = Number(payload.nextRowId);
  const nextRowId =
    Number.isFinite(rawNextRowId) && rawNextRowId > maxRowId
      ? rawNextRowId
      : maxRowId + 1;

  const monthFilter =
    typeof payload.monthFilter === "string" && payload.monthFilter.trim()
      ? payload.monthFilter
      : null;

  return {
    rows: safeRows,
    nextRowId,
    monthFilter,
  };
}

function isRowComplete(row: SpreadsheetRowFields) {
  return Boolean(
    row.date &&
      row.time &&
      row.venue &&
      row.division &&
      row.home_team &&
      row.away_team
  );
}

function patchSpreadsheetRow<
  T extends SpreadsheetRowFields,
  K extends keyof SpreadsheetRowFields,
>(row: T, key: K, value: SpreadsheetRowFields[K]) {
  const nextRow = {
    ...row,
    [key]: value,
    ...(key === "division"
      ? {
          home_team: "",
          away_team: "",
        }
      : {}),
    ...(key === "home_team" &&
    typeof value === "string" &&
    value !== "" &&
    value === row.away_team
      ? { away_team: "" }
      : {}),
    ...(key === "away_team" &&
    typeof value === "string" &&
    value !== "" &&
    value === row.home_team
      ? { home_team: "" }
      : {}),
    ...(key === "date" || key === "time"
      ? {
          crew_chief: "",
          umpire_1: "",
        }
      : {}),
  } as T;

  if (key === "date") {
    const nextDate = typeof value === "string" ? value : "";
    const currentTime = normalizeTimeValue(nextRow.time);
    if (currentTime && !isAllowedGameTime(nextDate, currentTime)) {
      nextRow.time = "" as T["time"];
    }
  }

  return nextRow;
}

function getErrorMessage(error: unknown, fallback: string) {
  const maybe = error as {
    response?: { data?: Record<string, unknown> };
    message?: string;
  };

  const data = maybe?.response?.data;
  if (data && typeof data === "object") {
    const detail = data.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    const firstValue = Object.values(data)[0];
    if (typeof firstValue === "string" && firstValue.trim()) {
      return firstValue;
    }
    if (Array.isArray(firstValue) && typeof firstValue[0] === "string") {
      return firstValue[0];
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function buildExistingRowFromGame(game: UploadedGame): ExistingRow {
  const crewChiefAssignment = game.appointed_assignments?.find(
    (assignment) => assignment.role === "CREW_CHIEF"
  );
  const umpireOneAssignment = game.appointed_assignments?.find(
    (assignment) => assignment.role === "UMPIRE_1"
  );

  return {
    game_id: game.id,
    date: game.date || "",
    time: game.time ? game.time.slice(0, 5) : "",
    venue: game.venue ? String(game.venue) : "",
    division: game.division ? String(game.division) : "",
    home_team: game.home_team ? String(game.home_team) : "",
    away_team: game.away_team ? String(game.away_team) : "",
    crew_chief: crewChiefAssignment?.referee ? String(crewChiefAssignment.referee) : "",
    umpire_1: umpireOneAssignment?.referee ? String(umpireOneAssignment.referee) : "",
    status: "READY",
    message: "",
    saving: false,
    deleting: false,
    can_edit: game.can_edit,
    can_delete: game.can_delete,
    lock_reason:
      !game.can_edit || !game.can_delete
        ? "This game is locked and cannot be edited or deleted."
        : "",
    is_dirty: false,
  };
}

export default function BulkGameUpload({
  embedded = false,
  onUploaded,
}: BulkGameUploadProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isDoaOrNl = user?.account_type === "DOA" || user?.account_type === "NL";
  const gameType = user?.account_type === "NL" ? "NL" : "DOA";

  const [divisions, setDivisions] = useState<SimpleOption[]>([]);
  const [venues, setVenues] = useState<SimpleOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [referees, setReferees] = useState<RefereeOption[]>([]);
  const [refereesByDateTimeKey, setRefereesByDateTimeKey] = useState<
    Record<string, RefereeOption[]>
  >({});
  const [loadingRefereesByDateTimeKey, setLoadingRefereesByDateTimeKey] = useState<
    Record<string, boolean>
  >({});
  const [rows, setRows] = useState<UploadRow[]>([createEmptyRow(1)]);
  const [nextRowId, setNextRowId] = useState(2);
  const [existingRows, setExistingRows] = useState<ExistingRow[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pageSuccess, setPageSuccess] = useState("");
  const [savingAllChanges, setSavingAllChanges] = useState(false);
  const [monthFilter, setMonthFilter] = useState(getCurrentMonthKey());
  const [draftsHydrated, setDraftsHydrated] = useState(false);
  const [pendingDeleteExistingGameId, setPendingDeleteExistingGameId] = useState<number | null>(null);

  const appointedDivisionIds = useMemo(
    () =>
      new Set(
        divisions
          .filter((division) => Boolean(division.requires_appointed_referees))
          .map((division) => division.id)
      ),
    [divisions]
  );

  const appointedDivisions = useMemo(
    () => divisions.filter((division) => Boolean(division.requires_appointed_referees)),
    [divisions]
  );

  const selectableDivisions = useMemo(
    () => (appointedDivisions.length > 0 ? appointedDivisions : divisions),
    [appointedDivisions, divisions]
  );

  const teamById = useMemo(() => {
    const map = new Map<number, TeamOption>();
    teams.forEach((team) => map.set(team.id, team));
    return map;
  }, [teams]);

  const refereeById = useMemo(() => {
    const map = new Map<number, RefereeOption>();
    referees.forEach((referee) => map.set(referee.id, referee));
    return map;
  }, [referees]);

  const getAvailableRefereesForRow = useCallback(
    (row: Pick<SpreadsheetRowFields, "date" | "time">) => {
      const key = dateTimeKey(row.date, row.time);
      if (!key) {
        return [];
      }
      return refereesByDateTimeKey[key] || [];
    },
    [refereesByDateTimeKey]
  );

  const isLoadingRefereesForRow = useCallback(
    (row: Pick<SpreadsheetRowFields, "date" | "time">) => {
      const key = dateTimeKey(row.date, row.time);
      if (!key) {
        return false;
      }
      return Boolean(loadingRefereesByDateTimeKey[key]);
    },
    [loadingRefereesByDateTimeKey]
  );

  const getRefereeSelectOptions = useCallback(
    (
      row: Pick<SpreadsheetRowFields, "date" | "time">,
      selectedRefereeId: string
    ) => {
      const options = [...getAvailableRefereesForRow(row)];
      const selectedId = Number(selectedRefereeId);
      if (!selectedId) {
        return options;
      }

      if (options.some((option) => option.id === selectedId)) {
        return options;
      }

      const selectedReferee = refereeById.get(selectedId);
      if (!selectedReferee) {
        return options;
      }

      return [
        ...options,
        {
          ...selectedReferee,
          label: `${selectedReferee.label} (Unavailable)`,
        },
      ];
    },
    [getAvailableRefereesForRow, refereeById]
  );

  const sortedUploadedGames = useCallback(
    (uploads: UploadedGame[]) =>
      [...uploads]
        .filter((game) => game.game_type === gameType)
        .sort((a, b) =>
          `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
        ),
    [gameType]
  );

  const monthOptions = useMemo(() => {
    const uniqueMonths = new Set<string>();

    existingRows.forEach((row) => {
      const month = toMonthKey(row.date);
      if (month) {
        uniqueMonths.add(month);
      }
    });

    rows.forEach((row) => {
      const month = toMonthKey(row.date);
      if (month) {
        uniqueMonths.add(month);
      }
    });

    uniqueMonths.add(getCurrentMonthKey());

    if (monthFilter !== MONTH_FILTER_ALL) {
      uniqueMonths.add(monthFilter);
    }

    return Array.from(uniqueMonths).sort((a, b) => b.localeCompare(a));
  }, [existingRows, monthFilter, rows]);

  const filteredExistingRows = useMemo(() => {
    if (monthFilter === MONTH_FILTER_ALL) {
      return existingRows;
    }
    return existingRows.filter((row) => toMonthKey(row.date) === monthFilter);
  }, [existingRows, monthFilter]);

  const filteredDraftRows = useMemo(() => {
    if (monthFilter === MONTH_FILTER_ALL) {
      return rows;
    }
    return rows.filter((row) => {
      const rowMonth = toMonthKey(row.date);
      return !rowMonth || rowMonth === monthFilter;
    });
  }, [monthFilter, rows]);

  const dirtyExistingRows = useMemo(
    () => existingRows.filter((row) => row.is_dirty),
    [existingRows]
  );
  const dirtyDraftRows = useMemo(
    () => rows.filter((row) => row.is_dirty),
    [rows]
  );
  const pendingSaveCount = dirtyExistingRows.length + dirtyDraftRows.length;
  const pendingDeleteExistingRow =
    pendingDeleteExistingGameId === null
      ? null
      : existingRows.find((row) => row.game_id === pendingDeleteExistingGameId) || null;

  useEffect(() => {
    async function loadInitialData() {
      if (!isDoaOrNl) {
        setLoadingOptions(false);
        setLoadingExisting(false);
        return;
      }

      try {
        setLoadingOptions(true);
        setLoadingExisting(true);
        setPageError("");
        setRefereesByDateTimeKey({});
        setLoadingRefereesByDateTimeKey({});

        const [options, refereeOptions, uploads] = await Promise.all([
          getUploadGameFormOptions(),
          getRefereeOptions(),
          getMyUploadedGames(),
        ]);

        setDivisions(options.divisions);
        setVenues(options.venues);
        setTeams(options.teams);
        setReferees(refereeOptions);
        setExistingRows(sortedUploadedGames(uploads).map(buildExistingRowFromGame));
      } catch (error) {
        const message = getErrorMessage(
          error,
          "Failed to load upload options. Please try again."
        );
        setPageError(message);
        showToast(message, "error");
      } finally {
        setLoadingOptions(false);
        setLoadingExisting(false);
      }
    }

    loadInitialData();
  }, [isDoaOrNl, showToast, sortedUploadedGames]);

  useEffect(() => {
    if (!isDoaOrNl || !user?.id || typeof window === "undefined") {
      return;
    }

    // Restore unsaved spreadsheet edits per user/account for continuity across sessions.
    setDraftsHydrated(false);
    const storageKey = getDraftStorageKey(user.id, user.account_type);
    if (!storageKey) {
      setDraftsHydrated(true);
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(storageKey);
      if (!rawValue) {
        setRows([createEmptyRow(1)]);
        setNextRowId(2);
        setMonthFilter(getCurrentMonthKey());
        return;
      }

      const parsed = JSON.parse(rawValue) as unknown;
      const sanitized = sanitizePersistedDraftRows(parsed);
      if (!sanitized) {
        setRows([createEmptyRow(1)]);
        setNextRowId(2);
        setMonthFilter(getCurrentMonthKey());
        return;
      }

      setRows(sanitized.rows);
      setNextRowId(sanitized.nextRowId);

      if (sanitized.monthFilter) {
        setMonthFilter(sanitized.monthFilter);
      }
    } catch {
      setRows([createEmptyRow(1)]);
      setNextRowId(2);
      setMonthFilter(getCurrentMonthKey());
    }
    setDraftsHydrated(true);
  }, [isDoaOrNl, user?.account_type, user?.id]);

  useEffect(() => {
    if (!isDoaOrNl || !user?.id || typeof window === "undefined" || !draftsHydrated) {
      return;
    }

    // Persist row drafts + selected month so monthly assignment workflows are resilient.
    const storageKey = getDraftStorageKey(user.id, user.account_type);
    if (!storageKey) {
      return;
    }

    const persistedRows = rows.map<PersistedDraftRow>((row) => ({
      id: row.id,
      date: row.date,
      time: row.time,
      venue: row.venue,
      division: row.division,
      home_team: row.home_team,
      away_team: row.away_team,
      crew_chief: row.crew_chief,
      umpire_1: row.umpire_1,
    }));

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          rows: persistedRows,
          nextRowId,
          monthFilter,
          savedAt: new Date().toISOString(),
        })
      );
    } catch {
      // Ignore local storage failures (private mode/quota).
    }
  }, [draftsHydrated, isDoaOrNl, monthFilter, nextRowId, rows, user?.account_type, user?.id]);

  useEffect(() => {
    if (monthFilter === MONTH_FILTER_ALL) {
      return;
    }
    if (!monthOptions.includes(monthFilter)) {
      setMonthFilter(getCurrentMonthKey());
    }
  }, [monthFilter, monthOptions]);

  useEffect(() => {
    if (!isDoaOrNl || loadingOptions) {
      return;
    }

    const requestedDateTimes = new Map<string, { date: string; time: string }>();
    const collect = (row: Pick<SpreadsheetRowFields, "date" | "time">) => {
      const normalizedTime = normalizeTimeValue(row.time);
      const key = dateTimeKey(row.date, normalizedTime);
      if (!key || requestedDateTimes.has(key)) {
        return;
      }
      requestedDateTimes.set(key, { date: row.date, time: normalizedTime });
    };

    rows.forEach(collect);
    existingRows.forEach(collect);

    requestedDateTimes.forEach(({ date, time }, key) => {
      if (refereesByDateTimeKey[key] || loadingRefereesByDateTimeKey[key]) {
        return;
      }

      setLoadingRefereesByDateTimeKey((prev) => ({ ...prev, [key]: true }));

      void getRefereeOptions({
        game_date: date,
        game_time: time,
      })
        .then((availableReferees) => {
          setRefereesByDateTimeKey((prev) => ({ ...prev, [key]: availableReferees }));
        })
        .catch((error) => {
          const message = getErrorMessage(error, "Failed to load referee availability.");
          setPageError((prev) => prev || message);
          showToast(message, "error");
          setRefereesByDateTimeKey((prev) => ({ ...prev, [key]: [] }));
        })
        .finally(() => {
          setLoadingRefereesByDateTimeKey((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        });
    });
  }, [
    existingRows,
    isDoaOrNl,
    loadingOptions,
    loadingRefereesByDateTimeKey,
    refereesByDateTimeKey,
    rows,
  ]);

  const validateSpreadsheetRow = useCallback(
    (row: SpreadsheetRowFields): SpreadsheetValidationResult => {
      if (
        !row.date ||
        !row.time ||
        !row.venue ||
        !row.division ||
        !row.home_team ||
        !row.away_team
      ) {
        return {
          error:
            "Please complete Date, Time, Venue, Division, Home Team, and Away Team.",
        };
      }

      if (row.home_team === row.away_team) {
        return { error: "Home Team and Away Team must be different." };
      }

      const normalizedTime = normalizeTimeValue(row.time);
      if (!isAllowedGameTime(row.date, normalizedTime)) {
        return {
          error:
            "Appointed game time is outside allowed hours. Weekdays: 19:00-22:00, weekends: 10:00-22:00.",
        };
      }

      const selectedDivisionId = Number(row.division);
      if (!selectedDivisionId) {
        return { error: "Please select a valid division." };
      }

      if (appointedDivisionIds.size > 0 && !appointedDivisionIds.has(selectedDivisionId)) {
        return { error: "Selected division is not configured for appointed games." };
      }

      const venueId = Number(row.venue);
      if (!venueId || !venues.some((venue) => venue.id === venueId)) {
        return { error: "Please choose a valid venue." };
      }

      const homeTeam = teamById.get(Number(row.home_team));
      const awayTeam = teamById.get(Number(row.away_team));
      if (!homeTeam || !awayTeam || !homeTeam.division_id || !awayTeam.division_id) {
        return { error: "Invalid team selection. Please choose teams again." };
      }

      if (homeTeam.division_id !== awayTeam.division_id) {
        return { error: "Home and Away teams must be from the same division." };
      }

      if (
        homeTeam.division_id !== selectedDivisionId ||
        awayTeam.division_id !== selectedDivisionId
      ) {
        return { error: "Selected teams must match the chosen division." };
      }

      if (row.crew_chief && row.umpire_1 && row.crew_chief === row.umpire_1) {
        return { error: "Crew Chief and Umpire 1 must be different referees." };
      }

      const availabilityKey = dateTimeKey(row.date, normalizedTime);
      const selectedReferees = Boolean(row.crew_chief || row.umpire_1);
      const availableReferees = availabilityKey
        ? refereesByDateTimeKey[availabilityKey]
        : undefined;
      const availableRefereeById = new Map<number, RefereeOption>();
      (availableReferees || []).forEach((referee) => {
        availableRefereeById.set(referee.id, referee);
      });

      if (selectedReferees && availabilityKey && !availableReferees) {
        return {
          error:
            "Loading referee availability for this date/time. Please wait a moment and try again.",
        };
      }

      const appointedAssignments: Array<{ role: RoleValue; referee: number }> = [];

      if (row.crew_chief) {
        const crewChiefId = Number(row.crew_chief);
        if (!crewChiefId || !availableRefereeById.has(crewChiefId)) {
          return { error: "Selected Crew Chief is not available at the chosen date/time." };
        }
        appointedAssignments.push({
          role: "CREW_CHIEF",
          referee: crewChiefId,
        });
      }

      if (row.umpire_1) {
        const umpireId = Number(row.umpire_1);
        if (!umpireId || !availableRefereeById.has(umpireId)) {
          return { error: "Selected Umpire 1 is not available at the chosen date/time." };
        }
        appointedAssignments.push({
          role: "UMPIRE_1",
          referee: umpireId,
        });
      }

      return {
        selectedDivisionId,
        venueId,
        homeTeamId: Number(row.home_team),
        awayTeamId: Number(row.away_team),
        appointedAssignments,
      };
    },
    [appointedDivisionIds, refereesByDateTimeKey, teamById, venues]
  );

  const handleRowChange = <K extends keyof SpreadsheetRowFields>(
    rowId: number,
    key: K,
    value: SpreadsheetRowFields[K]
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? (() => {
              const nextRow = patchSpreadsheetRow(row, key, value);
              return {
                ...nextRow,
                status: "READY",
                message: "",
                uploading: false,
                is_dirty: hasAnyRowInput(nextRow),
              };
            })()
          : row
      )
    );
    setPageError("");
    setPageSuccess("");
  };

  const handleExistingRowChange = <K extends keyof SpreadsheetRowFields>(
    gameId: number,
    key: K,
    value: SpreadsheetRowFields[K]
  ) => {
    setExistingRows((prev) =>
      prev.map((row) =>
        row.game_id === gameId
            ? {
              ...patchSpreadsheetRow(row, key, value),
              status: "READY",
              message: "",
              is_dirty: true,
            }
          : row
      )
    );
    setPageError("");
    setPageSuccess("");
  };

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow(nextRowId)]);
    setNextRowId((prev) => prev + 1);
  };

  const removeRow = (rowId: number) => {
    setRows((prev) => {
      if (prev.length === 1) {
        return [createEmptyRow(rowId)];
      }
      return prev.filter((row) => row.id !== rowId);
    });
    setPageError("");
    setPageSuccess("");
  };

  const getTeamsForDivision = (divisionId: string) => {
    const parsedDivisionId = Number(divisionId);
    if (!parsedDivisionId) {
      return [];
    }
    return teams.filter((team) => team.division_id === parsedDivisionId);
  };

  const getTeamOptionsForRow = (
    row: Pick<SpreadsheetRowFields, "division" | "home_team" | "away_team">,
    field: "home_team" | "away_team"
  ) => {
    const divisionTeams = getTeamsForDivision(row.division);
    const oppositeTeamId = Number(
      field === "home_team" ? row.away_team : row.home_team
    );

    if (!oppositeTeamId) {
      return divisionTeams;
    }

    return divisionTeams.filter((team) => team.id !== oppositeTeamId);
  };

  const handleSaveAllRows = async () => {
    if (!user?.uploads_approved || loadingOptions || savingAllChanges) {
      return;
    }

    const targetExistingRows = existingRows.filter((row) => row.is_dirty);
    const targetDraftRows = rows.filter((row) => row.is_dirty && hasAnyRowInput(row));

    if (targetExistingRows.length === 0 && targetDraftRows.length === 0) {
      setPageError("");
      setPageSuccess("No edited rows to save.");
      return;
    }

    const existingErrors = new Map<number, string>();
    const draftErrors = new Map<number, string>();
    const existingPayloads: Array<{ gameId: number; payload: ManageUploadedGamePayload }> = [];
    const draftPayloads: Array<{
      row: UploadRow;
      payload: Parameters<typeof uploadAppointedGame>[0];
    }> = [];

    targetExistingRows.forEach((row) => {
      if (!row.can_edit) {
        existingErrors.set(
          row.game_id,
          row.lock_reason || "This row cannot be edited."
        );
        return;
      }

      const validation = validateSpreadsheetRow(row);
      if ("error" in validation) {
        existingErrors.set(row.game_id, validation.error);
        return;
      }

      existingPayloads.push({
        gameId: row.game_id,
        payload: {
          game_type: gameType,
          payment_type: "CLAIM",
          division: validation.selectedDivisionId,
          date: row.date,
          time: row.time,
          venue: validation.venueId,
          home_team: validation.homeTeamId,
          away_team: validation.awayTeamId,
          appointed_assignments: validation.appointedAssignments,
        },
      });
    });

    targetDraftRows.forEach((row) => {
      if (!isRowComplete(row)) {
        draftErrors.set(
          row.id,
          "Please complete Date, Time, Venue, Division, Home Team, and Away Team."
        );
        return;
      }

      const validation = validateSpreadsheetRow(row);
      if ("error" in validation) {
        draftErrors.set(row.id, validation.error);
        return;
      }

      draftPayloads.push({
        row,
        payload: {
          game_type: gameType,
          payment_type: "CLAIM",
          division: validation.selectedDivisionId,
          date: row.date,
          time: row.time,
          venue: validation.venueId,
          home_team: validation.homeTeamId,
          away_team: validation.awayTeamId,
          appointed_assignments: validation.appointedAssignments,
        },
      });
    });

    if (existingErrors.size > 0 || draftErrors.size > 0) {
      const validationFailures = [
        ...Array.from(existingErrors.entries()).map(
          ([gameId, message]) => `Game ${gameId}: ${message}`
        ),
        ...Array.from(draftErrors.entries()).map(
          ([rowId, message]) => `Draft row ${rowId}: ${message}`
        ),
      ];
      const validationPreview = validationFailures.slice(0, 3).join(" | ");

      setExistingRows((prev) =>
        prev.map((row) => {
          const message = existingErrors.get(row.game_id);
          if (!message) {
            return row;
          }
          return {
            ...row,
            status: "ERROR",
            message,
            saving: false,
          };
        })
      );
      setRows((prev) =>
        prev.map((row) => {
          const message = draftErrors.get(row.id);
          if (!message) {
            return row;
          }
          return {
            ...row,
            status: "ERROR",
            message,
            uploading: false,
          };
        })
      );
      setPageSuccess("");
      setPageError(
        validationFailures.length > 3
          ? `${validationPreview} | +${validationFailures.length - 3} more error(s).`
          : validationPreview
      );
      showToast("Some rows contain validation errors. Check row messages.", "error");
      return;
    }

    const existingIds = new Set(existingPayloads.map((item) => item.gameId));
    const draftIds = new Set(draftPayloads.map((item) => item.row.id));

    setSavingAllChanges(true);
    setPageError("");
    setPageSuccess("");

    setExistingRows((prev) =>
      prev.map((row) =>
        existingIds.has(row.game_id)
          ? {
              ...row,
              saving: true,
              status: "UPLOADING",
              message: "",
            }
          : row
      )
    );

    setRows((prev) =>
      prev.map((row) =>
        draftIds.has(row.id)
          ? {
              ...row,
              uploading: true,
              status: "UPLOADING",
              message: "",
            }
          : row
      )
    );

    let successCount = 0;
    const failures: string[] = [];

    for (const item of existingPayloads) {
      try {
        const updatedGame = await updateUploadedGame(item.gameId, item.payload);
        const updatedRow = buildExistingRowFromGame(updatedGame);
        setExistingRows((prev) =>
          prev.map((row) => (row.game_id === item.gameId ? updatedRow : row))
        );
        successCount += 1;
      } catch (error) {
        const message = getErrorMessage(error, "Failed to save row.");
        failures.push(`Game ${item.gameId}: ${message}`);
        setExistingRows((prev) =>
          prev.map((row) =>
            row.game_id === item.gameId
              ? {
                  ...row,
                  saving: false,
                  status: "ERROR",
                  message,
                }
              : row
          )
        );
      }
    }

    for (const item of draftPayloads) {
      try {
        const createdGame = (await uploadAppointedGame(item.payload)) as
          | { id?: number }
          | undefined;
        const createdGameId = Number(createdGame?.id);

        setRows((prev) =>
          prev.map((row) => (row.id === item.row.id ? createEmptyRow(row.id) : row))
        );

        if (Number.isFinite(createdGameId) && createdGameId > 0) {
          const newExistingRow: ExistingRow = {
            game_id: createdGameId,
            date: item.row.date,
            time: item.row.time,
            venue: item.row.venue,
            division: item.row.division,
            home_team: item.row.home_team,
            away_team: item.row.away_team,
            crew_chief: item.row.crew_chief,
            umpire_1: item.row.umpire_1,
            status: "READY",
            message: "",
            saving: false,
            deleting: false,
            can_edit: true,
            can_delete: true,
            lock_reason: "",
            is_dirty: false,
          };
          setExistingRows((prev) =>
            sortExistingSpreadsheetRows([
              ...prev.filter((row) => row.game_id !== createdGameId),
              newExistingRow,
            ])
          );
        }
        successCount += 1;
      } catch (error) {
        const message = getErrorMessage(error, "Failed to upload row.");
        failures.push(`Draft row ${item.row.id}: ${message}`);
        setRows((prev) =>
          prev.map((row) =>
            row.id === item.row.id
              ? {
                  ...row,
                  uploading: false,
                  status: "ERROR",
                  message,
                }
              : row
          )
        );
      }
    }

    if (successCount > 0) {
      onUploaded?.();
      setPageSuccess(
        `Saved ${successCount} row${successCount === 1 ? "" : "s"} successfully.`
      );
      showToast(
        `Saved ${successCount} row${successCount === 1 ? "" : "s"} successfully.`,
        "success"
      );
    }

    if (failures.length > 0) {
      const preview = failures.slice(0, 3).join(" | ");
      setPageError(
        failures.length > 3
          ? `${preview} | +${failures.length - 3} more error(s).`
          : preview
      );
      showToast("Some rows failed to save. Check row messages.", "error");
    }

    if (successCount === 0 && failures.length === 0) {
      setPageSuccess("No edited rows to save.");
    }

    setSavingAllChanges(false);
  };

  const handleDeleteExistingRow = async (gameId: number) => {
    const row = existingRows.find((item) => item.game_id === gameId);
    if (!row) {
      return;
    }

    if (!row.can_delete) {
      setExistingRows((prev) =>
        prev.map((item) =>
          item.game_id === gameId
            ? {
                ...item,
                status: "ERROR",
                message: item.lock_reason || "This row cannot be deleted.",
              }
            : item
        )
      );
      return;
    }

    setPendingDeleteExistingGameId(gameId);
  };

  const confirmDeleteExistingRow = async () => {
    if (pendingDeleteExistingGameId === null) {
      return;
    }
    const gameId = pendingDeleteExistingGameId;

    setExistingRows((prev) =>
      prev.map((item) =>
        item.game_id === gameId
          ? {
              ...item,
              deleting: true,
              message: "",
            }
          : item
      )
    );

    try {
      await deleteUploadedGame(gameId);
      setExistingRows((prev) => prev.filter((item) => item.game_id !== gameId));
      setPageSuccess("Uploaded game deleted.");
      showToast("Uploaded game deleted.", "success");
      setPendingDeleteExistingGameId(null);
      onUploaded?.();
    } catch (error) {
      const message = getErrorMessage(error, "Failed to delete row.");
      setExistingRows((prev) =>
        prev.map((item) =>
          item.game_id === gameId
            ? {
                ...item,
                deleting: false,
                status: "ERROR",
                message,
              }
            : item
        )
      );
      showToast(message, "error");
    }
  };

  if (!isDoaOrNl) {
    if (embedded) {
      return null;
    }
    return (
      <div className="bulk-upload-page">
        <div className="bulk-upload-header">
          <h1 className="page-title-with-icon">
            <AppIcon name="upload" className="page-title-icon" />
            <span>Upload Games</span>
          </h1>
          <p>Bulk upload is currently available for DOA/NL accounts only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bulk-upload-page ${embedded ? "bulk-upload-page-embedded" : ""}`.trim()}>
      {!embedded && (
        <div className="bulk-upload-header">
          <h1 className="page-title-with-icon">
            <AppIcon name="upload" className="page-title-icon" />
            <span>Upload Games</span>
          </h1>
          <p>
            Add multiple {gameType === "NL" ? "NL" : "DOA"} games in one go. Each row is one game.
          </p>
        </div>
      )}

      {!user?.uploads_approved && (
        <p className="bulk-upload-message bulk-upload-error">
          Your account is pending upload approval.
        </p>
      )}
      {pageError && <p className="bulk-upload-message bulk-upload-error">{pageError}</p>}
      {pageSuccess && <p className="bulk-upload-message bulk-upload-success">{pageSuccess}</p>}

      <section className="bulk-upload-card">
        <div className="bulk-upload-actions-top">
          <label className="bulk-upload-month-filter">
            <span className="inline-icon-label">
              <AppIcon name="calendar" />
              <span>Month</span>
            </span>
            <select
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
            >
              <option value={MONTH_FILTER_ALL}>All Months</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="upload-all-btn"
            disabled={
              savingAllChanges ||
              loadingOptions ||
              !user?.uploads_approved ||
              pendingSaveCount === 0
            }
            onClick={handleSaveAllRows}
          >
            <span className="button-with-icon">
              <AppIcon name="upload" />
              <span>
                {savingAllChanges
                  ? "Saving..."
                  : pendingSaveCount > 0
                    ? `Save All (${pendingSaveCount})`
                    : "Save All"}
              </span>
            </span>
          </button>
          <button type="button" onClick={addRow} disabled={savingAllChanges}>
            <span className="button-with-icon">
              <AppIcon name="plus" />
              <span>Add Row</span>
            </span>
          </button>
        </div>

        {loadingOptions ? (
          <p className="bulk-upload-empty">Loading upload options...</p>
        ) : (
          <div className="bulk-upload-table-wrap">
            <table className="bulk-upload-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Venue</th>
                  <th>Division</th>
                  <th>Home Team</th>
                  <th>Away Team</th>
                  <th>Crew Chief</th>
                  <th>Umpire 1</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loadingExisting &&
                  filteredExistingRows.map((row) => (
                    <tr key={row.game_id} className={`row-${row.status.toLowerCase()}`}>
                      <td>
                        <input
                          type="date"
                          value={row.date}
                          disabled={
                            savingAllChanges || !row.can_edit || row.saving || row.deleting
                          }
                          onChange={(event) =>
                            handleExistingRowChange(row.game_id, "date", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={normalizeTimeValue(row.time)}
                          disabled={
                            savingAllChanges ||
                            !row.can_edit ||
                            row.saving ||
                            row.deleting ||
                            !row.date
                          }
                          onChange={(event) =>
                            handleExistingRowChange(row.game_id, "time", event.target.value)
                          }
                        >
                          <option value="">{row.date ? "Select" : "Select date"}</option>
                          {buildAllowedTimeOptions(row.date).map((timeOption) => (
                            <option key={`${row.game_id}-time-${timeOption}`} value={timeOption}>
                              {timeOption}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.venue}
                          disabled={
                            savingAllChanges || !row.can_edit || row.saving || row.deleting
                          }
                          onChange={(event) =>
                            handleExistingRowChange(row.game_id, "venue", event.target.value)
                          }
                        >
                          <option value="">Select</option>
                          {venues.map((venue) => (
                            <option key={venue.id} value={venue.id}>
                              {venue.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.division}
                          disabled={
                            savingAllChanges || !row.can_edit || row.saving || row.deleting
                          }
                          onChange={(event) =>
                            handleExistingRowChange(row.game_id, "division", event.target.value)
                          }
                        >
                          <option value="">Select</option>
                          {selectableDivisions.map((division) => (
                            <option key={division.id} value={division.id}>
                              {division.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.home_team}
                          disabled={
                            savingAllChanges ||
                            !row.can_edit ||
                            row.saving ||
                            row.deleting ||
                            !row.division
                          }
                          onChange={(event) =>
                            handleExistingRowChange(row.game_id, "home_team", event.target.value)
                          }
                        >
                          <option value="">Select</option>
                          {getTeamOptionsForRow(row, "home_team").map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.club_name || team.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.away_team}
                          disabled={
                            savingAllChanges ||
                            !row.can_edit ||
                            row.saving ||
                            row.deleting ||
                            !row.division
                          }
                          onChange={(event) =>
                            handleExistingRowChange(row.game_id, "away_team", event.target.value)
                          }
                        >
                          <option value="">Select</option>
                          {getTeamOptionsForRow(row, "away_team").map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.club_name || team.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.crew_chief}
                          disabled={
                            savingAllChanges ||
                            !row.can_edit ||
                            row.saving ||
                            row.deleting ||
                            !row.date ||
                            !row.time ||
                            isLoadingRefereesForRow(row)
                          }
                          onChange={(event) =>
                            handleExistingRowChange(row.game_id, "crew_chief", event.target.value)
                          }
                        >
                          <option value="">
                            {isLoadingRefereesForRow(row) ? "Loading..." : "Unassigned"}
                          </option>
                          {getRefereeSelectOptions(row, row.crew_chief).map((referee) => (
                            <option key={referee.id} value={referee.id}>
                              {referee.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.umpire_1}
                          disabled={
                            savingAllChanges ||
                            !row.can_edit ||
                            row.saving ||
                            row.deleting ||
                            !row.date ||
                            !row.time ||
                            isLoadingRefereesForRow(row)
                          }
                          onChange={(event) =>
                            handleExistingRowChange(row.game_id, "umpire_1", event.target.value)
                          }
                        >
                          <option value="">
                            {isLoadingRefereesForRow(row) ? "Loading..." : "Unassigned"}
                          </option>
                          {getRefereeSelectOptions(row, row.umpire_1).map((referee) => (
                            <option key={referee.id} value={referee.id}>
                              {referee.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="bulk-upload-row-actions">
                          <button
                            type="button"
                            className="row-remove-btn"
                            disabled={
                              !row.can_delete || row.saving || row.deleting || savingAllChanges
                            }
                            onClick={() => handleDeleteExistingRow(row.game_id)}
                            title={!row.can_delete ? row.lock_reason || "Cannot delete row." : ""}
                          >
                            {row.deleting ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
                {filteredDraftRows.map((row) => (
                  <tr key={row.id} className={`row-${row.status.toLowerCase()}`}>
                    <td>
                      <input
                        type="date"
                        value={row.date}
                        disabled={row.uploading || savingAllChanges}
                        onChange={(event) =>
                          handleRowChange(row.id, "date", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={normalizeTimeValue(row.time)}
                        disabled={row.uploading || savingAllChanges || !row.date}
                        onChange={(event) =>
                          handleRowChange(row.id, "time", event.target.value)
                        }
                      >
                        <option value="">{row.date ? "Select" : "Select date"}</option>
                        {buildAllowedTimeOptions(row.date).map((timeOption) => (
                          <option key={`${row.id}-time-${timeOption}`} value={timeOption}>
                            {timeOption}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.venue}
                        disabled={row.uploading || savingAllChanges}
                        onChange={(event) =>
                          handleRowChange(row.id, "venue", event.target.value)
                        }
                      >
                        <option value="">Select</option>
                        {venues.map((venue) => (
                          <option key={venue.id} value={venue.id}>
                            {venue.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.division}
                        disabled={row.uploading || savingAllChanges}
                        onChange={(event) =>
                          handleRowChange(row.id, "division", event.target.value)
                        }
                      >
                        <option value="">Select</option>
                        {selectableDivisions.map((division) => (
                          <option key={division.id} value={division.id}>
                            {division.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.home_team}
                        disabled={row.uploading || savingAllChanges || !row.division}
                        onChange={(event) =>
                          handleRowChange(row.id, "home_team", event.target.value)
                        }
                      >
                        <option value="">Select</option>
                        {getTeamOptionsForRow(row, "home_team").map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.club_name || team.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.away_team}
                        disabled={row.uploading || savingAllChanges || !row.division}
                        onChange={(event) =>
                          handleRowChange(row.id, "away_team", event.target.value)
                        }
                      >
                        <option value="">Select</option>
                        {getTeamOptionsForRow(row, "away_team").map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.club_name || team.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.crew_chief}
                        disabled={
                          row.uploading ||
                          savingAllChanges ||
                          !row.date ||
                          !row.time ||
                          isLoadingRefereesForRow(row)
                        }
                        onChange={(event) =>
                          handleRowChange(row.id, "crew_chief", event.target.value)
                        }
                      >
                        <option value="">
                          {isLoadingRefereesForRow(row) ? "Loading..." : "Unassigned"}
                        </option>
                        {getRefereeSelectOptions(row, row.crew_chief).map((referee) => (
                          <option key={referee.id} value={referee.id}>
                            {referee.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.umpire_1}
                        disabled={
                          row.uploading ||
                          savingAllChanges ||
                          !row.date ||
                          !row.time ||
                          isLoadingRefereesForRow(row)
                        }
                        onChange={(event) =>
                          handleRowChange(row.id, "umpire_1", event.target.value)
                        }
                      >
                        <option value="">
                          {isLoadingRefereesForRow(row) ? "Loading..." : "Unassigned"}
                        </option>
                        {getRefereeSelectOptions(row, row.umpire_1).map((referee) => (
                          <option key={referee.id} value={referee.id}>
                            {referee.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="row-remove-btn"
                        disabled={row.uploading || savingAllChanges}
                        onClick={() => removeRow(row.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {!loadingExisting &&
                  filteredExistingRows.length === 0 &&
                  filteredDraftRows.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <p className="bulk-upload-empty-inline">
                          No uploaded or draft games for this month.
                        </p>
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        )}

      </section>

      <ConfirmDialog
        open={pendingDeleteExistingGameId !== null}
        title="Delete Uploaded Game"
        message={
          pendingDeleteExistingRow
            ? `Delete ${pendingDeleteExistingRow.date} ${normalizeTimeValue(
                pendingDeleteExistingRow.time
              )} game entry? This action cannot be undone.`
            : "Delete this uploaded game row? This action cannot be undone."
        }
        confirmLabel="Delete Row"
        cancelLabel="Keep Row"
        confirmTone="danger"
        busy={
          pendingDeleteExistingGameId !== null &&
          existingRows.some(
            (row) => row.game_id === pendingDeleteExistingGameId && row.deleting
          )
        }
        onCancel={() => setPendingDeleteExistingGameId(null)}
        onConfirm={() => {
          void confirmDeleteExistingRow();
        }}
      />
    </div>
  );
}
