export default function Earnings() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Earnings</h1>
      </div>
      <p className="page-description">Track your game fees, payments, and outstanding balances.</p>

      <div className="earnings-summary">
        <div className="earnings-card">
          <h3>This Month</h3>
          <p className="amount">€0.00</p>
          <p className="amount-subtitle">March 2026</p>
        </div>
        <div className="earnings-card">
          <h3>This Year</h3>
          <p className="amount">€0.00</p>
          <p className="amount-subtitle">Jan - Mar 2026</p>
        </div>
        <div className="earnings-card">
          <h3>Pending Payment</h3>
          <p className="amount">€0.00</p>
          <p className="amount-subtitle">Awaiting payout</p>
        </div>
        <div className="earnings-card">
          <h3>Games Completed</h3>
          <p className="amount" style={{ color: '#60a5fa' }}>0</p>
          <p className="amount-subtitle">This year</p>
        </div>
      </div>

      <div className="table-container">
        <h2>Payment History</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Game</th>
              <th>Role</th>
              <th>Fee</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="empty-state">
                No earnings recorded yet
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
