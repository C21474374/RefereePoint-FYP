import { useEffect, useState } from "react";
import AppIcon from "../components/AppIcon";
import {
  getEarnings,
  type EarningsGameType,
  type EarningsResponse,
} from "../services/earnings";
import { useToast } from "../context/ToastContext";
import "../pages_css/Earnings.css";

function currentYearMonthValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function parseYearMonth(value: string) {
  const matched = /^(\d{4})-(\d{2})$/.exec(value || "");
  if (!matched) {
    return null;
  }
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export default function Earnings() {
  const { showToast } = useToast();
  const [gameType, setGameType] = useState<EarningsGameType>("DOA");
  const [selectedMonthValue, setSelectedMonthValue] = useState(currentYearMonthValue());
  const [monthOptions, setMonthOptions] = useState<
    Array<{
      value: string;
      label: string;
      is_finalized: boolean;
    }>
  >([]);
  const [report, setReport] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = async (nextGameType: EarningsGameType, nextMonthValue: string) => {
    const parsed = parseYearMonth(nextMonthValue) || parseYearMonth(currentYearMonthValue());
    if (!parsed) {
      setError("Invalid month selected.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await getEarnings({
        gameType: nextGameType,
        year: parsed.year,
        month: parsed.month,
      });
      setReport(data);
      setMonthOptions(
        (data.available_months || []).map((item) => ({
          value: item.value,
          label: item.label,
          is_finalized: item.is_finalized,
        }))
      );
      if (data.selected_month?.value && data.selected_month.value !== nextMonthValue) {
        setSelectedMonthValue(data.selected_month.value);
      }
    } catch (err) {
      setError("Failed to load earnings.");
      showToast("Failed to load earnings.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(gameType, selectedMonthValue);
  }, [gameType, selectedMonthValue]);

  return (
    <div className="earnings-page">
      <div className="earnings-header">
        <h1 className="page-title-with-icon">
          <AppIcon name="earnings" className="page-title-icon" />
          <span>Earnings</span>
        </h1>
        <p>View monthly appointed claims by type. DOA(Dublin Officials Association) and NL(National League) are tracked separately.</p>
      </div>

      <div className="earnings-controls">
        <div className="earnings-type-toggle" role="tablist" aria-label="Earnings game type">
          <button
            type="button"
            className={`earnings-type-btn ${gameType === "DOA" ? "active" : ""}`}
            onClick={() => setGameType("DOA")}
            aria-pressed={gameType === "DOA"}
          >
            DOA
          </button>
          <button
            type="button"
            className={`earnings-type-btn ${gameType === "NL" ? "active" : ""}`}
            onClick={() => setGameType("NL")}
            aria-pressed={gameType === "NL"}
          >
            NL
          </button>
        </div>

        <select
          className="earnings-month-select"
          value={selectedMonthValue}
          onChange={(e) => setSelectedMonthValue(e.target.value)}
        >
          {monthOptions.length === 0 ? (
            <option value={selectedMonthValue}>{selectedMonthValue}</option>
          ) : (
            monthOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
                {item.is_finalized ? " (Saved)" : ""}
              </option>
            ))
          )}
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
            <h2 className="section-title-with-icon">
              <AppIcon name="dashboard" className="section-title-icon" />
              <span>Summary</span>
            </h2>
            <div className="earnings-summary-grid">
              <div className="earnings-summary-card">
                <p>Appointed {report.rules.game_type_display} Games</p>
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
            {report.selected_month?.is_finalized && (
              <p className="earnings-note">Month finalized and saved.</p>
            )}
          </section>

          <section className="earnings-section">
            <h2 className="section-title-with-icon">
              <AppIcon name="games" className="section-title-icon" />
              <span>Per-Game Breakdown</span>
            </h2>
            {report.items.length === 0 ? (
              <p className="earnings-info">
                No appointed {report.rules.game_type_display} games found for this month.
              </p>
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
