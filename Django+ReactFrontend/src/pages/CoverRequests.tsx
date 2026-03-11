export default function CoverRequests() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Cover Requests</h1>
        <button className="btn-primary">+ New Request</button>
      </div>
      <p className="page-description">Request cover for games you can't attend, or pick up available games.</p>

      <div className="tabs">
        <button className="tab active">My Requests</button>
        <button className="tab">Available to Cover</button>
        <button className="tab">Completed</button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Game</th>
              <th>Date</th>
              <th>Type</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Covered By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} className="empty-state">
                No cover requests yet
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
