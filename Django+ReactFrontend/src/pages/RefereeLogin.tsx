import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppIcon from "../components/AppIcon";
import "../pages_css/Auth.css";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      navigate("/games");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      if (message === "No active account found with the given credentials") {
        setError("Invalid email or password");
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell auth-shell-compact">
        <p className="auth-brand">RefereePoint</p>
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="page-title-with-icon">
              <AppIcon name="user" className="page-title-icon" />
              <span>Welcome Back</span>
            </h1>
            <p>Sign in to access your referee dashboard and opportunities.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {error && <p className="auth-message auth-message-error">{error}</p>}

            <button className="auth-submit" type="submit" disabled={submitting}>
              <span className="button-with-icon">
                <AppIcon name="user" />
                <span>{submitting ? "Logging in..." : "Login"}</span>
              </span>
            </button>
          </form>

          <p className="auth-footer-text">
            Need an account? <Link to="/signup">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
