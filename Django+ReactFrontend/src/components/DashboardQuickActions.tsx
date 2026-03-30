import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./DashboardQuickActions.css";

const baseActions = [
  {
    name: "Opportunities",
    path: "/games",
    description: "Find open games, cover requests, and available opportunities.",
  },
  {
    name: "Cover Requests",
    path: "/cover-requests",
    description: "Manage your requests and see games that need cover.",
  },
  {
    name: "Events",
    path: "/events",
    description: "View event assignments and join open event opportunities.",
  },
  {
    name: "Reports",
    path: "/reports",
    description: "Submit and track reports for your recently completed games.",
  },
  {
    name: "Earnings",
    path: "/earnings",
    description: "Track your claims, mileage totals, and payment breakdowns.",
  },
] as const;

export default function DashboardQuickActions() {
  const { user } = useAuth();

  const isRefereeUser = Boolean(user?.referee_profile);
  const hasEventManagerScope = Boolean(user?.allowed_upload_event_types?.length);

  const actions = baseActions.filter(
    (action) => !((isRefereeUser && !hasEventManagerScope) && action.path === "/events")
  );

  return (
    <section className="dashboard-quick-actions">
      <h2>Quick Actions</h2>

      <div className="dashboard-action-grid">
        {actions.map((action) => (
          <Link key={action.path} to={action.path} className="dashboard-action-card">
            <h3>{action.name}</h3>
            <p>{action.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
