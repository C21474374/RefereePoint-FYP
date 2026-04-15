import { useEffect, useState } from "react";
import AppIcon from "../components/AppIcon";
import { useAuth } from "../context/AuthContext";
import {
  switchTestingRole,
  updateCurrentUserProfile,
  type AccountType,
} from "../services/auth";
import { updateHomeLocation } from "../services/earnings";
import {
  getAppointedAvailability,
  updateAppointedAvailability,
  type AppointedAvailabilityDay,
} from "../services/appointedAvailability";
import "./AccountSettings.css";

const ROLE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: "REFEREE", label: "Referee" },
  { value: "CLUB", label: "Club" },
  { value: "SCHOOL", label: "School" },
  { value: "COLLEGE", label: "College" },
  { value: "DOA", label: "DOA" },
  { value: "NL", label: "National League" },
];
// Local browser override for quickly enabling test-only role switching in UI.
const TESTING_ROLE_SWITCH_STORAGE_KEY = "refereepoint.testing-role-switch.enabled";

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

type ProfileFormState = {
  first_name: string;
  last_name: string;
  phone_number: string;
  organization_name: string;
  institution_head_phone: string;
};

export default function AccountSettings() {
  const { user, refreshUser } = useAuth();
  const isRefereeUser = Boolean(user?.referee_profile);
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    first_name: "",
    last_name: "",
    phone_number: "",
    organization_name: "",
    institution_head_phone: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
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
  const [testingRoleSwitchEnabled, setTestingRoleSwitchEnabled] = useState(false);

  useEffect(() => {
    if (user?.account_type) {
      setSelectedRole(user.account_type);
    }
  }, [user?.account_type]);

  useEffect(() => {
    setProfileForm({
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      phone_number: user?.phone_number || "",
      organization_name: user?.organization_name || "",
      institution_head_phone: user?.institution_head_phone || "",
    });
    setIsEditingProfile(false);
    setProfileError("");
    setProfileSuccess("");
  }, [
    user?.first_name,
    user?.last_name,
    user?.phone_number,
    user?.organization_name,
    user?.institution_head_phone,
  ]);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const persisted = window.localStorage.getItem(TESTING_ROLE_SWITCH_STORAGE_KEY);
      setTestingRoleSwitchEnabled(persisted === "true");
    } catch {
      setTestingRoleSwitchEnabled(false);
    }
  }, []);

  const fullName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "User";
  const grade = user?.referee_profile?.grade?.replaceAll("_", " ") || "N/A";
  const roleLabel = user?.account_type_display || "Not set";
  const initials = getInitials(user?.first_name, user?.last_name, user?.email);
  const currentAccountType = user?.account_type || "REFEREE";
  const testingRoleSwitchEnabledByEnv =
    String(import.meta.env.VITE_ENABLE_TESTING_ROLE_SWITCH || "").toLowerCase() === "true";
  // Env flag is the hard override; localStorage provides a per-browser toggle for dev convenience.
  const showTestingRoleSwitch =
    testingRoleSwitchEnabledByEnv || testingRoleSwitchEnabled;
  const showOrganizationField = ["CLUB", "SCHOOL", "COLLEGE"].includes(currentAccountType);
  const showInstitutionHeadPhoneField = ["SCHOOL", "COLLEGE"].includes(currentAccountType);
  const organizationLabel =
    currentAccountType === "SCHOOL"
      ? "School Name"
      : currentAccountType === "COLLEGE"
        ? "College Name"
        : "Club Name";

  const normalizedCurrent = {
    first_name: (user?.first_name || "").trim(),
    last_name: (user?.last_name || "").trim(),
    phone_number: (user?.phone_number || "").trim(),
    organization_name: (user?.organization_name || "").trim(),
    institution_head_phone: (user?.institution_head_phone || "").trim(),
  };
  const normalizedDraft = {
    first_name: profileForm.first_name.trim(),
    last_name: profileForm.last_name.trim(),
    phone_number: profileForm.phone_number.trim(),
    organization_name: profileForm.organization_name.trim(),
    institution_head_phone: profileForm.institution_head_phone.trim(),
  };
  const hasProfileChanges =
    normalizedCurrent.first_name !== normalizedDraft.first_name ||
    normalizedCurrent.last_name !== normalizedDraft.last_name ||
    normalizedCurrent.phone_number !== normalizedDraft.phone_number ||
    normalizedCurrent.organization_name !== normalizedDraft.organization_name ||
    normalizedCurrent.institution_head_phone !== normalizedDraft.institution_head_phone;

  const handleProfileInputChange = (
    field: keyof ProfileFormState,
    value: string
  ) => {
    setProfileForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setProfileError("");
    setProfileSuccess("");
  };

  const handleSaveProfileDetails = async () => {
    if (!normalizedDraft.first_name) {
      setProfileError("First name is required.");
      return;
    }
    if (!normalizedDraft.last_name) {
      setProfileError("Last name is required.");
      return;
    }
    if (showOrganizationField && !normalizedDraft.organization_name) {
      setProfileError(`${organizationLabel} is required.`);
      return;
    }
    if (showInstitutionHeadPhoneField && !normalizedDraft.institution_head_phone) {
      setProfileError("Principal/Head contact number is required.");
      return;
    }

    try {
      setProfileSaving(true);
      setProfileError("");
      setProfileSuccess("");

      const payload = {
        first_name: normalizedDraft.first_name,
        last_name: normalizedDraft.last_name,
        phone_number: normalizedDraft.phone_number || null,
        organization_name: showOrganizationField ? normalizedDraft.organization_name : "",
        institution_head_phone: showInstitutionHeadPhoneField
          ? normalizedDraft.institution_head_phone
          : "",
      };

      await updateCurrentUserProfile(payload);
      await refreshUser();
      setIsEditingProfile(false);
      setProfileSuccess("Personal details updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update personal details.";
      setProfileError(message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleStartEditingProfile = () => {
    setIsEditingProfile(true);
    setProfileError("");
    setProfileSuccess("");
  };

  const handleCancelEditingProfile = () => {
    setProfileForm({
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      phone_number: user?.phone_number || "",
      organization_name: user?.organization_name || "",
      institution_head_phone: user?.institution_head_phone || "",
    });
    setIsEditingProfile(false);
    setProfileError("");
    setProfileSuccess("");
  };

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

  const handleToggleTestingRoleSwitch = () => {
    if (testingRoleSwitchEnabledByEnv || typeof window === "undefined") {
      return;
    }

    const nextValue = !testingRoleSwitchEnabled;
    setTestingRoleSwitchEnabled(nextValue);

    try {
      window.localStorage.setItem(
        TESTING_ROLE_SWITCH_STORAGE_KEY,
        nextValue ? "true" : "false"
      );
    } catch {
      // Ignore localStorage failures.
    }

    setRoleError("");
    setRoleSuccess(
      nextValue
        ? "Testing role switch enabled for this browser."
        : "Testing role switch disabled for this browser."
    );
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

  const handleSaveAvailability = async (applyNow = false) => {
    try {
      setAvailabilitySaving(true);
      setAvailabilityError("");
      setAvailabilitySuccess("");
      const response = await updateAppointedAvailability(availabilityDraft, {
        applyNow,
      });
      setAvailabilityDraft(response.pending || response.current);
      setAvailabilityPendingFrom(response.pending_effective_from);
      setAvailabilitySuccess(
        response.detail ||
          (applyNow
            ? "Availability updated and applied immediately."
            : "Availability update saved for the next month.")
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
          <span>Personal Details</span>
        </h2>
        <p className="account-settings-testing-copy">
          Keep your contact details up to date so other users and admins can reach you.
        </p>
        {profileError && <p className="account-settings-testing-error">{profileError}</p>}
        {profileSuccess && <p className="account-settings-testing-success">{profileSuccess}</p>}
        <div className="account-settings-profile-form-grid">
          <label>
            <span>First Name</span>
            <input
              type="text"
              value={profileForm.first_name}
              disabled={!isEditingProfile || profileSaving}
              onChange={(event) => handleProfileInputChange("first_name", event.target.value)}
              placeholder="First name"
            />
          </label>
          <label>
            <span>Last Name</span>
            <input
              type="text"
              value={profileForm.last_name}
              disabled={!isEditingProfile || profileSaving}
              onChange={(event) => handleProfileInputChange("last_name", event.target.value)}
              placeholder="Last name"
            />
          </label>
          <label>
            <span>Phone Number</span>
            <input
              type="text"
              value={profileForm.phone_number}
              disabled={!isEditingProfile || profileSaving}
              onChange={(event) => handleProfileInputChange("phone_number", event.target.value)}
              placeholder="Phone number"
            />
          </label>
          <label>
            <span>Email (Read-only)</span>
            <input type="text" value={user?.email || ""} disabled />
          </label>
          {showOrganizationField && (
            <label>
              <span>{organizationLabel}</span>
              <input
                type="text"
                value={profileForm.organization_name}
                disabled={!isEditingProfile || profileSaving}
                onChange={(event) =>
                  handleProfileInputChange("organization_name", event.target.value)
                }
                placeholder={organizationLabel}
              />
            </label>
          )}
          {showInstitutionHeadPhoneField && (
            <label>
              <span>Principal/Head Contact Number</span>
              <input
                type="text"
                value={profileForm.institution_head_phone}
                disabled={!isEditingProfile || profileSaving}
                onChange={(event) =>
                  handleProfileInputChange("institution_head_phone", event.target.value)
                }
                placeholder="Principal/Head contact"
              />
            </label>
          )}
        </div>
        <div className="account-settings-profile-form-actions">
          {!isEditingProfile ? (
            <button
              type="button"
              className="account-settings-profile-edit-btn"
              onClick={handleStartEditingProfile}
            >
              <span className="button-with-icon">
                <AppIcon name="user" />
                <span>Edit Details</span>
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="account-settings-profile-save-btn"
                onClick={handleSaveProfileDetails}
                disabled={profileSaving || !hasProfileChanges}
              >
                <span className="button-with-icon">
                  <AppIcon name="settings" />
                  <span>{profileSaving ? "Saving..." : "Save Details"}</span>
                </span>
              </button>
              <button
                type="button"
                className="account-settings-profile-cancel-btn"
                onClick={handleCancelEditingProfile}
                disabled={profileSaving}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </section>

      <section className="account-settings-card">
        <h2 className="section-title-with-icon">
          <AppIcon name="approvals" className="section-title-icon" />
          <span>Account Overview</span>
        </h2>
        <div className="account-settings-grid">
          <article>
            <span>Role</span>
            <p>{roleLabel}</p>
          </article>
          <article>
            <span>{isRefereeUser ? "Grade" : "Manager Scope"}</span>
            <p>{isRefereeUser ? grade : user?.manager_scope_display || "None"}</p>
          </article>
          <article>
            <span>BIPIN Number</span>
            <p>{user?.bipin_number || "Not set"}</p>
          </article>
          <article>
            <span>Managed Team</span>
            <p>{user?.managed_team_name || "Not assigned"}</p>
          </article>
        </div>
      </section>

      <section className="account-settings-card">
        <h2 className="section-title-with-icon">
          <AppIcon name="settings" className="section-title-icon" />
          <span>Developer Controls</span>
        </h2>
        <p className="account-settings-testing-copy">
          Enable the testing role-switch panel directly from the UI.
        </p>
        <div className="account-settings-dev-toggle-row">
          <p>
            Status:{" "}
            <strong>{showTestingRoleSwitch ? "Enabled" : "Disabled"}</strong>
            {testingRoleSwitchEnabledByEnv ? " (via .env)" : ""}
          </p>
          <button
            type="button"
            className="account-settings-dev-toggle-btn"
            onClick={handleToggleTestingRoleSwitch}
            disabled={testingRoleSwitchEnabledByEnv}
          >
            {testingRoleSwitchEnabledByEnv
              ? "Enabled in .env"
              : showTestingRoleSwitch
                ? "Disable Role Switch Panel"
                : "Enable Role Switch Panel"}
          </button>
        </div>
      </section>

      {isRefereeUser && (
        <section className="account-settings-card">
          <h2 className="section-title-with-icon">
            <AppIcon name="home" className="section-title-icon" />
            <span>Home Location</span>
          </h2>
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
        </section>
      )}

      {isRefereeUser && (
        <section className="account-settings-card">
          <h2 className="section-title-with-icon">
            <AppIcon name="calendar" className="section-title-icon" />
            <span>Appointed Games Availability</span>
          </h2>
          <p className="account-settings-availability-copy">
            Changes saved here become active on the first day of next month, unless you use Save and Apply Now.
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
              onClick={() => handleSaveAvailability(false)}
              disabled={availabilitySaving || availabilityLoading}
            >
              <span className="button-with-icon">
                <AppIcon name="settings" />
                <span>{availabilitySaving ? "Saving..." : "Save Availability Changes"}</span>
              </span>
            </button>
            <button
              type="button"
              className="account-settings-availability-apply-now-btn"
              onClick={() => handleSaveAvailability(true)}
              disabled={availabilitySaving || availabilityLoading}
            >
              <span className="button-with-icon">
                <AppIcon name="calendar" />
                <span>{availabilitySaving ? "Saving..." : "Save and Apply Now"}</span>
              </span>
            </button>
          </div>
        </section>
      )}

      {showTestingRoleSwitch && (
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
      )}
    </div>
  );
}
