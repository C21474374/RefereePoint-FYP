import { Link } from "react-router-dom";
import "./DashboardQuickActions.css";

export default function DashboardQuickActions() {
  return (
    <section className="dashboard-quick-actions">
      <h2>Quick Actions</h2>

      <div className="dashboard-action-grid">
        <Link to="/games" className="dashboard-action-card">
          <h3>Browse Games</h3>
          <p>Find open opportunities and claim available slots.</p>
        </Link>

        <Link to="/upload-game" className="dashboard-action-card">
          <h3>Upload Game</h3>
          <p>Post a game and create referee opportunities.</p>
        </Link>

        <Link to="/cover-requests" className="dashboard-action-card">
          <h3>Cover Requests</h3>
          <p>Check current cover requests and manage replacements.</p>
        </Link>

        <Link to="/earnings" className="dashboard-action-card">
          <h3>Earnings</h3>
          <p>Track your payments and income over time.</p>
        </Link>
      </div>
    </section>
  );
}