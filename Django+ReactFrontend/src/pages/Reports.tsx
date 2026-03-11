export default function Reports() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Reports</h1>
        <button className="btn-primary">+ New Report</button>
      </div>
      <p className="page-description">Submit and manage your game reports.</p>

      <div className="tabs">
        <button className="tab active">All Reports</button>
        <button className="tab">Pending</button>
        <button className="tab">Submitted</button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Game</th>
              <th>Date</th>
              <th>Report Type</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="empty-state">
                No reports to display
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
