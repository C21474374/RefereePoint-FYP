import { useCallback, useEffect, useMemo, useState } from "react";
import AppIcon from "../components/AppIcon";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { canAccessConfigurePage } from "../utils/access";
import {
  createDivision,
  createTeam,
  getConfigureBootstrap,
  updateDivision,
  updateTeam,
  type ConfigureDivision,
  type ConfigureTeam,
} from "../services/configure";
import "./Configure.css";

type SectionKey = "division" | "team";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
// Persisted page state keeps admin workflows stable between visits.
const CONFIGURE_PREFS_KEY_PREFIX = "refereepoint.configure.prefs";

function getErrorMessage(error: unknown, fallback: string) {
  const maybe = error as {
    response?: { data?: { detail?: string } | Record<string, unknown> };
    message?: string;
  };
  const data = maybe?.response?.data;
  if (data && typeof data === "object" && "detail" in data && typeof data.detail === "string") {
    return data.detail;
  }
  if (data && typeof data === "object") {
    const first = Object.values(data)[0];
    if (typeof first === "string") {
      return first;
    }
    if (Array.isArray(first) && typeof first[0] === "string") {
      return first[0];
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function sortDivisions(items: ConfigureDivision[]) {
  return [...items].sort((a, b) => a.display.localeCompare(b.display));
}

function sortTeams(items: ConfigureTeam[]) {
  return [...items].sort((a, b) =>
    `${a.club_name} ${a.division_name}`.localeCompare(`${b.club_name} ${b.division_name}`)
  );
}

export default function ConfigurePage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canConfigure = canAccessConfigurePage(user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    division: true,
    team: false,
  });
  const [divisionQuery, setDivisionQuery] = useState("");
  const [divisionStatusFilter, setDivisionStatusFilter] = useState<StatusFilter>("ALL");
  const [teamQuery, setTeamQuery] = useState("");
  const [teamStatusFilter, setTeamStatusFilter] = useState<StatusFilter>("ALL");
  const [teamClubFilter, setTeamClubFilter] = useState("ALL");
  const [teamDivisionFilter, setTeamDivisionFilter] = useState("ALL");

  const [clubs, setClubs] = useState<Array<{ id: number; name: string }>>([]);
  const [divisions, setDivisions] = useState<ConfigureDivision[]>([]);
  const [teams, setTeams] = useState<ConfigureTeam[]>([]);

  const [newDivisionName, setNewDivisionName] = useState("");
  const [newDivisionGender, setNewDivisionGender] = useState<"M" | "F">("M");
  const [newDivisionAppointed, setNewDivisionAppointed] = useState(true);
  const [newTeamClubId, setNewTeamClubId] = useState("");
  const [newTeamDivisionId, setNewTeamDivisionId] = useState("");
  const [showDivisionFilters, setShowDivisionFilters] = useState(false);
  const [showTeamFilters, setShowTeamFilters] = useState(false);
  const [editingDivisionId, setEditingDivisionId] = useState<number | null>(null);
  const [editDivisionName, setEditDivisionName] = useState("");
  const [editDivisionGender, setEditDivisionGender] = useState<"M" | "F">("M");
  const [editDivisionAppointed, setEditDivisionAppointed] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [editTeamClubId, setEditTeamClubId] = useState("");
  const [editTeamDivisionId, setEditTeamDivisionId] = useState("");

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") {
      return;
    }

    const storageKey = `${CONFIGURE_PREFS_KEY_PREFIX}.${user.id}`;
    try {
      const rawValue = window.localStorage.getItem(storageKey);
      if (!rawValue) {
        return;
      }
      const parsed = JSON.parse(rawValue) as {
        expanded?: Partial<Record<SectionKey, boolean>>;
        divisionQuery?: string;
        divisionStatusFilter?: StatusFilter;
        teamQuery?: string;
        teamStatusFilter?: StatusFilter;
        teamClubFilter?: string;
        teamDivisionFilter?: string;
        showDivisionFilters?: boolean;
        showTeamFilters?: boolean;
      };

      if (parsed.expanded) {
        setExpanded((prev) => ({ ...prev, ...parsed.expanded }));
      }
      if (typeof parsed.divisionQuery === "string") {
        setDivisionQuery(parsed.divisionQuery);
      }
      if (
        parsed.divisionStatusFilter &&
        ["ALL", "ACTIVE", "INACTIVE"].includes(parsed.divisionStatusFilter)
      ) {
        setDivisionStatusFilter(parsed.divisionStatusFilter);
      }
      if (typeof parsed.teamQuery === "string") {
        setTeamQuery(parsed.teamQuery);
      }
      if (
        parsed.teamStatusFilter &&
        ["ALL", "ACTIVE", "INACTIVE"].includes(parsed.teamStatusFilter)
      ) {
        setTeamStatusFilter(parsed.teamStatusFilter);
      }
      if (typeof parsed.teamClubFilter === "string") {
        setTeamClubFilter(parsed.teamClubFilter);
      }
      if (typeof parsed.teamDivisionFilter === "string") {
        setTeamDivisionFilter(parsed.teamDivisionFilter);
      }
      if (typeof parsed.showDivisionFilters === "boolean") {
        setShowDivisionFilters(parsed.showDivisionFilters);
      }
      if (typeof parsed.showTeamFilters === "boolean") {
        setShowTeamFilters(parsed.showTeamFilters);
      }
    } catch {
      // Ignore invalid persisted preferences.
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") {
      return;
    }

    const storageKey = `${CONFIGURE_PREFS_KEY_PREFIX}.${user.id}`;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          expanded,
          divisionQuery,
          divisionStatusFilter,
          teamQuery,
          teamStatusFilter,
          teamClubFilter,
          teamDivisionFilter,
          showDivisionFilters,
          showTeamFilters,
        })
      );
    } catch {
      // Ignore local storage failures.
    }
  }, [
    divisionQuery,
    divisionStatusFilter,
    expanded,
    showDivisionFilters,
    showTeamFilters,
    teamClubFilter,
    teamDivisionFilter,
    teamQuery,
    teamStatusFilter,
    user?.id,
  ]);

  const activeDivisions = useMemo(
    () => sortDivisions(divisions.filter((item) => item.is_active)),
    [divisions]
  );

  const filteredDivisions = useMemo(() => {
    const query = divisionQuery.trim().toLowerCase();
    return divisions.filter((item) => {
      const matchesQuery =
        !query ||
        item.display.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query);

      const matchesStatus =
        divisionStatusFilter === "ALL" ||
        (divisionStatusFilter === "ACTIVE" && item.is_active) ||
        (divisionStatusFilter === "INACTIVE" && !item.is_active);

      return matchesQuery && matchesStatus;
    });
  }, [divisionQuery, divisionStatusFilter, divisions]);

  const filteredTeams = useMemo(() => {
    const query = teamQuery.trim().toLowerCase();
    return teams.filter((item) => {
      const matchesQuery =
        !query ||
        item.club_name.toLowerCase().includes(query) ||
        item.division_name.toLowerCase().includes(query);

      const matchesStatus =
        teamStatusFilter === "ALL" ||
        (teamStatusFilter === "ACTIVE" && item.is_active) ||
        (teamStatusFilter === "INACTIVE" && !item.is_active);

      const matchesClub = teamClubFilter === "ALL" || String(item.club_id) === teamClubFilter;
      const matchesDivision =
        teamDivisionFilter === "ALL" || String(item.division_id) === teamDivisionFilter;

      return matchesQuery && matchesStatus && matchesClub && matchesDivision;
    });
  }, [teamClubFilter, teamDivisionFilter, teamQuery, teamStatusFilter, teams]);

  const loadData = useCallback(async () => {
    if (!canConfigure) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const data = await getConfigureBootstrap();
      setClubs([...data.clubs].sort((a, b) => a.name.localeCompare(b.name)));
      setDivisions(sortDivisions(data.divisions));
      setTeams(sortTeams(data.teams));
    } catch (err) {
      const message = getErrorMessage(err, "Failed to load configuration.");
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [canConfigure, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleSection = (key: SectionKey) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetAlerts = () => {
    setError("");
    setSuccess("");
  };

  const createNewDivision = async () => {
    const name = newDivisionName.trim();
    if (!name) {
      setError("Division name is required.");
      return;
    }
    try {
      setActionKey("create-division");
      resetAlerts();
      await createDivision({
        name,
        gender: newDivisionGender,
        requires_appointed_referees: newDivisionAppointed,
      });
      setNewDivisionName("");
      setNewDivisionGender("M");
      setNewDivisionAppointed(true);
      await loadData();
      setSuccess("Division created.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create division."));
    } finally {
      setActionKey(null);
    }
  };

  const startDivisionEdit = (item: ConfigureDivision) => {
    setEditingDivisionId(item.id);
    setEditDivisionName(item.name);
    setEditDivisionGender(item.gender);
    setEditDivisionAppointed(item.requires_appointed_referees);
    resetAlerts();
  };

  const cancelDivisionEdit = () => {
    setEditingDivisionId(null);
    setEditDivisionName("");
    setEditDivisionGender("M");
    setEditDivisionAppointed(false);
    resetAlerts();
  };

  const saveDivisionEdit = async (item: ConfigureDivision) => {
    const nextName = editDivisionName.trim();
    if (!nextName) {
      setError("Division name is required.");
      return;
    }
    try {
      setActionKey(`division-save-${item.id}`);
      resetAlerts();
      await updateDivision(item.id, {
        name: nextName,
        gender: editDivisionGender,
        requires_appointed_referees: editDivisionAppointed,
      });
      await loadData();
      setSuccess("Division updated.");
      setEditingDivisionId(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update division."));
    } finally {
      setActionKey(null);
    }
  };

  const toggleDivision = async (item: ConfigureDivision) => {
    try {
      setActionKey(`division-toggle-${item.id}`);
      resetAlerts();
      await updateDivision(item.id, { is_active: !item.is_active });
      await loadData();
      setSuccess(item.is_active ? "Division deactivated." : "Division reactivated.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update division status."));
    } finally {
      setActionKey(null);
    }
  };

  const createNewTeam = async () => {
    if (!newTeamClubId || !newTeamDivisionId) {
      setError("Select a club and division.");
      return;
    }
    try {
      setActionKey("create-team");
      resetAlerts();
      await createTeam({
        club_id: Number(newTeamClubId),
        division_id: Number(newTeamDivisionId),
      });
      setNewTeamClubId("");
      setNewTeamDivisionId("");
      await loadData();
      setSuccess("Team created.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create team."));
    } finally {
      setActionKey(null);
    }
  };

  const startTeamEdit = (item: ConfigureTeam) => {
    setEditingTeamId(item.id);
    setEditTeamClubId(String(item.club_id));
    setEditTeamDivisionId(String(item.division_id));
    resetAlerts();
  };

  const cancelTeamEdit = () => {
    setEditingTeamId(null);
    setEditTeamClubId("");
    setEditTeamDivisionId("");
    resetAlerts();
  };

  const saveTeamEdit = async (item: ConfigureTeam) => {
    if (!editTeamClubId || !editTeamDivisionId) {
      setError("Select both club and division before saving.");
      return;
    }
    try {
      setActionKey(`team-save-${item.id}`);
      resetAlerts();
      await updateTeam(item.id, {
        club_id: Number(editTeamClubId),
        division_id: Number(editTeamDivisionId),
      });
      await loadData();
      setSuccess("Team updated.");
      setEditingTeamId(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update team."));
    } finally {
      setActionKey(null);
    }
  };

  const toggleTeam = async (item: ConfigureTeam) => {
    try {
      setActionKey(`team-toggle-${item.id}`);
      resetAlerts();
      await updateTeam(item.id, { is_active: !item.is_active });
      await loadData();
      setSuccess(item.is_active ? "Team deactivated." : "Team reactivated.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update team status."));
    } finally {
      setActionKey(null);
    }
  };

  if (!canConfigure) {
    return (
      <div className="configure-page">
        <div className="configure-page-header">
          <h1 className="page-title-with-icon">
            <AppIcon name="settings" className="page-title-icon" />
            <span>Configure</span>
          </h1>
          <p>This page is available for DOA and NL roles only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="configure-page">
      <div className="configure-page-header">
        <h1 className="page-title-with-icon">
          <AppIcon name="settings" className="page-title-icon" />
          <span>Configure</span>
        </h1>
        <p>Manage divisions and teams with soft deactivation safeguards.</p>
      </div>

      {loading && <p className="configure-message">Loading configuration...</p>}
      {error && <p className="configure-error">{error}</p>}
      {success && <p className="configure-success">{success}</p>}

      {!loading && (
        <>
          <section
            id="configure-division"
            className={`configure-section ${expanded.division ? "expanded" : "collapsed"}`}
          >
            <div className="configure-section-header">
              <h2 className="section-title-with-icon">
                <AppIcon name="games" className="section-title-icon" />
                <span>Divisions</span>
              </h2>
              <p>Divisions define competition level and gender (e.g. U16-M, U18-F).</p>
            </div>
            {expanded.division && (
              <div className="configure-section-content">
                <div className="configure-create-grid">
                  <label>
                    <span>Name</span>
                    <input
                      type="text"
                      value={newDivisionName}
                      onChange={(event) => setNewDivisionName(event.target.value)}
                      placeholder="e.g. U16"
                    />
                  </label>
                  <label>
                    <span>Gender</span>
                    <select
                      value={newDivisionGender}
                      onChange={(event) => setNewDivisionGender(event.target.value as "M" | "F")}
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </label>
                  <label className="configure-checkbox">
                    <input
                      type="checkbox"
                      checked={newDivisionAppointed}
                      onChange={(event) => setNewDivisionAppointed(event.target.checked)}
                    />
                    <span>Requires appointed referees</span>
                  </label>
                  <button type="button" onClick={createNewDivision} disabled={actionKey === "create-division"}>
                    Add Division
                  </button>
                </div>
                <div className="configure-toolbar-header">
                  <h3>Filters</h3>
                  <button
                    type="button"
                    className="configure-clear-btn"
                    onClick={() => setShowDivisionFilters((prev) => !prev)}
                  >
                    {showDivisionFilters ? "Hide Filters" : "Show Filters"}
                  </button>
                </div>
                {showDivisionFilters && (
                  <div className="configure-toolbar">
                    <label>
                      <span>Search</span>
                      <input
                        type="text"
                        value={divisionQuery}
                        onChange={(event) => setDivisionQuery(event.target.value)}
                        placeholder="Search division..."
                      />
                    </label>
                    <label>
                      <span>Status</span>
                      <select
                        value={divisionStatusFilter}
                        onChange={(event) =>
                          setDivisionStatusFilter(event.target.value as StatusFilter)
                        }
                      >
                        <option value="ALL">All</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="configure-clear-btn"
                      onClick={() => {
                        setDivisionQuery("");
                        setDivisionStatusFilter("ALL");
                      }}
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
                {divisions.length === 0 ? (
                  <p className="configure-empty">No divisions configured.</p>
                ) : filteredDivisions.length === 0 ? (
                  <p className="configure-empty">No divisions match your filters.</p>
                ) : (
                  <div className="configure-list-scroll">
                    <div className="configure-list">
                      {filteredDivisions.map((item) => (
                        <article key={item.id} className="configure-item-card">
                          <div className="configure-item-top">
                            <div>
                              <h3>{item.display}</h3>
                              <p>{item.requires_appointed_referees ? "Appointed" : "Non-appointed"}</p>
                            </div>
                            <span className="configure-status">{item.is_active ? "Active" : "Inactive"}</span>
                          </div>
                          {editingDivisionId === item.id && (
                            <div className="configure-inline-edit-grid">
                              <label>
                                <span>Name</span>
                                <input
                                  type="text"
                                  value={editDivisionName}
                                  onChange={(event) => setEditDivisionName(event.target.value)}
                                  placeholder="Division name"
                                />
                              </label>
                              <label>
                                <span>Gender</span>
                                <select
                                  value={editDivisionGender}
                                  onChange={(event) =>
                                    setEditDivisionGender(event.target.value as "M" | "F")
                                  }
                                >
                                  <option value="M">Male</option>
                                  <option value="F">Female</option>
                                </select>
                              </label>
                              <label className="configure-checkbox">
                                <input
                                  type="checkbox"
                                  checked={editDivisionAppointed}
                                  onChange={(event) =>
                                    setEditDivisionAppointed(event.target.checked)
                                  }
                                />
                                <span>Requires appointed referees</span>
                              </label>
                            </div>
                          )}
                          <div className="configure-item-actions">
                            {editingDivisionId === item.id ? (
                              <>
                                <button
                                  type="button"
                                  className="configure-save-btn"
                                  onClick={() => saveDivisionEdit(item)}
                                  disabled={actionKey === `division-save-${item.id}`}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelDivisionEdit}
                                  disabled={actionKey === `division-save-${item.id}`}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => startDivisionEdit(item)}>
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleDivision(item)}
                                  disabled={actionKey === `division-toggle-${item.id}`}
                                >
                                  {item.is_active ? "Deactivate" : "Reactivate"}
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className="configure-section-toggle"
              onClick={() => toggleSection("division")}
              aria-expanded={expanded.division}
              aria-label={expanded.division ? "Collapse section" : "Expand section"}
              title={expanded.division ? "Collapse section" : "Expand section"}
            >
              <span className="inline-icon-label">
                <AppIcon
                  name={expanded.division ? "filter" : "plus"}
                  className="configure-section-toggle-icon"
                />
                <span>{expanded.division ? "Collapse" : "Expand"}</span>
              </span>
            </button>
          </section>

          <section
            id="configure-team"
            className={`configure-section ${expanded.team ? "expanded" : "collapsed"}`}
          >
            <div className="configure-section-header">
              <h2 className="section-title-with-icon">
                <AppIcon name="user" className="section-title-icon" />
                <span>Teams</span>
              </h2>
              <p>Use club + division mapping. Deactivation is blocked if upcoming games depend on it.</p>
            </div>
            {expanded.team && (
              <div className="configure-section-content">
                <div className="configure-create-grid">
                  <label>
                    <span>Club</span>
                    <select value={newTeamClubId} onChange={(event) => setNewTeamClubId(event.target.value)}>
                      <option value="">Select club</option>
                      {clubs.map((club) => (
                        <option key={club.id} value={club.id}>
                          {club.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Division</span>
                    <select value={newTeamDivisionId} onChange={(event) => setNewTeamDivisionId(event.target.value)}>
                      <option value="">Select division</option>
                      {activeDivisions.map((division) => (
                        <option key={division.id} value={division.id}>
                          {division.display}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={createNewTeam} disabled={actionKey === "create-team"}>
                    Add Team
                  </button>
                </div>
                <div className="configure-toolbar-header">
                  <h3>Filters</h3>
                  <button
                    type="button"
                    className="configure-clear-btn"
                    onClick={() => setShowTeamFilters((prev) => !prev)}
                  >
                    {showTeamFilters ? "Hide Filters" : "Show Filters"}
                  </button>
                </div>
                {showTeamFilters && (
                  <div className="configure-toolbar">
                    <label>
                      <span>Search</span>
                      <input
                        type="text"
                        value={teamQuery}
                        onChange={(event) => setTeamQuery(event.target.value)}
                        placeholder="Search club or division..."
                      />
                    </label>
                    <label>
                      <span>Status</span>
                      <select
                        value={teamStatusFilter}
                        onChange={(event) =>
                          setTeamStatusFilter(event.target.value as StatusFilter)
                        }
                      >
                        <option value="ALL">All</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </label>
                    <label>
                      <span>Club</span>
                      <select
                        value={teamClubFilter}
                        onChange={(event) => setTeamClubFilter(event.target.value)}
                      >
                        <option value="ALL">All clubs</option>
                        {clubs.map((club) => (
                          <option key={club.id} value={club.id}>
                            {club.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Division</span>
                      <select
                        value={teamDivisionFilter}
                        onChange={(event) => setTeamDivisionFilter(event.target.value)}
                      >
                        <option value="ALL">All divisions</option>
                        {divisions.map((division) => (
                          <option key={division.id} value={division.id}>
                            {division.display}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="configure-clear-btn"
                      onClick={() => {
                        setTeamQuery("");
                        setTeamStatusFilter("ALL");
                        setTeamClubFilter("ALL");
                        setTeamDivisionFilter("ALL");
                      }}
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
                {teams.length === 0 ? (
                  <p className="configure-empty">No teams configured.</p>
                ) : filteredTeams.length === 0 ? (
                  <p className="configure-empty">No teams match your filters.</p>
                ) : (
                  <div className="configure-list-scroll">
                    <div className="configure-list">
                      {filteredTeams.map((item) => (
                        <article key={item.id} className="configure-item-card">
                          <div className="configure-item-top">
                            <div>
                              <h3>{item.club_name}</h3>
                              <p>{item.division_name}</p>
                            </div>
                            <span className="configure-status">{item.is_active ? "Active" : "Inactive"}</span>
                          </div>
                          {editingTeamId === item.id && (
                            <div className="configure-inline-edit-grid">
                              <label>
                                <span>Club</span>
                                <select
                                  value={editTeamClubId}
                                  onChange={(event) => setEditTeamClubId(event.target.value)}
                                >
                                  <option value="">Select club</option>
                                  {clubs.map((club) => (
                                    <option key={club.id} value={club.id}>
                                      {club.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span>Division</span>
                                <select
                                  value={editTeamDivisionId}
                                  onChange={(event) => setEditTeamDivisionId(event.target.value)}
                                >
                                  <option value="">Select division</option>
                                  {activeDivisions.map((division) => (
                                    <option key={division.id} value={division.id}>
                                      {division.display}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          )}
                          <div className="configure-item-actions">
                            {editingTeamId === item.id ? (
                              <>
                                <button
                                  type="button"
                                  className="configure-save-btn"
                                  onClick={() => saveTeamEdit(item)}
                                  disabled={actionKey === `team-save-${item.id}`}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelTeamEdit}
                                  disabled={actionKey === `team-save-${item.id}`}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => startTeamEdit(item)}>
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleTeam(item)}
                                  disabled={actionKey === `team-toggle-${item.id}`}
                                >
                                  {item.is_active ? "Deactivate" : "Reactivate"}
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className="configure-section-toggle"
              onClick={() => toggleSection("team")}
              aria-expanded={expanded.team}
              aria-label={expanded.team ? "Collapse section" : "Expand section"}
              title={expanded.team ? "Collapse section" : "Expand section"}
            >
              <span className="inline-icon-label">
                <AppIcon
                  name={expanded.team ? "filter" : "plus"}
                  className="configure-section-toggle-icon"
                />
                <span>{expanded.team ? "Collapse" : "Expand"}</span>
              </span>
            </button>
          </section>
        </>
      )}
    </div>
  );
}
