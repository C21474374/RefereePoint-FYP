import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getRefereeOptions,
  getUploadGameFormOptions,
  uploadAppointedGame,
  type RefereeOption,
  type SimpleOption,
  type TeamOption,
} from "../services/games";
import "../pages_css/BulkGameUpload.css";

type RowStatus = "READY" | "UPLOADED" | "ERROR";

type UploadRow = {
  id: number;
  date: string;
  time: string;
  venue: string;
  division: string;
  home_team: string;
  away_team: string;
  crew_chief: string;
  umpire_1: string;
  status: RowStatus;
  message: string;
};

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
  };
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

export default function BulkGameUpload() {
  const { user } = useAuth();
  const isDoaOrNl = user?.account_type === "DOA" || user?.account_type === "NL";
  const gameType = user?.account_type === "NL" ? "NL" : "DOA";

  const [divisions, setDivisions] = useState<SimpleOption[]>([]);
  const [venues, setVenues] = useState<SimpleOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [referees, setReferees] = useState<RefereeOption[]>([]);
  const [rows, setRows] = useState<UploadRow[]>([createEmptyRow(1)]);
  const [nextRowId, setNextRowId] = useState(2);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageSuccess, setPageSuccess] = useState("");

  useEffect(() => {
    async function loadFormOptions() {
      if (!isDoaOrNl) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setPageError("");

        const [options, refereeOptions] = await Promise.all([
          getUploadGameFormOptions(),
          getRefereeOptions(),
        ]);
        setDivisions(options.divisions);
        setVenues(options.venues);
        setTeams(options.teams);
        setReferees(refereeOptions);
      } catch (error) {
        setPageError(
          getErrorMessage(error, "Failed to load upload options. Please try again.")
        );
      } finally {
        setLoading(false);
      }
    }

    loadFormOptions();
  }, [isDoaOrNl]);

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

  const handleRowChange = <K extends keyof UploadRow>(
    rowId: number,
    key: K,
    value: UploadRow[K]
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
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

  const clearUploadedRows = () => {
    const remaining = rows.filter((row) => row.status !== "UPLOADED");
    if (remaining.length === 0) {
      setRows([createEmptyRow(nextRowId)]);
      setNextRowId((prev) => prev + 1);
      return;
    }
    setRows(
      remaining.map((row) => ({
        ...row,
        status: row.status === "ERROR" ? row.status : "READY",
        message: row.status === "ERROR" ? row.message : "",
      }))
    );
  };

  const getTeamsForDivision = (divisionId: string) => {
    const parsedDivisionId = Number(divisionId);
    if (!parsedDivisionId) {
      return [];
    }
    return teams.filter((team) => team.division_id === parsedDivisionId);
  };

  const getTeamOptionsForRow = (
    row: UploadRow,
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

  const submitRows = async () => {
    if (!user?.uploads_approved) {
      setPageError("Your account is not approved to upload games yet.");
      return;
    }

    setSubmitting(true);
    setPageError("");
    setPageSuccess("");

    let successCount = 0;

    const nextRows: UploadRow[] = [];

    for (const row of rows) {
      if (
        !row.date ||
        !row.time ||
        !row.venue ||
        !row.division ||
        !row.home_team ||
        !row.away_team
      ) {
        nextRows.push({
          ...row,
          status: "ERROR",
          message:
            "Please complete Date, Time, Venue, Division, Home Team, and Away Team.",
        });
        continue;
      }

      if (row.home_team === row.away_team) {
        nextRows.push({
          ...row,
          status: "ERROR",
          message: "Home Team and Away Team must be different.",
        });
        continue;
      }

      const selectedDivisionId = Number(row.division);
      if (!selectedDivisionId) {
        nextRows.push({
          ...row,
          status: "ERROR",
          message: "Please select a valid division.",
        });
        continue;
      }

      if (appointedDivisionIds.size > 0 && !appointedDivisionIds.has(selectedDivisionId)) {
        nextRows.push({
          ...row,
          status: "ERROR",
          message: "Selected division is not configured for appointed games.",
        });
        continue;
      }

      const homeTeam = teamById.get(Number(row.home_team));
      const awayTeam = teamById.get(Number(row.away_team));

      if (!homeTeam || !awayTeam || !homeTeam.division_id || !awayTeam.division_id) {
        nextRows.push({
          ...row,
          status: "ERROR",
          message: "Invalid team selection. Please choose teams again.",
        });
        continue;
      }

      if (homeTeam.division_id !== awayTeam.division_id) {
        nextRows.push({
          ...row,
          status: "ERROR",
          message: "Home and Away teams must be from the same division.",
        });
        continue;
      }

      if (
        homeTeam.division_id !== selectedDivisionId ||
        awayTeam.division_id !== selectedDivisionId
      ) {
        nextRows.push({
          ...row,
          status: "ERROR",
          message: "Selected teams must match the chosen division.",
        });
        continue;
      }

      if (row.crew_chief && row.umpire_1 && row.crew_chief === row.umpire_1) {
        nextRows.push({
          ...row,
          status: "ERROR",
          message: "Crew Chief and Umpire 1 must be different referees.",
        });
        continue;
      }

      const appointedAssignments: Array<{
        role: "CREW_CHIEF" | "UMPIRE_1";
        referee: number;
      }> = [];

      if (row.crew_chief) {
        const crewChiefId = Number(row.crew_chief);
        if (!crewChiefId || !refereeById.has(crewChiefId)) {
          nextRows.push({
            ...row,
            status: "ERROR",
            message: "Please choose a valid Crew Chief referee.",
          });
          continue;
        }
        appointedAssignments.push({
          role: "CREW_CHIEF",
          referee: crewChiefId,
        });
      }

      if (row.umpire_1) {
        const umpireId = Number(row.umpire_1);
        if (!umpireId || !refereeById.has(umpireId)) {
          nextRows.push({
            ...row,
            status: "ERROR",
            message: "Please choose a valid Umpire 1 referee.",
          });
          continue;
        }
        appointedAssignments.push({
          role: "UMPIRE_1",
          referee: umpireId,
        });
      }

      try {
        await uploadAppointedGame({
          game_type: gameType,
          payment_type: "CLAIM",
          division: selectedDivisionId,
          date: row.date,
          time: row.time,
          venue: Number(row.venue),
          home_team: Number(row.home_team),
          away_team: Number(row.away_team),
          notes: "",
          original_post_text: "",
          appointed_assignments: appointedAssignments,
        });

        successCount += 1;
        nextRows.push({
          ...row,
          status: "UPLOADED",
          message: "Uploaded successfully.",
        });
      } catch (error) {
        nextRows.push({
          ...row,
          status: "ERROR",
          message: getErrorMessage(error, "Upload failed."),
        });
      }
    }

    setRows(nextRows);

    if (successCount > 0) {
      setPageSuccess(`${successCount} game${successCount === 1 ? "" : "s"} uploaded.`);
    }

    if (successCount < rows.length) {
      setPageError("Some rows failed. Fix the highlighted rows and upload again.");
    }

    setSubmitting(false);
  };

  if (!isDoaOrNl) {
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
    <div className="bulk-upload-page">
      <div className="bulk-upload-header">
        <h1>Upload Games</h1>
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
          <button type="button" onClick={addRow}>
            Add Row
          </button>
          <button type="button" onClick={clearUploadedRows}>
            Clear Uploaded
          </button>
        </div>

        {loading ? (
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={`row-${row.status.toLowerCase()}`}>
                    <td>
                      <input
                        type="date"
                        value={row.date}
                        onChange={(event) =>
                          handleRowChange(row.id, "date", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={row.time}
                        onChange={(event) =>
                          handleRowChange(row.id, "time", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={row.venue}
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
                        disabled={!row.division}
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
                        disabled={!row.division}
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
                        onChange={(event) =>
                          handleRowChange(row.id, "crew_chief", event.target.value)
                        }
                      >
                        <option value="">Unassigned</option>
                        {referees.map((referee) => (
                          <option key={referee.id} value={referee.id}>
                            {referee.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.umpire_1}
                        onChange={(event) =>
                          handleRowChange(row.id, "umpire_1", event.target.value)
                        }
                      >
                        <option value="">Unassigned</option>
                        {referees.map((referee) => (
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
                        onClick={() => removeRow(row.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bulk-upload-actions-bottom">
          <button
            type="button"
            className="upload-all-btn"
            disabled={submitting || loading || !user?.uploads_approved}
            onClick={submitRows}
          >
            {submitting ? "Uploading..." : "Upload All Rows"}
          </button>
        </div>
      </section>
    </div>
  );
}
