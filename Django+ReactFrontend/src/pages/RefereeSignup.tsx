import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../pages_css/Auth.css";

type TeamOption = {
  id: number;
  club_name: string;
  division_name: string;
};

type ClubOption = {
  id: number;
  name: string;
};

type AccountType = "REFEREE" | "CLUB" | "SCHOOL" | "COLLEGE" | "DOA" | "NL";
type ManagerScope = "NONE" | "CLUB" | "SCHOOL" | "COLLEGE";
type AvailabilityDayCode = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

type AvailabilityDayForm = {
  day_of_week: AvailabilityDayCode;
  day_label: string;
  available: boolean;
  start_time: string;
  end_time: string;
  window_start: string;
  window_end: string;
};

type FormState = {
  account_type: AccountType;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone_number: string;
  bipin_number: string;
  organization_name: string;
  verification_id_photo: File | null;
  institution_head_phone: string;
  grade: string;
  is_team_manager: boolean;
  manager_scope: ManagerScope;
  managed_team: string;
};

const initialForm: FormState = {
  account_type: "REFEREE",
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  phone_number: "",
  bipin_number: "",
  organization_name: "",
  verification_id_photo: null,
  institution_head_phone: "",
  grade: "INTRO",
  is_team_manager: false,
  manager_scope: "NONE",
  managed_team: "",
};

const API_BASE = "http://localhost:8000/api";

const APPOINTED_AVAILABILITY_TEMPLATE: AvailabilityDayForm[] = [
  {
    day_of_week: "MON",
    day_label: "Monday",
    available: false,
    start_time: "19:00",
    end_time: "20:00",
    window_start: "19:00",
    window_end: "22:00",
  },
  {
    day_of_week: "TUE",
    day_label: "Tuesday",
    available: false,
    start_time: "19:00",
    end_time: "20:00",
    window_start: "19:00",
    window_end: "22:00",
  },
  {
    day_of_week: "WED",
    day_label: "Wednesday",
    available: false,
    start_time: "19:00",
    end_time: "20:00",
    window_start: "19:00",
    window_end: "22:00",
  },
  {
    day_of_week: "THU",
    day_label: "Thursday",
    available: false,
    start_time: "19:00",
    end_time: "20:00",
    window_start: "19:00",
    window_end: "22:00",
  },
  {
    day_of_week: "FRI",
    day_label: "Friday",
    available: false,
    start_time: "19:00",
    end_time: "20:00",
    window_start: "19:00",
    window_end: "22:00",
  },
  {
    day_of_week: "SAT",
    day_label: "Saturday",
    available: false,
    start_time: "10:00",
    end_time: "11:00",
    window_start: "10:00",
    window_end: "22:00",
  },
  {
    day_of_week: "SUN",
    day_label: "Sunday",
    available: false,
    start_time: "10:00",
    end_time: "11:00",
    window_start: "10:00",
    window_end: "22:00",
  },
];

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

