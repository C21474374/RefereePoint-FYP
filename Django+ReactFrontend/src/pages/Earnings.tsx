import { useEffect, useMemo, useState } from "react";
import AppIcon from "../components/AppIcon";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  confirmAdminMonthlyPayment,
  getAdminMonthlyEarnings,
  getEarnings,
  type AdminMonthlyEarningsResponse,
  type AdminPaymentRow,
  type EarningsGameType,
  type EarningsResponse,
} from "../services/earnings";
import "./Earnings.css";

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

function formatDateTimeLabel(value?: string) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Earnings() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const isAdminEarningsView = user?.account_type === "DOA" || user?.account_type === "NL";
  const accountGameType: EarningsGameType =
    user?.account_type === "NL" ? "NL" : "DOA";

  const [gameType, setGameType] = useState<EarningsGameType>(accountGameType);
  const [selectedMonthValue, setSelectedMonthValue] = useState(currentYearMonthValue());
  const [monthOptions, setMonthOptions] = useState<
    Array<{
      value: string;
      label: string;
      is_finalized?: boolean;
    }>
  >([]);

  const [refereeReport, setRefereeReport] = useState<EarningsResponse | null>(null);
  const [adminReport, setAdminReport] = useState<AdminMonthlyEarningsResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingExpanded, setPendingExpanded] = useState(true);
  const [approvedExpanded, setApprovedExpanded] = useState(false);
  const [confirmingRefereeId, setConfirmingRefereeId] = useState<number | null>(null);

  useEffect(() => {
    if (isAdminEarningsView) {
      setGameType(accountGameType);
    }
  }, [accountGameType, isAdminEarningsView]);

  const loadRefereeReport = async (nextGameType: EarningsGameType, nextMonthValue: string) => {
    const parsed = parseYearMonth(nextMonthValue) || parseYearMonth(currentYearMonthValue());
    if (!parsed) {
      setError("Invalid month selected.");
      return;
    }

    const data = await getEarnings({
      gameType: nextGameType,
      year: parsed.year,
      month: parsed.month,
    });
    setRefereeReport(data);
    setAdminReport(null);
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
  };

  const loadAdminReport = async (nextGameType: EarningsGameType, nextMonthValue: string) => {
    const parsed = parseYearMonth(nextMonthValue) || parseYearMonth(currentYearMonthValue());
    if (!parsed) {
      setError("Invalid month selected.");
      return;
    }

    const data = await getAdminMonthlyEarnings({
      gameType: nextGameType,
      year: parsed.year,
      month: parsed.month,
    });
    setAdminReport(data);
    setRefereeReport(null);
    setMonthOptions(
      (data.available_months || []).map((item) => ({
        value: item.value,
        label: item.label,
      }))
    );
    if (data.selected_month?.value && data.selected_month.value !== nextMonthValue) {
      setSelectedMonthValue(data.selected_month.value);
    }
  };

  const loadPage = async (nextGameType: EarningsGameType, nextMonthValue: string) => {
    try {
      setLoading(true);
      setError("");
      if (isAdminEarningsView) {
        await loadAdminReport(nextGameType, nextMonthValue);
      } else {
        await loadRefereeReport(nextGameType, nextMonthValue);
      }
    } catch (loadError) {
      setError("Failed to load earnings.");
      showToast("Failed to load earnings.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(gameType, selectedMonthValue);
  }, [gameType, selectedMonthValue, isAdminEarningsView]);

  const handleConfirmPayment = async (item: AdminPaymentRow) => {
    const parsed = parseYearMonth(selectedMonthValue) || parseYearMonth(currentYearMonthValue());
    if (!parsed) {
      showToast("Invalid month selected.", "error");
      return;
    }

    try {
      setConfirmingRefereeId(item.referee_id);
      await confirmAdminMonthlyPayment({
        refereeId: item.referee_id,
        year: parsed.year,
        month: parsed.month,
        gameType,
      });
      showToast(`Payment confirmed for ${item.referee_name}.`, "success");
      await loadPage(gameType, selectedMonthValue);
    } catch {
      showToast("Failed to confirm payment.", "error");
    } finally {
      setConfirmingRefereeId(null);
    }
  };

  const adminSummary = useMemo(() => {
    if (!adminReport) {
      return {
        pendingCount: 0,
        approvedCount: 0,
        pendingTotal: "0.00",
        approvedTotal: "0.00",
      };
    }

    const pendingTotal = adminReport.pending_payments
      .reduce((sum, item) => sum + Number(item.total_claim_amount || 0), 0)
      .toFixed(2);
    const approvedTotal = adminReport.approved_payments
      .reduce((sum, item) => sum + Number(item.total_claim_amount || 0), 0)
      .toFixed(2);

    return {
      pendingCount: adminReport.pending_payments.length,
      approvedCount: adminReport.approved_payments.length,
      pendingTotal,
      approvedTotal,
    };
  }, [adminReport]);

  const gameTypeOptions: EarningsGameType[] = isAdminEarningsView
    ? [accountGameType]
    : ["DOA", "NL"];
  const totalClaimAmountValue = Number(refereeReport?.totals.total_claim_amount || 0);
  const hasPositiveTotalClaimAmount = totalClaimAmountValue > 0;

  return (
    <div className="earnings-page">
      <div className="earnings-header">
        <h1 className="page-title-with-icon">
          <AppIcon name="euro" className="page-title-icon" />
          <span>Earnings</span>
        </h1>
        <p>
          {isAdminEarningsView
            ? "Review monthly referee earnings and confirm payments."
            : "View monthly appointed claims by type. DOA and NL are tracked separately."}
        </p>
      </div>

      <div className="earnings-controls">
        <div className="earnings-type-toggle" role="tablist" aria-label="Earnings game type">
          {gameTypeOptions.map((typeOption) => (
            <button
              key={typeOption}
              type="button"
              className={`earnings-type-btn ${gameType === typeOption ? "active" : ""}`}
              onClick={() => setGameType(typeOption)}
              aria-pressed={gameType === typeOption}
            >
              {typeOption}
            </button>
          ))}
        </div>

        <select
          className="earnings-month-select"
          value={selectedMonthValue}
          onChange={(event) => setSelectedMonthValue(event.target.value)}
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

      {!loading && !error && isAdminEarningsView && adminReport && (
        <>
          <section className="earnings-section">
            <h2 className="section-title-with-icon">
              <AppIcon name="approvals" className="section-title-icon" />
              <span>Monthly Payment Overview</span>
            </h2>
            <div className="earnings-summary-grid">
              <div className="earnings-summary-card">
                <p>Pending Referees</p>
                <h3>{adminSummary.pendingCount}</h3>
              </div>
              <div className="earnings-summary-card earnings-summary-card-total earnings-summary-card-pending-total">
                <p>Pending Total</p>
                <h3>€{adminSummary.pendingTotal}</h3>
              </div>
              <div className="earnings-summary-card">
                <p>Approved Referees</p>
                <h3>{adminSummary.approvedCount}</h3>
              </div>
              <div className="earnings-summary-card earnings-summary-card-total">
                <p>Approved Total</p>
                <h3>€{adminSummary.approvedTotal}</h3>
              </div>
            </div>
          </section>

          <section className="earnings-section earnings-admin-section">
            <div className="earnings-admin-section-header">
              <h2 className="section-title-with-icon">
                <AppIcon name="time" className="section-title-icon" />
                <span>Pending Payments</span>
              </h2>
              <p>Referees awaiting payment confirmation for the selected month.</p>
            </div>

            {pendingExpanded && (
              <div className="earnings-admin-section-content">
                {adminReport.pending_payments.length === 0 ? (
                  <p className="earnings-info">No pending payments for this month.</p>
                ) : (
                  <div className="earnings-admin-list">
                    {adminReport.pending_payments.map((item) => (
                      <article key={`pending-${item.referee_id}`} className="earnings-admin-card">
                        <div className="earnings-admin-card-left">
                          <h3>{item.referee_name}</h3>
                          <p>{item.referee_phone || item.referee_email}</p>
                          <p>{item.games_count} game(s)</p>
                        </div>
                        <div className="earnings-admin-card-right">
                          <span className="earnings-item-total">€{item.total_claim_amount}</span>
                          <button
                            type="button"
                            className="earnings-admin-confirm-btn"
                            onClick={() => {
                              void handleConfirmPayment(item);
                            }}
                            disabled={confirmingRefereeId === item.referee_id}
                          >
                            {confirmingRefereeId === item.referee_id
                              ? "Confirming..."
                              : "Confirm Payment"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className="earnings-admin-section-toggle"
              onClick={() => setPendingExpanded((prev) => !prev)}
              aria-expanded={pendingExpanded}
            >
              <span className="inline-icon-label">
                <AppIcon name={pendingExpanded ? "filter" : "plus"} />
                <span>{pendingExpanded ? "Collapse" : "Expand"}</span>
              </span>
            </button>
          </section>

          <section className="earnings-section earnings-admin-section">
            <div className="earnings-admin-section-header">
              <h2 className="section-title-with-icon">
                <AppIcon name="cover" className="section-title-icon" />
                <span>Approved Payments</span>
              </h2>
              <p>Referees already confirmed as paid for the selected month.</p>
            </div>

            {approvedExpanded && (
              <div className="earnings-admin-section-content">
                {adminReport.approved_payments.length === 0 ? (
                  <p className="earnings-info">No approved payments for this month.</p>
                ) : (
                  <div className="earnings-admin-list">
                    {adminReport.approved_payments.map((item) => (
                      <article key={`approved-${item.payment_id || item.referee_id}`} className="earnings-admin-card">
                        <div className="earnings-admin-card-left">
                          <h3>{item.referee_name}</h3>
                          <p>{item.referee_phone || item.referee_email}</p>
                          <p>{item.games_count} game(s)</p>
                          <p className="earnings-admin-approved-meta">
                            Confirmed {formatDateTimeLabel(item.confirmed_at)}
                          </p>
                        </div>
                        <div className="earnings-admin-card-right">
                          <span className="earnings-item-total">€{item.total_claim_amount}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className="earnings-admin-section-toggle"
              onClick={() => setApprovedExpanded((prev) => !prev)}
              aria-expanded={approvedExpanded}
            >
              <span className="inline-icon-label">
                <AppIcon name={approvedExpanded ? "filter" : "plus"} />
                <span>{approvedExpanded ? "Collapse" : "Expand"}</span>
              </span>
            </button>
          </section>
        </>
      )}

      {!loading && !error && !isAdminEarningsView && refereeReport && (
        <>
          {(refereeReport.home.home_lat === null || refereeReport.home.home_lon === null) && (
            <p className="earnings-error">
              Home coordinates are missing, so mileage cannot be calculated yet.
              Set your home location in Account Settings.
            </p>
          )}

          <section className="earnings-section">
            <h2 className="section-title-with-icon">
              <AppIcon name="whistle" className="section-title-icon" />
              <span>Summary</span>
            </h2>
            <div className="earnings-summary-grid">
              <div className="earnings-summary-card">
                <p>Appointed {refereeReport.rules.game_type_display} Games</p>
                <h3>{refereeReport.totals.games_count}</h3>
              </div>
              <div className="earnings-summary-card">
                <p>Base Fee Total</p>
                <h3>€{refereeReport.totals.base_fee_total}</h3>
              </div>
              <div className="earnings-summary-card">
                <p>Travel Total</p>
                <h3>€{refereeReport.totals.travel_total}</h3>
              </div>
              <div className="earnings-summary-card earnings-summary-card-total">
                <p>Total Claim Amount</p>
                <h3 className={hasPositiveTotalClaimAmount ? "" : "earnings-summary-value-neutral"}>
                  €{refereeReport.totals.total_claim_amount}
                </h3>
              </div>
            </div>
            {refereeReport.selected_month?.is_finalized && (
              <p className="earnings-note">Month finalized and saved.</p>
            )}
          </section>

          <section className="earnings-section">
            <h2 className="section-title-with-icon">
              <AppIcon name="basketball" className="section-title-icon" />
              <span>Per-Game Breakdown</span>
            </h2>
            {refereeReport.items.length === 0 ? (
              <p className="earnings-info">
                No appointed {refereeReport.rules.game_type_display} games found for this month.
              </p>
            ) : (
              <div className="earnings-items">
                {refereeReport.items.map((item) => (
                  <article key={item.assignment_id} className="earnings-item">
                    <div className="earnings-item-top">
                      <div>
                        <h3 className="earnings-item-title">
                          {item.home_team_name || "Home Team"} vs {item.away_team_name || "Away Team"}
                        </h3>
                        <p className="earnings-item-subtitle">
                          <span className="earnings-item-date-time">
                            {item.date} {item.time}
                          </span>{" "}
                          | {item.venue_name || "Venue TBC"} | {item.role_display}
                        </p>
                      </div>
                      <span className="earnings-item-total">€{item.total}</span>
                    </div>
                    <div className="earnings-item-meta">
                      <span className="earnings-pill">Base: €{item.base_fee}</span>
                      <span className="earnings-pill">Travel: €{item.travel_amount}</span>
                      <span className="earnings-pill">Mileage: {item.mileage_km} km</span>
                      {item.travel_mode_display.trim().toLowerCase() !== "mileage" && (
                        <span className="earnings-pill">{item.travel_mode_display}</span>
                      )}
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
