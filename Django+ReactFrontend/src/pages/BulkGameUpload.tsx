import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
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
import "../pages_css/BulkGameUpload.css";

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
};

type ExistingRow = SpreadsheetRowFields & {
  game_id: number;
  notes: string;
  original_post_text: string;
  status: RowStatus;
  message: string;
  saving: boolean;
  deleting: boolean;
  can_edit: boolean;
  can_delete: boolean;
  lock_reason: string;
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
  };
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
    notes: game.notes || "",
    original_post_text: game.original_post_text || "",
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
  };
}

export default function BulkGameUpload({
  embedded = false,
  onUploaded,
}: BulkGameUploadProps) {
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
  const [monthFilter, setMonthFilter] = useState(getCurrentMonthKey());
  const [draftsHydrated, setDraftsHydrated] = useState(false);

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

  const reloadUploadedSpreadsheet = useCallback(async () => {
    if (!isDoaOrNl) {
      setExistingRows([]);
      setLoadingExisting(false);
      return;
    }

    setLoadingExisting(true);
    try {
      const uploads = await getMyUploadedGames();
      const nextRows = sortedUploadedGames(uploads).map(buildExistingRowFromGame);
      setExistingRows(nextRows);
    } catch (error) {
      setPageError(
        getErrorMessage(error, "Failed to load uploaded games. Please try again.")
      );
    } finally {
      setLoadingExisting(false);
    }
  }, [isDoaOrNl, sortedUploadedGames]);

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
        setPageError(
          getErrorMessage(error, "Failed to load upload options. Please try again.")
        );
      } finally {
        setLoadingOptions(false);
        setLoadingExisting(false);
      }
    }

    loadInitialData();
  }, [isDoaOrNl, sortedUploadedGames]);

  useEffect(() => {
    if (!isDoaOrNl || !user?.id || typeof window === "undefined") {
      return;
    }

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
          setPageError((prev) =>
            prev || getErrorMessage(error, "Failed to load referee availability.")
          );
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
          ? {
              ...patchSpreadsheetRow(row, key, value),
              status: "READY",
              message: "",
              uploading: false,
            }
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

  const uploadDraftRow = useCallback(
    async (row: UploadRow, validation: SpreadsheetValidationSuccess) => {
      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                uploading: true,
                status: "UPLOADING",
                message: "Uploading...",
              }
            : item
        )
      );

      try {
        await uploadAppointedGame({
          game_type: gameType,
          payment_type: "CLAIM",
          division: validation.selectedDivisionId,
          date: row.date,
          time: row.time,
          venue: validation.venueId,
          home_team: validation.homeTeamId,
          away_team: validation.awayTeamId,
          notes: "",
          original_post_text: "",
          appointed_assignments: validation.appointedAssignments,
        });

        setRows((prev) =>
          prev.map((item) => (item.id === row.id ? createEmptyRow(item.id) : item))
        );
        setPageError("");
        setPageSuccess("Game uploaded.");
        await reloadUploadedSpreadsheet();
        onUploaded?.();
      } catch (error) {
        setRows((prev) =>
          prev.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  uploading: false,
                  status: "ERROR",
                  message: getErrorMessage(error, "Upload failed."),
                }
              : item
          )
        );
      }
    },
    [gameType, onUploaded, reloadUploadedSpreadsheet]
  );

  useEffect(() => {
    if (!user?.uploads_approved || loadingOptions) {
      return;
    }

    const candidate = rows.find(
      (row) => row.status === "READY" && !row.uploading && isRowComplete(row)
    );
    if (!candidate) {
      return;
    }

    const validation = validateSpreadsheetRow(candidate);
    if ("error" in validation) {
      setRows((prev) =>
        prev.map((item) =>
          item.id === candidate.id
            ? {
                ...item,
                status: "ERROR",
                message: validation.error,
                uploading: false,
              }
            : item
        )
      );
      return;
    }

    void uploadDraftRow(candidate, validation);
  }, [loadingOptions, rows, uploadDraftRow, user?.uploads_approved, validateSpreadsheetRow]);

  const handleSaveExistingRow = async (gameId: number) => {
    const row = existingRows.find((item) => item.game_id === gameId);
    if (!row) {
      return;
    }

    if (!row.can_edit) {
      setExistingRows((prev) =>
        prev.map((item) =>
          item.game_id === gameId
            ? {
                ...item,
                status: "ERROR",
                message: item.lock_reason || "This row cannot be edited.",
              }
            : item
        )
      );
      return;
    }

    const validation = validateSpreadsheetRow(row);
    if ("error" in validation) {
      setExistingRows((prev) =>
        prev.map((item) =>
          item.game_id === gameId
            ? {
                ...item,
                status: "ERROR",
                message: validation.error,
              }
            : item
        )
      );
      return;
    }

    setExistingRows((prev) =>
      prev.map((item) =>
        item.game_id === gameId
          ? {
              ...item,
              saving: true,
              status: "READY",
              message: "",
            }
          : item
      )
    );

    try {
      const payload: ManageUploadedGamePayload = {
        game_type: gameType,
        payment_type: "CLAIM",
        division: validation.selectedDivisionId,
        date: row.date,
        time: row.time,
        venue: validation.venueId,
        home_team: validation.homeTeamId,
        away_team: validation.awayTeamId,
        notes: row.notes,
        original_post_text: row.original_post_text,
        appointed_assignments: validation.appointedAssignments,
      };

      const updatedGame = await updateUploadedGame(gameId, payload);
      const updatedRow = buildExistingRowFromGame(updatedGame);

      setExistingRows((prev) =>
        prev.map((item) =>
          item.game_id === gameId
            ? {
                ...updatedRow,
                status: "UPLOADED",
                message: "Saved successfully.",
                saving: false,
              }
            : item
        )
      );
      onUploaded?.();
    } catch (error) {
      setExistingRows((prev) =>
        prev.map((item) =>
          item.game_id === gameId
            ? {
                ...item,
                saving: false,
                status: "ERROR",
                message: getErrorMessage(error, "Failed to save row."),
              }
            : item
        )
      );
    }
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

    if (!window.confirm("Delete this uploaded game?")) {
      return;
    }

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
      onUploaded?.();
    } catch (error) {
      setExistingRows((prev) =>
        prev.map((item) =>
          item.game_id === gameId
            ? {
                ...item,
                deleting: false,
                status: "ERROR",
                message: getErrorMessage(error, "Failed to delete row."),
              }
            : item
        )
      );
    }
  };

  if (!isDoaOrNl) {
    if (embedded) {
      return null;
    }
    return (
      <div className="bulk-upload-page">
        <div className="bulk-upload-header">
          <h1>Upload Games</h1>
          <p>Bulk upload is currently available for DOA/NL accounts only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bulk-upload-page ${embedded ? "bulk-upload-page-embedded" : ""}`.trim()}>
      <div className="bulk-upload-header">
        {embedded ? <h2>Upload Games</h2> : <h1>Upload Games</h1>}
        <p>
          Add multiple {gameType === "NL" ? "NL" : "DOA"} games in one go. Each row is one game.
        </p>
      </div>

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
            <span>Month</span>
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
          <button type="button" onClick={addRow}>
            Add Row
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
                  <th>Status</th>
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
                          disabled={!row.can_edit || row.saving || row.deleting}
                          onChange={(event) =>
                            handleExistingRowChange(row.game_id, "date", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={normalizeTimeValue(row.time)}
                          disabled={
                            !row.can_edit || row.saving || row.deleting || !row.date
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
                          disabled={!row.can_edit || row.saving || row.deleting}
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
                          disabled={!row.can_edit || row.saving || row.deleting}
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
                            !row.can_edit || row.saving || row.deleting || !row.division
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
                            !row.can_edit || row.saving || row.deleting || !row.division
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
                        <div className="bulk-upload-row-status">
                          <span className={`status-pill ${row.status.toLowerCase()}`}>
                            {row.status}
                          </span>
                          {row.message && <p>{row.message}</p>}
                          {!row.message && row.lock_reason && <p>{row.lock_reason}</p>}
                        </div>
                      </td>
                      <td>
                        <div className="bulk-upload-row-actions">
                          <button
                            type="button"
                            className="row-remove-btn"
                            disabled={!row.can_edit || row.saving || row.deleting}
                            onClick={() => handleSaveExistingRow(row.game_id)}
                          >
                            {row.saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            className="row-remove-btn"
                            disabled={!row.can_delete || row.saving || row.deleting}
                            onClick={() => handleDeleteExistingRow(row.game_id)}
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
                        disabled={row.uploading}
                        onChange={(event) =>
                          handleRowChange(row.id, "date", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={normalizeTimeValue(row.time)}
                        disabled={row.uploading || !row.date}
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
                        disabled={row.uploading}
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
                        disabled={row.uploading}
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
                        disabled={row.uploading || !row.division}
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
                        disabled={row.uploading || !row.division}
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
                      <div className="bulk-upload-row-status">
                        <span className={`status-pill ${row.status.toLowerCase()}`}>
                          {row.status}
                        </span>
                        {row.message && <p>{row.message}</p>}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="row-remove-btn"
                        disabled={row.uploading}
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
                      <td colSpan={10}>
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
    </div>
  );
}
