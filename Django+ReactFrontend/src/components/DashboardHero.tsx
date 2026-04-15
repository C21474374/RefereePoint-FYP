import AppIcon from "./AppIcon";
import "./DashboardHero.css";

type DashboardHeroProps = {
  name: string;
  badgeLabel: string;
  badgeType: "role" | "grade";
  email: string;
  subtitle?: string;
};

export default function DashboardHero({
  name,
  badgeLabel,
  badgeType,
  email,
  subtitle,
}: DashboardHeroProps) {
  const badgeTitle = badgeType === "grade" ? "Grade" : "Role";

  return (
    <section className="dashboard-hero">
      <div className="dashboard-hero-content">
        <h1 className="page-title-with-icon">
          <AppIcon name="dashboard" className="page-title-icon" />
          <span>Welcome back, {name.split(" ")[0]}</span>
        </h1>
        <p className="dashboard-hero-subtitle">
          {subtitle || "Ready to referee? Check your next game and take action."}
        </p>
        <p className="dashboard-hero-email">{email}</p>
      </div>

      <div className="dashboard-hero-profile">
        <div className="dashboard-hero-profile-card">
          <span className="dashboard-profile-badge-label">{badgeTitle}</span>
          <span className="dashboard-profile-grade">
            <AppIcon name="user" size={14} className="dashboard-profile-grade-icon" />
            <span>{badgeLabel}</span>
          </span>
        </div>
      </div>
    </section>
  );
}
