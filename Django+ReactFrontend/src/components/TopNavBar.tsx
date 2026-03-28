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

function buildUserInitials(
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

function detectMobileNav() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(max-width: 900px)").matches;
}

const TopNavBar: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isMobileNav, setIsMobileNav] = useState(detectMobileNav);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activeUploadModal, setActiveUploadModal] = useState<UploadModalType>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);

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

  const handleMenuToggle = () => {
    setProfileMenuOpen(false);
    setMenuOpen((prev) => {
      const next = !prev;
      if (!next) {
        setUploadMenuOpen(false);
      }
      return next;
    });
  };

  const handleUploadMenuToggle = () => {
    if (!isMobileNav) {
      return;
    }
    setUploadMenuOpen((prev) => !prev);
  };

  const handleLinkClick = () => {
    setMenuOpen(false);
    setUploadMenuOpen(false);
    setProfileMenuOpen(false);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    setUploadMenuOpen(false);
    setProfileMenuOpen(false);
    logout();
  };

  const handleProfileToggle = () => {
    if (!isMobileNav) {
      return;
    }
    setProfileMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsMobileNav(event.matches);
      if (!event.matches) {
        setMenuOpen(false);
        setUploadMenuOpen(false);
        setProfileMenuOpen(false);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleMediaChange);
    } else {
      mediaQuery.addListener(handleMediaChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleMediaChange);
      } else {
        mediaQuery.removeListener(handleMediaChange);
      }
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setUploadMenuOpen(false);
    setProfileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideNav = navRef.current?.contains(target);
      const clickedInsideMobilePanel = mobileDrawerRef.current?.contains(target);

      if (!clickedInsideNav && !clickedInsideMobilePanel) {
        setMenuOpen(false);
        setUploadMenuOpen(false);
        setProfileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveUploadModal(null);
        setMenuOpen(false);
        setUploadMenuOpen(false);
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!activeUploadModal && !(isMobileNav && menuOpen)) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [activeUploadModal, isMobileNav, menuOpen]);

  const uploadModalTitle =
    activeUploadModal === "game"
      ? "Upload Game"
      : activeUploadModal === "event"
        ? "Upload Event"
        : activeUploadModal === "cover_request"
          ? "Upload Cover Request"
          : "";
  const userDisplayName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.email || "Referee";
  const userInitials = buildUserInitials(user?.first_name, user?.last_name, user?.email);

  return (
    <>
      <nav className="top-nav-bar" ref={navRef}>
        <div className="nav-left">
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
          <Link to="/dashboard" className="nav-title">
            RefereePoint
          </Link>
        </div>

        <div className="nav-center">
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

          <div className="upload-menu">
            <button
              className={`nav-link upload-menu-trigger ${activeUploadModal ? "active" : ""}`}
              onClick={handleUploadMenuToggle}
              aria-expanded={isMobileNav ? uploadMenuOpen : undefined}
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
            <div className={`profile-menu ${profileMenuOpen ? "open" : ""}`}>
              <button
                className="profile-menu-trigger"
                onClick={handleProfileToggle}
                aria-expanded={isMobileNav ? profileMenuOpen : undefined}
                aria-haspopup="menu"
                type="button"
                title={userDisplayName}
              >
                <span className="profile-avatar-wrap" aria-hidden="true">
                  <span className="profile-avatar">{userInitials}</span>
                  <span className="profile-avatar-caret">v</span>
                </span>
              </button>
              <div className="profile-menu-panel" role="menu">
                <Link
                  to="/account-settings"
                  onClick={handleLinkClick}
                  className="profile-menu-link"
                  role="menuitem"
                >
                  Account Settings
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="profile-menu-link profile-menu-action profile-menu-action-danger"
                  role="menuitem"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </div>
      </nav>

      {isMobileNav && (
        <div
          className={`mobile-drawer-overlay ${menuOpen ? "open" : ""}`}
          onClick={() => {
            setMenuOpen(false);
            setUploadMenuOpen(false);
          }}
        >
          <div
            ref={mobileDrawerRef}
            className={`mobile-drawer ${menuOpen ? "open" : ""}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-drawer-header">
              <div className="mobile-drawer-title">RefereePoint</div>
            </div>
            <div className="mobile-drawer-divider" />

            <div className="mobile-drawer-nav">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={handleLinkClick}
                  className={`mobile-menu-link ${location.pathname === link.path ? "active" : ""}`}
                >
                  {link.name}
                </Link>
              ))}

              <div className={`mobile-upload ${uploadMenuOpen ? "open" : ""}`}>
                <button
                  type="button"
                  className="mobile-menu-action mobile-upload-trigger"
                  onClick={handleUploadMenuToggle}
                  aria-expanded={uploadMenuOpen}
                >
                  +Upload
                </button>
                <div className="mobile-upload-panel">
                  {uploadItems.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => openUploadModal(item.type)}
                      className="mobile-upload-item"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mobile-drawer-bottom">
              <div className="mobile-theme-row">
                <span className="mobile-theme-label">Change theme</span>
                <button
                  type="button"
                  className={`mobile-theme-switch ${theme === "light" ? "on" : "off"}`}
                  onClick={toggleTheme}
                  aria-pressed={theme === "light"}
                  aria-label="Toggle light mode"
                >
                  <span className="mobile-theme-switch-track">
                    <span className="mobile-theme-switch-thumb" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
