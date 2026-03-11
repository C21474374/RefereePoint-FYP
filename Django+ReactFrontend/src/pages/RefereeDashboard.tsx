export default function RefereeDashboard() {
  return (
    <div className="page">
      <div className="dashboard-welcome">
        <h1>Good morning, Referee</h1>
        <p>Here's an overview of your upcoming activity.</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-icon green" />
          </div>
          <h3>Upcoming Games</h3>
          <p className="stat">0</p>
          <p className="stat-label">This week</p>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-icon yellow" />
          </div>
          <h3>Pending Cover Requests</h3>
          <p className="stat">0</p>
          <p className="stat-label">Awaiting response</p>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-icon blue" />
          </div>
          <h3>This Month's Earnings</h3>
          <p className="stat">€0.00</p>
          <p className="stat-label">March 2026</p>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-icon purple" />
          </div>
          <h3>Upcoming Events</h3>
          <p className="stat">0</p>
          <p className="stat-label">Next 7 days</p>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Recent Activity</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Activity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3} className="empty-state">
                  No recent activity
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
