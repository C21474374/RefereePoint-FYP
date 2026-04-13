import { useCallback, useEffect, useMemo, useState } from "react";
import AppIcon from "../components/AppIcon";
import { useAuth } from "../context/AuthContext";
import {
  createDivision,
  createTeam,
  getConfigureBootstrap,
  updateDivision,
  updateTeam,
  type ConfigureDivision,
  type ConfigureTeam,
} from "../services/configure";
import "../pages_css/Configure.css";

type SectionKey = "division" | "team";

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
  const { user } = useAuth();
  const canConfigure = user?.account_type === "DOA" || user?.account_type === "NL";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    division: true,
    team: false,
  });

  const [clubs, setClubs] = useState<Array<{ id: number; name: string }>>([]);
  const [divisions, setDivisions] = useState<ConfigureDivision[]>([]);
  const [teams, setTeams] = useState<ConfigureTeam[]>([]);

  const [newDivisionName, setNewDivisionName] = useState("");
  const [newDivisionGender, setNewDivisionGender] = useState<"M" | "F" | "MIXED">("M");
  const [newDivisionAppointed, setNewDivisionAppointed] = useState(true);
  const [newTeamClubId, setNewTeamClubId] = useState("");
  const [newTeamDivisionId, setNewTeamDivisionId] = useState("");

  const activeDivisions = useMemo(
    () => sortDivisions(divisions.filter((item) => item.is_active)),
    [divisions]
  );

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
      setError(getErrorMessage(err, "Failed to load configuration."));
    } finally {
      setLoading(false);
    }
  }, [canConfigure]);

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

  const renameDivision = async (item: ConfigureDivision) => {
    const nextName = window.prompt("Division name", item.name)?.trim();
    if (!nextName || nextName === item.name) {
      return;
    }
    try {
      setActionKey(`division-rename-${item.id}`);
      resetAlerts();
      await updateDivision(item.id, { name: nextName });
      await loadData();
      setSuccess("Division updated.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update division."));
    } finally {
      setActionKey(null);
    }
  };

  const toggleDivisionAppointed = async (item: ConfigureDivision) => {
    try {
      setActionKey(`division-appointed-${item.id}`);
      resetAlerts();
      await updateDivision(item.id, {
        requires_appointed_referees: !item.requires_appointed_referees,
      });
      await loadData();
      setSuccess("Division rules updated.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update division rules."));
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

  const editTeam = async (item: ConfigureTeam) => {
    const clubIdText = window.prompt("Club ID", String(item.club_id));
    const divisionIdText = window.prompt("Division ID", String(item.division_id));
    if (!clubIdText || !divisionIdText) {
      return;
    }
    const clubId = Number(clubIdText);
    const divisionId = Number(divisionIdText);
    if (!Number.isFinite(clubId) || !Number.isFinite(divisionId)) {
      setError("Club ID and Division ID must be numbers.");
      return;
    }
    try {
      setActionKey(`team-edit-${item.id}`);
      resetAlerts();
      await updateTeam(item.id, {
        club_id: clubId,
        division_id: divisionId,
      });
      await loadData();
      setSuccess("Team updated.");
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
          <section className={`configure-section ${expanded.division ? "expanded" : "collapsed"}`}>
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
                      onChange={(event) => setNewDivisionGender(event.target.value as "M" | "F" | "MIXED")}
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="MIXED">Mixed</option>
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
                {divisions.length === 0 ? (
                  <p className="configure-empty">No divisions configured.</p>
                ) : (
                  <div className="configure-list">
                    {divisions.map((item) => (
                      <article key={item.id} className="configure-item-card">
                        <div className="configure-item-top">
                          <div>
                            <h3>{item.display}</h3>
                            <p>{item.requires_appointed_referees ? "Appointed" : "Non-appointed"}</p>
                          </div>
                          <span className="configure-status">{item.is_active ? "Active" : "Inactive"}</span>
                        </div>
                        <div className="configure-item-actions">
                          <button
                            type="button"
                            onClick={() => renameDivision(item)}
                            disabled={actionKey === `division-rename-${item.id}`}
                          >
                            Edit Name
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleDivisionAppointed(item)}
                            disabled={actionKey === `division-appointed-${item.id}`}
                          >
                            Toggle Appointed
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleDivision(item)}
                            disabled={actionKey === `division-toggle-${item.id}`}
                          >
                            {item.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className="configure-section-toggle"
              onClick={() => toggleSection("division")}
              aria-expanded={expanded.division}
            >
              <span>{expanded.division ? "Collapse" : "Expand"}</span>
              <span className="configure-section-toggle-icon">{expanded.division ? "^" : "v"}</span>
            </button>
          </section>

          <section className={`configure-section ${expanded.team ? "expanded" : "collapsed"}`}>
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
                {teams.length === 0 ? (
                  <p className="configure-empty">No teams configured.</p>
                ) : (
                  <div className="configure-list">
                    {teams.map((item) => (
                      <article key={item.id} className="configure-item-card">
                        <div className="configure-item-top">
                          <div>
                            <h3>{item.club_name}</h3>
                            <p>{item.division_name}</p>
                          </div>
                          <span className="configure-status">{item.is_active ? "Active" : "Inactive"}</span>
                        </div>
                        <div className="configure-item-actions">
                          <button type="button" onClick={() => editTeam(item)} disabled={actionKey === `team-edit-${item.id}`}>
                            Edit Mapping
                          </button>
                          <button type="button" onClick={() => toggleTeam(item)} disabled={actionKey === `team-toggle-${item.id}`}>
                            {item.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className="configure-section-toggle"
              onClick={() => toggleSection("team")}
              aria-expanded={expanded.team}
            >
              <span>{expanded.team ? "Collapse" : "Expand"}</span>
              <span className="configure-section-toggle-icon">{expanded.team ? "^" : "v"}</span>
            </button>
          </section>
        </>
      )}
    </div>
  );
}
