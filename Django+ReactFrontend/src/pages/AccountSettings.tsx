import { useEffect, useState } from "react";
import AppIcon from "../components/AppIcon";
import { useAuth } from "../context/AuthContext";
import { switchTestingRole, type AccountType } from "../services/auth";
import { updateHomeLocation } from "../services/earnings";
import {
  getAppointedAvailability,
  updateAppointedAvailability,
  type AppointedAvailabilityDay,
} from "../services/appointedAvailability";
import "../pages_css/AccountSettings.css";

const ROLE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: "REFEREE", label: "Referee" },
  { value: "CLUB", label: "Club" },
  { value: "SCHOOL", label: "School" },
  { value: "COLLEGE", label: "College" },
  { value: "DOA", label: "DOA" },
  { value: "NL", label: "National League" },
];

function getInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string | null | undefined
) {
  const first = (firstName || "").trim().charAt(0).toUpperCase();
  const last = (lastName || "").trim().charAt(0).toUpperCase();
  if (first && last) {
    return `${first}${last}`;
  }
  if (first) {
    return first;
  }
  if (email) {
    return email.charAt(0).toUpperCase();
  }
  return "R";
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function buildTimeOptions(windowStart: string, windowEnd: string) {
  const start = timeToMinutes(windowStart);
  const end = timeToMinutes(windowEnd);
  const options: string[] = [];
  for (let minute = start; minute <= end; minute += 30) {
    const hours = Math.floor(minute / 60)
      .toString()
      .padStart(2, "0");
    const mins = (minute % 60).toString().padStart(2, "0");
    options.push(`${hours}:${mins}`);
  }
  return options;
}

export default function AccountSettings() {
  const { user, refreshUser } = useAuth();
  const isRefereeUser = Boolean(user?.referee_profile);
  const [selectedRole, setSelectedRole] = useState<AccountType>("REFEREE");
  const [switchingRole, setSwitchingRole] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [roleSuccess, setRoleSuccess] = useState("");
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilitySuccess, setAvailabilitySuccess] = useState("");
  const [availabilityDraft, setAvailabilityDraft] = useState<AppointedAvailabilityDay[]>([]);
  const [availabilityPendingFrom, setAvailabilityPendingFrom] = useState<string | null>(null);
  const [homeAddress, setHomeAddress] = useState("");
  const [homeLat, setHomeLat] = useState<number | null>(null);
  const [homeLon, setHomeLon] = useState<number | null>(null);
  const [homeSaving, setHomeSaving] = useState(false);
  const [homeLocating, setHomeLocating] = useState(false);
  const [homeMessage, setHomeMessage] = useState("");
  const [homeError, setHomeError] = useState("");
  const [homeAddressError, setHomeAddressError] = useState("");
  const [homeAddressDirty, setHomeAddressDirty] = useState(false);

  useEffect(() => {
    if (user?.account_type) {
      setSelectedRole(user.account_type);
    }
  }, [user?.account_type]);

  useEffect(() => {
    setHomeAddress(user?.home_address || "");
    setHomeLat(user?.home_lat ?? null);
    setHomeLon(user?.home_lon ?? null);
    setHomeAddressDirty(false);
  }, [user?.home_address, user?.home_lat, user?.home_lon]);

  useEffect(() => {
    if (!isRefereeUser) {
      setAvailabilityDraft([]);
      setAvailabilityPendingFrom(null);
      return;
    }

    async function loadAvailability() {
      try {
        setAvailabilityLoading(true);
        setAvailabilityError("");
        const response = await getAppointedAvailability();
        setAvailabilityDraft(response.pending || response.current);
        setAvailabilityPendingFrom(response.pending_effective_from);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load appointed availability.";
        setAvailabilityError(message);
      } finally {
        setAvailabilityLoading(false);
      }
    }

    void loadAvailability();
  }, [isRefereeUser]);

  const fullName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "User";
  const grade = user?.referee_profile?.grade?.replaceAll("_", " ") || "N/A";
  const roleLabel = user?.account_type_display || "Not set";
  const initials = getInitials(user?.first_name, user?.last_name, user?.email);

  const handleRoleSwitch = async () => {
    try {
      setSwitchingRole(true);
      setRoleError("");
      setRoleSuccess("");
      await switchTestingRole(selectedRole);
      await refreshUser();
      const selectedLabel =
        ROLE_OPTIONS.find((option) => option.value === selectedRole)?.label || selectedRole;
      setRoleSuccess(`Switched role to ${selectedLabel} (temporary testing bypass).`);
      window.dispatchEvent(new Event("refereepoint:data-refresh"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to switch role.";
      setRoleError(message);
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleAvailabilityDayChange = (
    dayCode: AppointedAvailabilityDay["day_of_week"],
    patch: Partial<Pick<AppointedAvailabilityDay, "available" | "start_time" | "end_time">>
  ) => {
    setAvailabilityDraft((prev) =>
      prev.map((item) => {
        if (item.day_of_week !== dayCode) {
          return item;
        }

        const next = { ...item, ...patch };
        if (!next.available) {
          return {
            ...next,
            start_time: "",
            end_time: "",
          };
        }

        const defaultStart = item.window_start;
        const defaultEndOptions = buildTimeOptions(item.window_start, item.window_end).filter(
          (value) => timeToMinutes(value) > timeToMinutes(defaultStart)
        );
        const defaultEnd = defaultEndOptions.length > 0 ? defaultEndOptions[0] : item.window_end;

        const startTime = next.start_time || defaultStart;
        let endTime = next.end_time || defaultEnd;
        if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
          const nextEndOptions = buildTimeOptions(item.window_start, item.window_end).filter(
            (value) => timeToMinutes(value) > timeToMinutes(startTime)
          );
          endTime = nextEndOptions.length > 0 ? nextEndOptions[0] : endTime;
        }

        return {
          ...next,
          start_time: startTime,
          end_time: endTime,
        };
      })
    );
    setAvailabilityError("");
    setAvailabilitySuccess("");
  };

  const handleSaveAvailability = async () => {
    try {
      setAvailabilitySaving(true);
      setAvailabilityError("");
      setAvailabilitySuccess("");
      const response = await updateAppointedAvailability(availabilityDraft);
      setAvailabilityDraft(response.pending || response.current);
      setAvailabilityPendingFrom(response.pending_effective_from);
      setAvailabilitySuccess(
        response.detail || "Availability update saved for the next month."
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save appointed availability.";
      setAvailabilityError(message);
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const handleSaveHomeLocation = async () => {
    const trimmedAddress = homeAddress.trim();
    const hasCoordinates = homeLat !== null && homeLon !== null;

    if (!trimmedAddress && !hasCoordinates) {
      setHomeAddressError("Enter a home address/postcode or use current location.");
      setHomeError("Please provide home location details before saving.");
      return;
    }

    if (trimmedAddress && trimmedAddress.length < 3) {
      setHomeAddressError("Please enter a more specific address or postcode.");
      setHomeError("Address looks too short.");
      return;
    }

    try {
      setHomeSaving(true);
      setHomeError("");
      setHomeMessage("");
      setHomeAddressError("");

      const response = await updateHomeLocation({
        home_address: trimmedAddress,
        home_lat: homeAddressDirty ? null : homeLat,
        home_lon: homeAddressDirty ? null : homeLon,
      });

      await refreshUser();
      setHomeAddressDirty(false);
      if (response.geocode_warning) {
        setHomeError(String(response.geocode_warning));
        setHomeMessage("Home address saved.");
      } else {
        setHomeMessage("Home location saved.");
      }
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Failed to update home location.";
      setHomeError(detail);
      if (String(detail).toLowerCase().includes("address")) {
        setHomeAddressError("Could not find that address/postcode. Try a more specific one.");
      }
    } finally {
      setHomeSaving(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setHomeError("Geolocation is not supported in this browser.");
      return;
    }

    setHomeLocating(true);
    setHomeError("");
    setHomeMessage("");
    setHomeAddressError("");
    setHomeAddressDirty(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setHomeLat(position.coords.latitude);
        setHomeLon(position.coords.longitude);
        setHomeMessage("Location captured. Save to apply it.");
        setHomeLocating(false);
      },
      () => {
        setHomeError("Could not access your location. Please allow location permission.");
        setHomeLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
      }
    );
  };

  return (
    <div className="account-settings-page">
      <div className="account-settings-header">
        <h1 className="page-title-with-icon">
          <AppIcon name="settings" className="page-title-icon" />
          <span>Account Settings</span>
        </h1>
        <p>Manage your account details. Profile picture upload will be added next.</p>
      </div>

      <section className="account-settings-card">
        <div className="account-profile-row">
          <span className="account-profile-avatar" aria-hidden="true">
            {initials}
          </span>
          <div>
            <h2>{fullName}</h2>
            <p>{user?.email || "Email unavailable"}</p>
            <span className="account-profile-coming-soon">Profile photo upload coming soon</span>
          </div>
        </div>
      </section>

      <section className="account-settings-card">
        <h2 className="section-title-with-icon">
          <AppIcon name="user" className="section-title-icon" />
          <span>Profile Details</span>
        </h2>
        <div className="account-settings-grid">
          <article>
            <span>{isRefereeUser ? "Grade" : "Role"}</span>
            <p>{isRefereeUser ? grade : roleLabel}</p>
          </article>
          <article>
            <span>Phone Number</span>
            <p>{user?.phone_number || "Not set"}</p>
          </article>
          <article>
            <span>BIPIN Number</span>
            <p>{user?.bipin_number || "Not set"}</p>
          </article>
          <article>
            <span>Home Address</span>
            <p>{user?.home_address || "Not set"}</p>
          </article>
        </div>
      </section>

      {isRefereeUser && (
        <section className="account-settings-card">
          <h2 className="section-title-with-icon">
            <AppIcon name="home" className="section-title-icon" />
            <span>Home Location</span>
          </h2>
          <p className="account-settings-availability-copy">
            Mileage is calculated from this address/location. Save with address/postcode to geocode
            automatically, or use current location.
          </p>
          {(homeLat === null || homeLon === null) && (
            <p className="account-settings-testing-error">
              Home coordinates are missing, so mileage cannot be calculated yet.
            </p>
          )}

          {homeError && <p className="account-settings-testing-error">{homeError}</p>}
          {homeMessage && <p className="account-settings-testing-success">{homeMessage}</p>}

          <div className="account-settings-home-grid">
            <label>
              <span>Home Address or Postcode</span>
              <input
                type="text"
                className={homeAddressError ? "input-error" : ""}
                value={homeAddress}
                onChange={(event) => {
                  setHomeAddress(event.target.value);
                  setHomeAddressDirty(true);
                  setHomeAddressError("");
                  setHomeError("");
                }}
                placeholder="Eircode/Postcode or address"
              />
              {homeAddressError && (
                <small className="account-settings-inline-error">{homeAddressError}</small>
              )}
            </label>
          </div>
          <div className="account-settings-home-actions">
            <button
              type="button"
              className="account-settings-home-location-btn"
              onClick={handleUseCurrentLocation}
              disabled={homeLocating}
            >
              <span className="button-with-icon">
                <AppIcon name="home" />
                <span>{homeLocating ? "Getting Location..." : "Use Current Location"}</span>
              </span>
            </button>
            <button
              type="button"
              className="account-settings-home-save-btn"
              onClick={handleSaveHomeLocation}
              disabled={homeSaving}
            >
              <span className="button-with-icon">
                <AppIcon name="settings" />
                <span>{homeSaving ? "Saving..." : "Save Home Location"}</span>
              </span>
            </button>
          </div>
          <p className="account-settings-availability-copy">
            Tolls, taxis, and parking are excluded.
          </p>
        </section>
      )}

      {isRefereeUser && (
        <section className="account-settings-card">
          <h2 className="section-title-with-icon">
            <AppIcon name="calendar" className="section-title-icon" />
            <span>Appointed Games Availability</span>
          </h2>
          <p className="account-settings-availability-copy">
            Monday-Friday availability window is 19:00-22:00. Saturday-Sunday is 10:00-22:00.
            Changes saved here become active on the first day of next month.
          </p>
          {availabilityPendingFrom && (
            <p className="account-settings-availability-pending">
              Pending update effective from {availabilityPendingFrom}.
            </p>
          )}

          {availabilityError && (
            <p className="account-settings-testing-error">{availabilityError}</p>
          )}
          {availabilitySuccess && (
            <p className="account-settings-testing-success">{availabilitySuccess}</p>
          )}

          {availabilityLoading ? (
            <p className="account-settings-availability-copy">Loading availability...</p>
          ) : (
            <div className="account-settings-availability-list">
              {availabilityDraft.map((item) => {
                const options = buildTimeOptions(item.window_start, item.window_end);
                const endOptions = options.filter(
                  (value) => timeToMinutes(value) > timeToMinutes(item.start_time || item.window_start)
                );

                return (
                  <div key={item.day_of_week} className="account-settings-availability-row">
                    <label className="account-settings-availability-toggle">
                      <input
                        type="checkbox"
                        checked={item.available}
                        onChange={(event) =>
                          handleAvailabilityDayChange(item.day_of_week, {
                            available: event.target.checked,
                          })
                        }
                      />
                      <span>{item.day_label}</span>
                    </label>
                    <div className="account-settings-availability-times">
                      <select
                        value={item.start_time || item.window_start}
                        disabled={!item.available}
                        onChange={(event) =>
                          handleAvailabilityDayChange(item.day_of_week, {
                            start_time: event.target.value,
                          })
                        }
                      >
                        {options.slice(0, -1).map((timeValue) => (
                          <option key={`${item.day_of_week}-start-${timeValue}`} value={timeValue}>
                            {timeValue}
                          </option>
                        ))}
                      </select>
                      <span>to</span>
                      <select
                        value={item.end_time || item.window_end}
                        disabled={!item.available}
                        onChange={(event) =>
                          handleAvailabilityDayChange(item.day_of_week, {
                            end_time: event.target.value,
                          })
                        }
                      >
                        {(endOptions.length > 0 ? endOptions : options.slice(1)).map((timeValue) => (
                          <option key={`${item.day_of_week}-end-${timeValue}`} value={timeValue}>
                            {timeValue}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="account-settings-availability-actions">
            <button
              type="button"
              onClick={handleSaveAvailability}
              disabled={availabilitySaving || availabilityLoading}
            >
              <span className="button-with-icon">
                <AppIcon name="settings" />
                <span>{availabilitySaving ? "Saving..." : "Save Availability Changes"}</span>
              </span>
            </button>
          </div>
        </section>
      )}

      <section className="account-settings-card">
        <h2 className="section-title-with-icon">
          <AppIcon name="approvals" className="section-title-icon" />
          <span>Testing Bypass (Temporary)</span>
        </h2>
        <p className="account-settings-testing-copy">
          Switch account role on the fly for faster testing. This is a temporary cheat flow.
        </p>

        {roleError && <p className="account-settings-testing-error">{roleError}</p>}
        {roleSuccess && <p className="account-settings-testing-success">{roleSuccess}</p>}

        <div className="account-settings-testing-controls">
          <label>
            <span>Account Role</span>
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as AccountType)}
              disabled={switchingRole}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleRoleSwitch}
            disabled={switchingRole || !user || selectedRole === user.account_type}
          >
            <span className="button-with-icon">
              <AppIcon name="settings" />
              <span>{switchingRole ? "Switching..." : "Switch Role"}</span>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
