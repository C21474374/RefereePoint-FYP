import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppIcon, { type AppIconName } from "./AppIcon";
import {
  canAccessConfigurePage,
  canAccessReportsPage,
  hasRefereeAccess,
} from "../utils/access";
import "./DashboardQuickActions.css";

const refereeActions = [
  {
    name: "Opportunities",
    path: "/games",
    icon: "opportunities" as AppIconName,
    description: "Find open games, cover requests, and available opportunities.",
  },
  {
    name: "Cover Requests",
    path: "/cover-requests",
    icon: "cover" as AppIconName,
    description: "Manage your requests and see games that need cover.",
  },
  {
    name: "Events",
    path: "/events",
    icon: "events" as AppIconName,
    description: "View event assignments and join open event opportunities.",
  },
  {
    name: "Reports",
    path: "/reports",
    icon: "reports" as AppIconName,
    description: "Submit and track reports for your recently completed games.",
  },
  {
    name: "Earnings",
    path: "/earnings",
    icon: "earnings" as AppIconName,
    description: "Track your claims, mileage totals, and payment breakdowns.",
  },
] as const;

const managerBaseActions = [
  {
    name: "Games",
    path: "/games",
    icon: "games" as AppIconName,
    description: "Upload and manage games posted by your organisation.",
  },
  {
    name: "Events",
    path: "/events",
    icon: "events" as AppIconName,
    description: "Upload and manage tournament events for your organisation.",
  },
] as const;

export default function DashboardQuickActions() {
  const { user } = useAuth();

  const isRefereeUser = hasRefereeAccess(user);
  const hasEventManagerScope = Boolean(user?.allowed_upload_event_types?.length);
  const canApproveAccounts = Boolean(user?.can_approve_accounts);
  const canConfigure = canAccessConfigurePage(user);
  const canViewReports = canAccessReportsPage(user);
  const managerActions = [
    ...managerBaseActions.filter(
      (action) => hasEventManagerScope || action.path !== "/events"
    ),
    ...(canViewReports
      ? [
          {
            name: "Reports",
            path: "/reports",
            icon: "reports" as AppIconName,
            description: "Review reports submitted by referees.",
          },
        ]
      : []),
    ...(canConfigure
      ? [
          {
            name: "Configure",
            path: "/configure",
            icon: "settings" as AppIconName,
            description: "Manage divisions and teams for appointed workflows.",
          },
        ]
      : []),
    ...(canApproveAccounts
      ? [
          {
            name: "Account Approvals",
            path: "/account-approvals",
            icon: "approvals" as AppIconName,
            description: "Review and approve pending account registrations.",
          },
        ]
      : []),
  ];

  const actions = isRefereeUser
    ? refereeActions.filter((action) => hasEventManagerScope || action.path !== "/events")
    : managerActions;

  return (
    <section className="dashboard-quick-actions">
      <h2 className="section-title-with-icon">
        <AppIcon name="plus" className="section-title-icon" />
        <span>Quick Actions</span>
      </h2>

      <div className="dashboard-action-grid">
        {actions.map((action) => (
          <Link key={action.path} to={action.path} className="dashboard-action-card">
            <h3 className="inline-icon-label">
              <AppIcon name={action.icon} />
              <span>{action.name}</span>
            </h3>
            <p>{action.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
