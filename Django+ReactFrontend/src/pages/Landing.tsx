import { Link, Navigate } from "react-router-dom";
import AppIcon from "../components/AppIcon";
import { useAuth } from "../context/AuthContext";
import "./Landing.css";

const featureItems = [
  {
    title: "Find Opportunities",
    description: "Browse games, cover requests, and events matched to your role.",
    icon: "basketball" as const,
  },
  {
    title: "Cover Request Flow",
    description: "Request cover, claim open requests, and track approval status clearly.",
    icon: "whistle" as const,
  },
  {
    title: "Reports and Earnings",
    description: "Submit reports and track monthly appointed claims in one place.",
    icon: "earnings" as const,
  },
  {
    title: "Admin Tools",
    description: "Manage account approvals, uploads, and operational configuration.",
    icon: "approvals" as const,
  },
];

const flowItems = [
  {
    title: "Create Account",
    description: "Register with the right role so your pages and actions are tailored.",
    icon: "user" as const,
  },
  {
    title: "Get Approved",
    description: "DOA/NL admins review and approve account access for your workflow.",
    icon: "approvals" as const,
  },
  {
    title: "Start Managing Games",
    description: "Take assignments, upload fixtures, and keep referees coordinated.",
    icon: "games" as const,
  },
];

export default function LandingPage() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="route-loading-screen">
        <div className="route-loading-card">
          <span className="route-loading-spinner" aria-hidden="true" />
          <p>Loading RefereePoint...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <p className="landing-brand inline-icon-label">
          <AppIcon name="basketball" />
          <span>RefereePoint</span>
        </p>
        <h1>Referee management from assignment to reporting.</h1>
        <p className="landing-subtitle">
          One platform for referees, clubs, schools, colleges, and DOA/NL admins to run games,
          manage coverage, and keep operations clear.
        </p>

        <div className="landing-hero-actions">
          <Link to="/login" className="landing-btn landing-btn-primary">
            <span className="button-with-icon">
              <AppIcon name="user" />
              <span>Login</span>
            </span>
          </Link>
          <Link to="/signup" className="landing-btn landing-btn-secondary">
            <span className="button-with-icon">
              <AppIcon name="plus" />
              <span>Register</span>
            </span>
          </Link>
        </div>
      </section>

      <section className="landing-section">
        <h2 className="section-title-with-icon">
          <AppIcon name="dashboard" className="section-title-icon" />
          <span>What You Can Do</span>
        </h2>
        <div className="landing-feature-grid">
          {featureItems.map((item) => (
            <article key={item.title} className="landing-feature-card">
              <h3 className="inline-icon-label">
                <AppIcon name={item.icon} />
                <span>{item.title}</span>
              </h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2 className="section-title-with-icon">
          <AppIcon name="whistle" className="section-title-icon" />
          <span>How It Works</span>
        </h2>
        <div className="landing-flow-grid">
          {flowItems.map((item, index) => (
            <article key={item.title} className="landing-flow-card">
              <span className="landing-flow-step">{index + 1}</span>
              <h3 className="inline-icon-label">
                <AppIcon name={item.icon} />
                <span>{item.title}</span>
              </h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-footer-cta">
        <p>Ready to continue?</p>
        <div className="landing-hero-actions">
          <Link to="/login" className="landing-btn landing-btn-primary">
            <span className="button-with-icon">
              <AppIcon name="user" />
              <span>Go to Login</span>
            </span>
          </Link>
          <Link to="/signup" className="landing-btn landing-btn-secondary">
            <span className="button-with-icon">
              <AppIcon name="plus" />
              <span>Create Account</span>
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
