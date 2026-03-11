import { Link } from 'react-router-dom'

export default function RefereeLogin() {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">RefereePoint</div>
        <h1>Welcome back</h1>
        <p className="auth-subtitle">Sign in to your referee account</p>
        <form className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" placeholder="Enter your password" />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>Sign In</button>
        </form>
        <p className="auth-link">
          Don't have an account? <Link to="/signup">Create one</Link>
        </p>
      </div>
    </div>
  )
}
