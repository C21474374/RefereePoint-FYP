import "./DashboardStats.css";

type StatItem = {
  label: string;
  value: string;
  detail?: string;
};

type DashboardStatsProps = {
  stats: StatItem[];
};

export default function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <section className="dashboard-stats">
      {stats.map((stat) => (
        <div key={stat.label} className="dashboard-stat-card">
          <p className="dashboard-stat-label">{stat.label}</p>
          <h3 className="dashboard-stat-value">{stat.value}</h3>
          {stat.detail && <p className="dashboard-stat-detail">{stat.detail}</p>}
        </div>
      ))}
    </section>
  );
}