export default function RefereeSignup() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(initialForm);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [appointedAvailability, setAppointedAvailability] = useState<AvailabilityDayForm[]>(
    APPOINTED_AVAILABILITY_TEMPLATE.map((item) => ({ ...item }))
  );

  const isReferee = form.account_type === "REFEREE";
  const isClub = form.account_type === "CLUB";
  const isSchoolOrCollege =
    form.account_type === "SCHOOL" || form.account_type === "COLLEGE";
  const needsBipin =
    form.account_type === "REFEREE" || form.account_type === "CLUB";
  const showOrganizationField =
    form.account_type === "CLUB" ||
    form.account_type === "SCHOOL" ||
    form.account_type === "COLLEGE" ||
    form.account_type === "NL";
  const organizationLabel = useMemo(() => {
    if (form.account_type === "CLUB") return "Club";
    if (form.account_type === "SCHOOL") return "School Name";
    if (form.account_type === "COLLEGE") return "College Name";
    if (form.account_type === "NL") return "National League Organization Name";
    return "Organization Name";
  }, [form.account_type]);

  useEffect(() => {
    async function loadClubs() {
      try {
        setLoadingClubs(true);
        const response = await fetch(`${API_BASE}/clubs/`);
        if (!response.ok) {
          throw new Error("Failed to load clubs.");
        }
        const data = await response.json();
        setClubs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load clubs.");
      } finally {
        setLoadingClubs(false);
      }
    }

    loadClubs();
  }, []);

  useEffect(() => {
    async function loadTeams() {
      try {
        setLoadingTeams(true);
        const response = await fetch(`${API_BASE}/clubs/teams/`);
        if (!response.ok) {
          throw new Error("Failed to load teams.");
        }
        const data = await response.json();
        setTeams(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load teams.");
      } finally {
        setLoadingTeams(false);
      }
    }

    loadTeams();
  }, []);

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = event.target;
    const checked = (event.target as HTMLInputElement).checked;
    const selectedFile =
      type === "file" ? (event.target as HTMLInputElement).files?.[0] || null : null;

    setForm((prev) => {
      if (name === "verification_id_photo") {
        return {
          ...prev,
          verification_id_photo: selectedFile,
        };
      }

      if (name === "account_type") {
        const nextAccountType = value as AccountType;
        const nextIsSchoolOrCollege =
          nextAccountType === "SCHOOL" || nextAccountType === "COLLEGE";
        const nextOrganizationName =
          nextAccountType === "DOA" ? "" : prev.organization_name;

        if (nextAccountType !== "REFEREE") {
          return {
            ...prev,
            account_type: nextAccountType,
            organization_name: nextOrganizationName,
            verification_id_photo: nextIsSchoolOrCollege ? prev.verification_id_photo : null,
            institution_head_phone: nextIsSchoolOrCollege ? prev.institution_head_phone : "",
            grade: "INTRO",
            is_team_manager: false,
            manager_scope: "NONE",
            managed_team: "",
          };
        }

        return {
          ...prev,
          account_type: nextAccountType,
          organization_name: nextOrganizationName,
          verification_id_photo: nextIsSchoolOrCollege ? prev.verification_id_photo : null,
          institution_head_phone: nextIsSchoolOrCollege ? prev.institution_head_phone : "",
        };
      }

      if (name === "is_team_manager") {
        return {
          ...prev,
          is_team_manager: checked,
          manager_scope: checked ? "CLUB" : "NONE",
          managed_team: checked ? prev.managed_team : "",
        };
      }

      return {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };
    });

    setError("");
    setSuccess("");
  }

  function handleAvailabilityChange(
    dayCode: AvailabilityDayCode,
    patch: Partial<Pick<AvailabilityDayForm, "available" | "start_time" | "end_time">>
  ) {
    setAppointedAvailability((prev) =>
      prev.map((item) => {
        if (item.day_of_week !== dayCode) {
          return item;
        }

        const next = { ...item, ...patch };
        const endAfterStart = timeToMinutes(next.end_time) > timeToMinutes(next.start_time);
        if (!endAfterStart) {
          const options = buildTimeOptions(next.window_start, next.window_end).filter(
            (value) => timeToMinutes(value) > timeToMinutes(next.start_time)
          );
          if (options.length > 0) {
            next.end_time = options[0];
          }
        }

        return next;
      })
    );
    setError("");
    setSuccess("");
  }

  function extractErrorMessage(data: unknown): string {
    if (!data || typeof data !== "object") {
      return "Failed to register account.";
    }

    const typed = data as Record<string, unknown>;
    const firstError = Object.values(typed)[0];

    if (typeof firstError === "string") {
      return firstError;
    }

    if (Array.isArray(firstError) && typeof firstError[0] === "string") {
      return firstError[0];
    }

    return "Failed to register account.";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    if (isSchoolOrCollege && !form.verification_id_photo) {
      setError("School/College registration requires a photo ID upload.");
      setSubmitting(false);
      return;
    }

    if (isReferee && form.is_team_manager && !form.managed_team) {
      setError("Please select your managed team.");
      setSubmitting(false);
      return;
    }

    if (isReferee) {
      const invalidDay = appointedAvailability.find(
        (item) =>
          item.available &&
          timeToMinutes(item.end_time) <= timeToMinutes(item.start_time)
      );
      if (invalidDay) {
        setError(`End time must be after start time for ${invalidDay.day_label}.`);
        setSubmitting(false);
        return;
      }
    }

    try {
      const payload = new FormData();
      payload.append("account_type", form.account_type);
      payload.append("first_name", form.first_name.trim());
      payload.append("last_name", form.last_name.trim());
      payload.append("email", form.email.trim());
      payload.append("password", form.password);

      if (form.phone_number.trim()) {
        payload.append("phone_number", form.phone_number.trim());
      }

      if (needsBipin) {
        payload.append("bipin_number", form.bipin_number.trim());
      }

      if (showOrganizationField && form.organization_name.trim()) {
        payload.append("organization_name", form.organization_name.trim());
      }

      if (isSchoolOrCollege) {
        payload.append("institution_head_phone", form.institution_head_phone.trim());
        if (form.verification_id_photo) {
          payload.append("verification_id_photo", form.verification_id_photo);
        }
      }

      if (isReferee) {
        payload.append("grade", form.grade);
        payload.append("is_team_manager", String(form.is_team_manager));
        payload.append(
          "appointed_availability",
          JSON.stringify(
            appointedAvailability.map((item) => ({
              day_of_week: item.day_of_week,
              available: item.available,
              start_time: item.start_time,
              end_time: item.end_time,
            }))
          )
        );

        if (form.is_team_manager) {
          payload.append("manager_scope", form.manager_scope);
          payload.append("managed_team", String(Number(form.managed_team)));
        }
      }

      const response = await fetch(`${API_BASE}/users/register/`, {
        method: "POST",
        body: payload,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(extractErrorMessage(data));
      }

      setSuccess(
        "Account created successfully. Verification and approval are required before upload permissions are activated."
      );
      setForm(initialForm);
      setAppointedAvailability(APPOINTED_AVAILABILITY_TEMPLATE.map((item) => ({ ...item })));
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <p className="auth-brand">RefereePoint</p>
        <div className="auth-card">
          <div className="auth-header">
            <h1>Create Account</h1>
            <p>
              Register your role and complete verification details to unlock upload permissions.
            </p>
          </div>

          <form className="auth-form auth-form-dense" onSubmit={handleSubmit}>
            <div className="auth-grid">
              <label className="auth-field auth-field-full">
                <span>Role</span>
                <select
                  name="account_type"
                  value={form.account_type}
                  onChange={handleChange}
                  required
                >
                  <option value="REFEREE">Referee</option>
                  <option value="CLUB">Club</option>
                  <option value="SCHOOL">School</option>
                  <option value="COLLEGE">College</option>
                  <option value="DOA">DOA</option>
                  <option value="NL">National League</option>
                </select>
              </label>

              <label className="auth-field">
                <span>First Name</span>
                <input
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="auth-field">
                <span>Last Name</span>
                <input
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="auth-field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="auth-field">
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  minLength={8}
                  required
                />
              </label>

              <label className="auth-field auth-field-full">
                <span>Phone Number</span>
                <input
                  type="text"
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                />
              </label>

              {showOrganizationField && (
                <label className="auth-field auth-field-full">
                  <span>{organizationLabel}</span>
                  {isClub ? (
                    <select
                      name="organization_name"
                      value={form.organization_name}
                      onChange={handleChange}
                      required
                      disabled={loadingClubs}
                    >
                      <option value="">
                        {loadingClubs
                          ? "Loading clubs..."
                          : clubs.length > 0
                            ? "Select club"
                            : "No clubs available"}
                      </option>
                      {clubs.map((club) => (
                        <option key={club.id} value={club.name}>
                          {club.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      name="organization_name"
                      value={form.organization_name}
                      onChange={handleChange}
                      required={isSchoolOrCollege}
                    />
                  )}
                </label>
              )}

              {needsBipin && (
                <label className="auth-field auth-field-full">
                  <span>BIPIN Number</span>
                  <input
                    type="text"
                    name="bipin_number"
                    value={form.bipin_number}
                    onChange={handleChange}
                    required
                  />
                </label>
              )}

              {isSchoolOrCollege && (
                <>
                  <label className="auth-field">
                    <span>Upload Photo ID</span>
                    <input
                      type="file"
                      name="verification_id_photo"
                      accept="image/*"
                      onChange={handleChange}
                      required
                    />
                  </label>

                  <label className="auth-field">
                    <span>Principal / Head Phone Number</span>
                    <input
                      type="text"
                      name="institution_head_phone"
                      value={form.institution_head_phone}
                      onChange={handleChange}
                      required
                    />
                  </label>

                  {form.verification_id_photo && (
                    <p className="auth-file-name auth-field-full">
                      Selected file: {form.verification_id_photo.name}
                    </p>
                  )}
                </>
              )}

              {isReferee && (
                <>
                  <label className="auth-field auth-field-full">
                    <span>Referee Grade</span>
                    <select name="grade" value={form.grade} onChange={handleChange}>
                      <option value="INTRO">Intro</option>
                      <option value="GRADE_3">Grade 3</option>
                      <option value="GRADE_2">Grade 2</option>
                      <option value="GRADE_1">Grade 1</option>
                      <option value="FIBA">FIBA</option>
                    </select>
                  </label>

                  <div className="auth-field auth-field-full auth-availability">
                    <span>Appointed Games Availability</span>
                    <p className="auth-availability-note">
                      Monday-Friday available window: 19:00-22:00. Saturday-Sunday available
                      window: 10:00-22:00.
                    </p>
                    <div className="auth-availability-list">
                      {appointedAvailability.map((item) => {
                        const timeOptions = buildTimeOptions(item.window_start, item.window_end);
                        const endOptions = timeOptions.filter(
                          (value) => timeToMinutes(value) > timeToMinutes(item.start_time)
                        );

                        return (
                          <div key={item.day_of_week} className="auth-availability-row">
                            <label className="auth-availability-toggle">
                              <input
                                type="checkbox"
                                checked={item.available}
                                onChange={(event) =>
                                  handleAvailabilityChange(item.day_of_week, {
                                    available: event.target.checked,
                                  })
                                }
                              />
                              <span>{item.day_label}</span>
                            </label>
                            <div className="auth-availability-times">
                              <select
                                value={item.start_time}
                                onChange={(event) =>
                                  handleAvailabilityChange(item.day_of_week, {
                                    start_time: event.target.value,
                                  })
                                }
                                disabled={!item.available}
                              >
                                {timeOptions.slice(0, -1).map((timeValue) => (
                                  <option key={`${item.day_of_week}-start-${timeValue}`} value={timeValue}>
                                    {timeValue}
                                  </option>
                                ))}
                              </select>
                              <span>to</span>
                              <select
                                value={item.end_time}
                                onChange={(event) =>
                                  handleAvailabilityChange(item.day_of_week, {
                                    end_time: event.target.value,
                                  })
                                }
                                disabled={!item.available}
                              >
                                {(endOptions.length > 0 ? endOptions : timeOptions.slice(1)).map((timeValue) => (
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
                  </div>

                  <label className="auth-checkbox auth-field-full">
                    <input
                      type="checkbox"
                      name="is_team_manager"
                      checked={form.is_team_manager}
                      onChange={handleChange}
                    />
                    <span>Also register as team manager</span>
                  </label>

                  {form.is_team_manager && (
                    <>
                      <label className="auth-field">
                        <span>Manager Scope</span>
                        <select
                          name="manager_scope"
                          value={form.manager_scope}
                          onChange={handleChange}
                        >
                          <option value="CLUB">Club</option>
                          <option value="SCHOOL">School</option>
                          <option value="COLLEGE">College</option>
                        </select>
                      </label>

                      <label className="auth-field">
                        <span>Managed Team</span>
                        <select
                          name="managed_team"
                          value={form.managed_team}
                          onChange={handleChange}
                          disabled={loadingTeams}
                          required
                        >
                          <option value="">
                            {loadingTeams ? "Loading teams..." : "Select team"}
                          </option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.club_name} - {team.division_name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                </>
              )}
            </div>

            {error && <p className="auth-message auth-message-error">{error}</p>}
            {success && <p className="auth-message auth-message-success">{success}</p>}

            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="auth-footer-text">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
