import type { ReactNode } from "react";
import "./DashboardSectionCard.css";

type DashboardSectionCardProps = {
  title: string;
  children?: ReactNode;
  emptyMessage?: string;
};

export default function DashboardSectionCard({
  title,
  children,
  emptyMessage = "Nothing to show.",
}: DashboardSectionCardProps) {
  const hasContent = !!children;

  return (
    <section className="dashboard-section-card">
      <div className="dashboard-section-header">
        <h2>{title}</h2>
      </div>

      <div className="dashboard-section-body">
        {hasContent ? children : (
          <p className="dashboard-empty-message">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}