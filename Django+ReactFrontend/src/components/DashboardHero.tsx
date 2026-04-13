import AppIcon from "./AppIcon";
import "./DashboardHero.css";

type DashboardHeroProps = {
  name: string;
  badgeLabel: string;
  email: string;
  subtitle?: string;
};

export default function DashboardHero({
  name,
  badgeLabel,
  email,
  subtitle,
}: DashboardHeroProps) {
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
          <span className="dashboard-profile-grade">{badgeLabel}</span>
        </div>
      </div>
    </section>
  );
}
