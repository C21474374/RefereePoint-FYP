import "./DashboardHero.css";

type DashboardHeroProps = {
  name: string;
  grade: string;
  email: string;
};

export default function DashboardHero({
  name,
  grade,
  email,
}: DashboardHeroProps) {
  return (
    <section className="dashboard-hero">
      <div className="dashboard-hero-content">
        <p className="dashboard-hero-kicker">Referee Dashboard</p>
        <h1>Welcome back, {name}</h1>
        <p className="dashboard-hero-subtitle">
          Manage your games, track your referee activity, and quickly jump into
          the most important actions.
        </p>
      </div>

      <div className="dashboard-hero-profile">
        <div className="dashboard-hero-profile-card">
          <span className="dashboard-profile-grade">{grade}</span>
          <p>{email}</p>
        </div>
      </div>
    </section>
  );
}