import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import UploadCoverRequestPanel from "./UploadCoverRequestPanel";
import UploadEventPanel from "./UploadEventPanel";
import UploadGamePanel from "./UploadGamePanel";

type UploadModalType = "game" | "event" | "cover_request" | null;

const navLinks = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Games", path: "/games" },
  { name: "Cover Requests", path: "/cover-requests" },
  { name: "Events", path: "/events" },
  { name: "Reports", path: "/reports" },
  { name: "Earnings", path: "/earnings" },
];

const uploadItems: Array<{ label: string; type: Exclude<UploadModalType, null> }> = [
  { label: "Upload Game", type: "game" },
  { label: "Upload Event", type: "event" },
  { label: "Upload Cover Request", type: "cover_request" },
];

const TopNavBar: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [activeUploadModal, setActiveUploadModal] = useState<UploadModalType>(null);
  const navRef = useRef<HTMLElement | null>(null);

  const handleMenuToggle = () => {
    setMenuOpen((prev) => {
      const next = !prev;
      if (!next) {
        setUploadMenuOpen(false);
      }
      return next;
    });
  };

  const handleUploadMenuToggle = () => {
    setUploadMenuOpen((prev) => !prev);
  };

  const closeUploadModal = () => {
    setActiveUploadModal(null);
  };

  const openUploadModal = (type: Exclude<UploadModalType, null>) => {
    setUploadMenuOpen(false);
    setMenuOpen(false);
    setActiveUploadModal(type);
  };

  const handleUploaded = () => {
    window.dispatchEvent(new Event("refereepoint:data-refresh"));
    closeUploadModal();
  };

  const handleLinkClick = () => {
    setMenuOpen(false);
    setUploadMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setUploadMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setUploadMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveUploadModal(null);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!activeUploadModal) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [activeUploadModal]);

  const uploadModalTitle =
    activeUploadModal === "game"
      ? "Upload Game"
      : activeUploadModal === "event"
        ? "Upload Event"
        : activeUploadModal === "cover_request"
          ? "Upload Cover Request"
          : "";

  return (
    <>
      <nav className="top-nav-bar" ref={navRef}>
        <div className="nav-left">
          <Link to="/dashboard" className="nav-title">
            RefereePoint
          </Link>
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

          <div className={`upload-menu ${uploadMenuOpen ? "open" : ""}`}>
            <button
              className={`nav-link upload-menu-trigger ${activeUploadModal ? "active" : ""}`}
              onClick={handleUploadMenuToggle}
              aria-expanded={uploadMenuOpen}
              aria-haspopup="menu"
              type="button"
            >
              +Upload
            </button>
            <div className="upload-menu-panel" role="menu">
              {uploadItems.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => openUploadModal(item.type)}
                  className="upload-menu-link upload-menu-action"
                  role="menuitem"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="nav-right">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            type="button"
            title="Toggle theme"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>

          {user ? (
            <>
              <span className="nav-user">{user.first_name || user.email}</span>
              <button onClick={logout} type="button">
                Logout
              </button>
            </>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </div>
      </nav>

      {activeUploadModal && (
        <div className="upload-modal-overlay" onClick={closeUploadModal}>
          <div className="upload-modal" onClick={(event) => event.stopPropagation()}>
            <div className="upload-modal-header">
              <h2>{uploadModalTitle}</h2>
              <button
                type="button"
                className="upload-modal-close"
                onClick={closeUploadModal}
              >
                Close
              </button>
            </div>
            <div className="upload-modal-body">
              {activeUploadModal === "game" && (
                <UploadGamePanel embedded onPosted={handleUploaded} />
              )}
              {activeUploadModal === "event" && (
                <UploadEventPanel onUploaded={handleUploaded} />
              )}
              {activeUploadModal === "cover_request" && (
                <UploadCoverRequestPanel onUploaded={handleUploaded} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopNavBar;
