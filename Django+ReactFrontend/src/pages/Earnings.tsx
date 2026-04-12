import { useEffect, useState } from "react";
import {
  getEarnings,
  type EarningsPeriod,
  type EarningsResponse,
} from "../services/earnings";
import "../pages_css/Earnings.css";

export default function Earnings() {
  const [period, setPeriod] = useState<EarningsPeriod>("month");
  const [report, setReport] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = async (nextPeriod: EarningsPeriod) => {
    try {
      setLoading(true);
      setError("");
      const data = await getEarnings(nextPeriod);
      setReport(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load earnings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(period);
  }, [period]);

  return (
    <div className="earnings-page">
      <div className="earnings-header">
        <h1>Earnings</h1>
        <p>DOA appointed games only. NL claims will be added later.</p>
      </div>

      <div className="earnings-controls">
        <select
          className="earnings-period-select"
          value={period}
          onChange={(e) => setPeriod(e.target.value as EarningsPeriod)}
        >
          <option value="month">This Month</option>
          <option value="year">This Year</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {loading && <p className="earnings-info">Loading earnings...</p>}
      {error && <p className="earnings-error">{error}</p>}

      {!loading && report && (
        <>
          {(report.home.home_lat === null || report.home.home_lon === null) && (
            <p className="earnings-error">
              Home coordinates are missing, so mileage cannot be calculated yet.
              Set your home location in Account Settings.
            </p>
          )}

          <section className="earnings-section">
            <h2>Summary</h2>
            <div className="earnings-summary-grid">
              <div className="earnings-summary-card">
                <p>Appointed DOA Games</p>
                <h3>{report.totals.games_count}</h3>
              </div>
              <div className="earnings-summary-card">
                <p>Base Fee Total</p>
                <h3>EUR {report.totals.base_fee_total}</h3>
              </div>
              <div className="earnings-summary-card">
                <p>Travel Total</p>
                <h3>EUR {report.totals.travel_total}</h3>
              </div>
              <div className="earnings-summary-card">
                <p>Total Claim Amount</p>
                <h3>EUR {report.totals.total_claim_amount}</h3>
              </div>
            </div>
            <p className="earnings-note">
              Missing distance games: {report.totals.missing_distance_games}
            </p>
          </section>

          <section className="earnings-section">
            <h2>Per-Game Breakdown</h2>
            {report.items.length === 0 ? (
              <p className="earnings-info">No appointed DOA games found for this period.</p>
            ) : (
              <div className="earnings-items">
                {report.items.map((item) => (
                  <article key={item.assignment_id} className="earnings-item">
                    <div className="earnings-item-top">
                      <div>
                        <h3 className="earnings-item-title">
                          {item.home_team_name || "Home Team"} vs {item.away_team_name || "Away Team"}
                        </h3>
                        <p className="earnings-item-subtitle">
                          {item.date} {item.time} | {item.venue_name || "Venue TBC"} | {item.role_display}
                        </p>
                      </div>
                      <span className="earnings-item-total">EUR {item.total}</span>
                    </div>
                    <div className="earnings-item-meta">
                      <span className="earnings-pill">Base: EUR {item.base_fee}</span>
                      <span className="earnings-pill">Travel: EUR {item.travel_amount}</span>
                      <span className="earnings-pill">Mileage: {item.mileage_km} km</span>
                      <span className="earnings-pill">{item.travel_mode_display}</span>
                      {item.is_back_to_back_same_venue && (
                        <span className="earnings-pill">Back-to-back same venue (mileage excluded)</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
