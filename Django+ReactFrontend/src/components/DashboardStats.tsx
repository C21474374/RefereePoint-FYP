import AppIcon, { type AppIconName } from "./AppIcon";
import "./DashboardStats.css";

type StatItem = {
  label: string;
  value: string;
  detail?: string;
};

type DashboardStatsProps = {
  stats: StatItem[];
};

function iconForStatLabel(label: string): AppIconName {
  const normalized = label.toLowerCase();
  if (normalized.includes("earning") || normalized.includes("claim") || normalized.includes("mileage")) {
    return "earnings";
  }
  if (normalized.includes("approval")) {
    return "approvals";
  }
  if (normalized.includes("next") || normalized.includes("calendar")) {
    return "calendar";
  }
  if (normalized.includes("slot")) {
    return "user";
  }
  if (normalized.includes("upload")) {
    return "upload";
  }
  if (normalized.includes("game")) {
    return "games";
  }
  return "dashboard";
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <section className="dashboard-stats">
      {stats.map((stat) => (
        <div key={stat.label} className="dashboard-stat-card">
          <p className="dashboard-stat-label inline-icon-label">
            <AppIcon name={iconForStatLabel(stat.label)} />
            <span>{stat.label}</span>
          </p>
          <h3 className="dashboard-stat-value">{stat.value}</h3>
          {stat.detail && <p className="dashboard-stat-detail">{stat.detail}</p>}
        </div>
      ))}
    </section>
  );
}
