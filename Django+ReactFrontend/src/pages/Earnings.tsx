import { useEffect, useState } from "react";
import {
  getEarnings,
  updateHomeLocation,
  type EarningsPeriod,
  type EarningsResponse,
} from "../services/earnings";
import "../pages_css/Earnings.css";

type HomeFormState = {
  home_address: string;
  home_lat: number | null;
  home_lon: number | null;
};

export default function Earnings() {
  const [period, setPeriod] = useState<EarningsPeriod>("month");
  const [report, setReport] = useState<EarningsResponse | null>(null);
  const [homeForm, setHomeForm] = useState<HomeFormState>({
    home_address: "",
    home_lat: null,
    home_lon: null,
  });
  const [loading, setLoading] = useState(true);
  const [savingHome, setSavingHome] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [error, setError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [addressDirty, setAddressDirty] = useState(false);

  const loadReport = async (nextPeriod: EarningsPeriod) => {
    try {
      setLoading(true);
      setError("");
      const data = await getEarnings(nextPeriod);
      setReport(data);
      setHomeForm({
        home_address: data.home.home_address || "",
        home_lat: data.home.home_lat,
        home_lon: data.home.home_lon,
      });
      setAddressDirty(false);
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

  const handleSaveHome = async () => {
    const trimmedAddress = homeForm.home_address.trim();
    const hasCoordinates =
      homeForm.home_lat !== null && homeForm.home_lon !== null;

    if (!trimmedAddress && !hasCoordinates) {
      setAddressError("Enter a home address/postcode or use current location.");
      setError("Please provide home location details before saving.");
      return;
    }

    if (trimmedAddress && trimmedAddress.length < 3) {
      setAddressError("Please enter a more specific address or postcode.");
      setError("Address looks too short.");
      return;
    }

    try {
      setSavingHome(true);
      setError("");
      setLocationMessage("");
      setAddressError("");

      const savedHome = await updateHomeLocation({
        home_address: trimmedAddress,
        home_lat: addressDirty ? null : homeForm.home_lat,
        home_lon: addressDirty ? null : homeForm.home_lon,
      });

      await loadReport(period);
      setAddressDirty(false);
      if (savedHome.geocode_warning) {
        setError(String(savedHome.geocode_warning));
        setLocationMessage("Home address saved.");
      } else {
        setLocationMessage("Home location saved.");
      }
    } catch (err: any) {
      console.error(err);
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to update home location.";
      setError(detail);
      if (
        String(detail).includes("resolve that address") ||
        String(detail).includes("address")
      ) {
        setAddressError("Could not find that address/postcode. Try a more specific one.");
      }
    } finally {
      setSavingHome(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    setLocating(true);
    setError("");
    setLocationMessage("");
    setAddressError("");
    setAddressDirty(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setHomeForm((prev) => ({
          ...prev,
          home_lat: position.coords.latitude,
          home_lon: position.coords.longitude,
        }));
        setLocationMessage("Location captured. Save to apply it.");
        setLocating(false);
      },
      () => {
        setError("Could not access your location. Please allow location permission.");
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
      }
    );
  };

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
              Use Current Location or save a valid address/postcode.
            </p>
          )}
          <section className="earnings-section">
            <h2>Home Location</h2>
            <div className="earnings-home-grid">
              <label>
                <span>Home Address or Postcode</span>
                <input
                  type="text"
                  className={addressError ? "input-error" : ""}
                  value={homeForm.home_address}
                  onChange={(e) => {
                    setAddressError("");
                    setError("");
                    setAddressDirty(true);
                    setHomeForm((prev) => ({
                      ...prev,
                      home_address: e.target.value,
                    }));
                  }}
                  placeholder="Eircode/Postcode or address"
                />
                {addressError && (
                  <small className="earnings-inline-error">{addressError}</small>
                )}
              </label>
            </div>
            <div className="earnings-home-actions">
              <button
                className="earnings-location-btn"
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={locating}
              >
                {locating ? "Getting Location..." : "Use Current Location"}
              </button>
              <button
                className="earnings-save-home"
                onClick={handleSaveHome}
                disabled={savingHome}
              >
                {savingHome ? "Saving..." : "Save Home Location"}
              </button>
            </div>
            {locationMessage && <p className="earnings-info">{locationMessage}</p>}
            <p className="earnings-note">
              Save with address/postcode to geocode automatically, or use current location.
              Tolls, taxis, and parking are excluded.
            </p>
          </section>

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
