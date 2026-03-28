import { useAuth } from "../context/AuthContext";
import "../pages_css/AccountSettings.css";

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
  const { user } = useAuth();

  const fullName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Referee";
  const grade = user?.referee_profile?.grade?.replaceAll("_", " ") || "N/A";
  const initials = getInitials(user?.first_name, user?.last_name, user?.email);

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
            <span>Grade</span>
            <p>{grade}</p>
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
    </div>
  );
}
