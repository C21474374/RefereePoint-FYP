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
        <h1>Welcome back, {name.split(' ')[0]}</h1>
        <p className="dashboard-hero-subtitle">
          Ready to referee? Check your next game and take action.
        </p>
      </div>

      <div className="dashboard-hero-profile">
        <div className="dashboard-hero-profile-card">
          <span className="dashboard-profile-grade">{grade}</span>
        </div>
      </div>
    </section>
  );
}