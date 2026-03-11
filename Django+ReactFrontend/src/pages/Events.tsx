export default function Events() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Events</h1>
      </div>
      <p className="page-description">Training sessions, meetings, assessments and other scheduled events.</p>

      <div className="filters">
        <select>
          <option value="">All Event Types</option>
          <option value="training">Training</option>
          <option value="meeting">Meeting</option>
          <option value="assessment">Assessment</option>
        </select>
        <input type="date" />
        <select>
          <option value="">All Locations</option>
        </select>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Date</th>
              <th>Time</th>
              <th>Location</th>
              <th>Type</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="empty-state">
                No upcoming events
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
