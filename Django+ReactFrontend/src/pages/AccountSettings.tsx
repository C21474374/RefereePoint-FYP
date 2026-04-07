import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { switchTestingRole, type AccountType } from "../services/auth";
import "../pages_css/AccountSettings.css";

const ROLE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: "REFEREE", label: "Referee" },
  { value: "CLUB", label: "Club" },
  { value: "SCHOOL", label: "School" },
  { value: "COLLEGE", label: "College" },
  { value: "DOA", label: "DOA" },
  { value: "NL", label: "National League" },
];

function getInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string | null | undefined
) {
  const first = (firstName || "").trim().charAt(0).toUpperCase();
  const last = (lastName || "").trim().charAt(0).toUpperCase();
  if (first && last) {
    return `${first}${last}`;
  }
  if (first) {
    return first;
  }
  if (email) {
    return email.charAt(0).toUpperCase();
  }
  return "R";
}

export default function AccountSettings() {
  const { user, refreshUser } = useAuth();
  const isRefereeUser = Boolean(user?.referee_profile);
  const [selectedRole, setSelectedRole] = useState<AccountType>("REFEREE");
  const [switchingRole, setSwitchingRole] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [roleSuccess, setRoleSuccess] = useState("");

  useEffect(() => {
    if (user?.account_type) {
      setSelectedRole(user.account_type);
    }
  }, [user?.account_type]);

  const fullName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "User";
  const grade = user?.referee_profile?.grade?.replaceAll("_", " ") || "N/A";
  const roleLabel = user?.account_type_display || "Not set";
  const initials = getInitials(user?.first_name, user?.last_name, user?.email);

  const handleRoleSwitch = async () => {
    try {
      setSwitchingRole(true);
      setRoleError("");
      setRoleSuccess("");
      await switchTestingRole(selectedRole);
      await refreshUser();
      const selectedLabel =
        ROLE_OPTIONS.find((option) => option.value === selectedRole)?.label || selectedRole;
      setRoleSuccess(`Switched role to ${selectedLabel} (temporary testing bypass).`);
      window.dispatchEvent(new Event("refereepoint:data-refresh"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to switch role.";
      setRoleError(message);
    } finally {
      setSwitchingRole(false);
    }
  };

  return (
    <div className="account-settings-page">
      <div className="account-settings-header">
        <h1>Account Settings</h1>
        <p>Manage your account details. Profile picture upload will be added next.</p>
      </div>

      <section className="account-settings-card">
        <div className="account-profile-row">
          <span className="account-profile-avatar" aria-hidden="true">
            {initials}
          </span>
          <div>
            <h2>{fullName}</h2>
            <p>{user?.email || "Email unavailable"}</p>
            <span className="account-profile-coming-soon">Profile photo upload coming soon</span>
          </div>
        </div>
      </section>

      <section className="account-settings-card">
        <h2>Profile Details</h2>
        <div className="account-settings-grid">
          <article>
            <span>{isRefereeUser ? "Grade" : "Role"}</span>
            <p>{isRefereeUser ? grade : roleLabel}</p>
          </article>
          <article>
            <span>Phone Number</span>
            <p>{user?.phone_number || "Not set"}</p>
          </article>
          <article>
            <span>BIPIN Number</span>
            <p>{user?.bipin_number || "Not set"}</p>
          </article>
          <article>
            <span>Home Address</span>
            <p>{user?.home_address || "Not set"}</p>
          </article>
        </div>
      </section>

      <section className="account-settings-card">
        <h2>Testing Bypass (Temporary)</h2>
        <p className="account-settings-testing-copy">
          Switch account role on the fly for faster testing. This is a temporary cheat flow.
        </p>

        {roleError && <p className="account-settings-testing-error">{roleError}</p>}
        {roleSuccess && <p className="account-settings-testing-success">{roleSuccess}</p>}

        <div className="account-settings-testing-controls">
          <label>
            <span>Account Role</span>
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as AccountType)}
              disabled={switchingRole}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleRoleSwitch}
            disabled={switchingRole || !user || selectedRole === user.account_type}
          >
            {switchingRole ? "Switching..." : "Switch Role"}
          </button>
        </div>
      </section>
    </div>
  );
}
