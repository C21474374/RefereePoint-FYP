import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const navLinks = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Games", path: "/games" },
  { name: "Cover Requests", path: "/cover-requests" },
  { name: "Events", path: "/events" },
  { name: "Reports", path: "/reports" },
  { name: "Earnings", path: "/earnings" },
  { name: "Upload Game", path: "/upload-game" },
];

const TopNavBar: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  const handleMenuToggle = () => {
    setMenuOpen((prev) => !prev);
  };

  const handleLinkClick = () => {
    setMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="top-nav-bar" ref={navRef}>
      <div className="nav-left">
        <Link to="/dashboard" className="nav-title">RefereePoint</Link>
      </div>

      <button
        className={`burger-button ${menuOpen ? "open" : ""}`}
        onClick={handleMenuToggle}
        aria-label="Toggle navigation menu"
        aria-expanded={menuOpen}
        type="button"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div className={`nav-center ${menuOpen ? "open" : ""}`}>
        {navLinks.map((link) => (
          <Link
            key={link.name}
            to={link.path}
            onClick={handleLinkClick}
            className={`nav-link ${location.pathname === link.path ? "active" : ""}`}
          >
            {link.name}
          </Link>
        ))}
      </div>

      <div className="nav-right">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          type="button"
          title="Toggle theme"
        >
          {theme === 'dark' ? '☀︎ Light' : '☾ Dark'}
        </button>

        {user ? (
          <>
            <span className="nav-user">{user.first_name || user.email}</span>
            <button onClick={logout} type="button">Logout</button>
          </>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </div>
    </nav>
  );
};

export default TopNavBar;