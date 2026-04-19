import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "../services/notifications";
import AppIcon, { type AppIconName } from "./AppIcon";
import UploadGamePanel from "./UploadGamePanel";
import UploadEventPanel from "./UploadEventPanel";
import {
  canAccessCoverRequestsPage,
  canAccessConfigurePage,
  canAccessEarningsPage,
  canAccessReportsPage,
  hasRefereeAccess,
} from "../utils/access";

type UploadModalType = "game" | "event" | null;
type NavLinkItem = { name: string; path: string; icon: AppIconName };
type UploadMenuItem =
  | { label: string; icon: AppIconName; kind: "modal"; type: Exclude<UploadModalType, null> }
  | { label: string; icon: AppIconName; kind: "route"; path: string };

const refereeNavLinks: NavLinkItem[] = [
  { name: "Dashboard", path: "/dashboard", icon: "dashboard" },
  { name: "Opportunities", path: "/games", icon: "basketball" },
  { name: "Cover Requests", path: "/cover-requests", icon: "whistle" },
  { name: "Events", path: "/events", icon: "events" },
  { name: "Reports", path: "/reports", icon: "reports" },
  { name: "Earnings", path: "/earnings", icon: "earnings" },
];

const managerBaseNavLinks: NavLinkItem[] = [
  { name: "Dashboard", path: "/dashboard", icon: "dashboard" },
  { name: "Games", path: "/games", icon: "basketball" },
  { name: "Events", path: "/events", icon: "events" },
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

function toNotificationTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TopNavBar: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [isMobileNav, setIsMobileNav] = useState(detectMobileNav);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsMenuOpen, setNotificationsMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [activeUploadModal, setActiveUploadModal] = useState<UploadModalType>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setNotificationUnreadCount(0);
      return null;
    }

    try {
      setNotificationsLoading(true);
      setNotificationsError("");
      const response = await getNotifications(150);
      setNotifications(response.items || []);
      setNotificationUnreadCount(response.unread_count || 0);
      return response;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load notifications.";
      setNotificationsError(message);
      showToast(message, "error");
      return null;
    } finally {
      setNotificationsLoading(false);
    }
  }, [showToast, user]);

  const markAllAsReadIfNeeded = useCallback(async (unreadOverride?: number) => {
    const unreadCount = unreadOverride ?? notificationUnreadCount;
    if (!unreadCount) {
      return;
    }

    try {
      await markAllNotificationsRead();
      setNotificationUnreadCount(0);
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true }))
      );
    } catch {
      // Keep UI responsive even if marking read fails.
      showToast("Failed to mark notifications as read.", "error");
    }
  }, [notificationUnreadCount, showToast]);

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
    setNotificationsMenuOpen(false);
    setMenuOpen((prev) => {
      const next = !prev;
      if (!next) {
        setUploadMenuOpen(false);
      }
      return next;
    });
  };

  const handleUploadMenuToggle = () => {
    setProfileMenuOpen(false);
    setNotificationsMenuOpen(false);
    setUploadMenuOpen((prev) => !prev);
  };

  const handleLinkClick = () => {
    setMenuOpen(false);
    setUploadMenuOpen(false);
    setProfileMenuOpen(false);
    setNotificationsMenuOpen(false);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    setUploadMenuOpen(false);
    setProfileMenuOpen(false);
    setNotificationsMenuOpen(false);
    logout();
  };

  const handleProfileToggle = () => {
    if (!isMobileNav) {
      return;
    }
    setNotificationsMenuOpen(false);
    setProfileMenuOpen((prev) => !prev);
  };

  const handleNotificationsToggle = () => {
    setProfileMenuOpen(false);
    setUploadMenuOpen(false);
    setNotificationsMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        void loadNotifications();
      }
      return next;
    });
  };

  const handleMarkAllNotificationsRead = async () => {
    await markAllAsReadIfNeeded();
  };

  const handleNotificationItemClick = async (notification: NotificationItem) => {
    if (notification.is_read) {
      return;
    }

    try {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item
        )
      );
      setNotificationUnreadCount((prev) => (prev > 0 ? prev - 1 : 0));
    } catch {
      // Ignore read-update failure to avoid blocking navigation.
      showToast("Failed to mark notification as read.", "error");
    }
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsMobileNav(event.matches);
      if (!event.matches) {
        setMenuOpen(false);
        setUploadMenuOpen(false);
        setProfileMenuOpen(false);
        setNotificationsMenuOpen(false);
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
    setNotificationsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setNotificationUnreadCount(0);
      setNotificationsError("");
      return;
    }

    void loadNotifications();
  }, [loadNotifications, user]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadNotifications();
    };

    window.addEventListener("refereepoint:data-refresh", handleRefresh);
    return () => window.removeEventListener("refereepoint:data-refresh", handleRefresh);
  }, [loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideNav = navRef.current?.contains(target);
      const clickedInsideMobilePanel = mobileDrawerRef.current?.contains(target);

      if (!clickedInsideNav && !clickedInsideMobilePanel) {
        setMenuOpen(false);
        setUploadMenuOpen(false);
        setProfileMenuOpen(false);
        setNotificationsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveUploadModal(null);
        setMenuOpen(false);
        setUploadMenuOpen(false);
        setProfileMenuOpen(false);
        setNotificationsMenuOpen(false);
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
        : "";
  const userDisplayName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.email || "Referee";
  const userInitials = buildUserInitials(user?.first_name, user?.last_name, user?.email);
  const isRefereeUser = hasRefereeAccess(user);
  const hasEventManagerScope = Boolean(user?.allowed_upload_event_types?.length);
  const canApproveAccounts = Boolean(user?.can_approve_accounts);
  const canApproveCoverRequests = canAccessCoverRequestsPage(user) && !isRefereeUser;
  const canConfigure = canAccessConfigurePage(user);
  const canViewReports = canAccessReportsPage(user);
  const canViewEarnings = canAccessEarningsPage(user);
  const managerNavLinks: NavLinkItem[] = [
    ...managerBaseNavLinks.filter((link) => hasEventManagerScope || link.path !== "/events"),
    ...(canApproveCoverRequests
      ? ([{ name: "Cover Requests", path: "/cover-requests", icon: "whistle" as AppIconName }] as NavLinkItem[])
      : []),
    ...(canConfigure
      ? ([
          {
            name: "Configure",
            path: "/configure",
            icon: "settings" as AppIconName,
          },
        ] as NavLinkItem[])
      : []),
    ...(canViewReports
      ? ([
          {
            name: "Reports",
            path: "/reports",
            icon: "reports" as AppIconName,
          },
        ] as NavLinkItem[])
      : []),
    ...(canViewEarnings
      ? ([
          {
            name: "Earnings",
            path: "/earnings",
            icon: "earnings" as AppIconName,
          },
        ] as NavLinkItem[])
      : []),
    ...(canApproveAccounts
      ? ([
          {
            name: "Account Approvals",
            path: "/account-approvals",
            icon: "approvals" as AppIconName,
          },
        ] as NavLinkItem[])
      : []),
  ];
  const navLinks = isRefereeUser
    ? refereeNavLinks.filter(
        (link) => !((isRefereeUser && !hasEventManagerScope) && link.path === "/events")
      )
    : managerNavLinks;
  // Upload actions are role-driven and collapse into a single entry when only one is available.
  const canUploadGame =
    Boolean(user?.uploads_approved) &&
    Boolean(user?.allowed_upload_game_types?.length);
  const canUploadEvent =
    Boolean(user?.uploads_approved) &&
    Boolean(user?.allowed_upload_event_types?.length);

  useEffect(() => {
    const uploadTarget = new URLSearchParams(location.search).get("upload");
    if (uploadTarget === "game" && canUploadGame) {
      setMenuOpen(false);
      setUploadMenuOpen(false);
      setActiveUploadModal("game");
      return;
    }
    if (uploadTarget === "event" && canUploadEvent) {
      setMenuOpen(false);
      setUploadMenuOpen(false);
      setActiveUploadModal("event");
    }
  }, [canUploadEvent, canUploadGame, location.search]);

  const showBulkGameUploadInGamesPage =
    !isRefereeUser && (user?.account_type === "DOA" || user?.account_type === "NL");
  const uploadItems: UploadMenuItem[] = [
    ...(canUploadGame
      ? [
          ...(showBulkGameUploadInGamesPage
            ? []
            : ([{ label: "Upload Game", icon: "games", kind: "modal", type: "game" }] as const)),
        ]
      : []),
    ...(canUploadEvent
      ? ([{ label: "Upload Event", icon: "events", kind: "modal", type: "event" }] as const)
      : []),
  ];
  const singleUploadRouteItem =
    uploadItems.length === 1 && uploadItems[0].kind === "route"
      ? uploadItems[0]
      : null;

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
            <span className="nav-title-content">
              <span>RefereePoint</span>
            </span>
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
              <span className="nav-link-content">
                <AppIcon name={link.icon} className="nav-link-icon" />
                <span>{link.name}</span>
              </span>
            </Link>
          ))}

          {uploadItems.length > 0 &&
            (singleUploadRouteItem ? (
              <Link
                to={singleUploadRouteItem.path}
                onClick={handleLinkClick}
                className={`nav-link ${location.pathname === singleUploadRouteItem.path ? "active" : ""}`}
              >
                <span className="nav-link-content">
                  <AppIcon name={singleUploadRouteItem.icon} className="nav-link-icon" />
                  <span>Upload</span>
                </span>
              </Link>
            ) : (
              <div className={`upload-menu ${uploadMenuOpen ? "open" : ""}`}>
                <button
                  className={`nav-link upload-menu-trigger ${activeUploadModal || uploadMenuOpen ? "active" : ""}`}
                  onClick={handleUploadMenuToggle}
                  aria-expanded={uploadMenuOpen}
                  aria-haspopup="menu"
                  type="button"
                >
                  <span className="nav-link-content">
                    <AppIcon name="upload" className="nav-link-icon" />
                    <span>Upload</span>
                  </span>
                </button>
                <div className="upload-menu-panel" role="menu">
                  {uploadItems.map((item) => (
                    item.kind === "modal" ? (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => openUploadModal(item.type)}
                        className="upload-menu-link upload-menu-action"
                        role="menuitem"
                      >
                        <span className="upload-menu-link-content">
                          <AppIcon name={item.icon} className="upload-menu-link-icon" />
                          <span>{item.label}</span>
                        </span>
                      </button>
                    ) : (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={handleLinkClick}
                        className="upload-menu-link upload-menu-action"
                        role="menuitem"
                      >
                        <span className="upload-menu-link-content">
                          <AppIcon name={item.icon} className="upload-menu-link-icon" />
                          <span>{item.label}</span>
                        </span>
                      </Link>
                    )
                  ))}
                </div>
              </div>
            ))}
        </div>

        <div className="nav-right">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            type="button"
            title="Toggle theme"
          >
            <span className="theme-toggle-content">
              <AppIcon
                name={theme === "dark" ? "sun" : "moon"}
                className="theme-toggle-icon"
              />
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </span>
          </button>

          {user ? (
            <>
              <div className={`notifications-menu ${notificationsMenuOpen ? "open" : ""}`}>
                <button
                  className="notifications-menu-trigger"
                  onClick={handleNotificationsToggle}
                  aria-expanded={notificationsMenuOpen}
                  aria-haspopup="menu"
                  type="button"
                  title="Notifications"
                >
                  <AppIcon name="notifications" className="notifications-menu-icon" />
                  {notificationUnreadCount > 0 && (
                    <span className="notifications-menu-badge">
                      {notificationUnreadCount > 9 ? "9+" : notificationUnreadCount}
                    </span>
                  )}
                </button>
                <div className="notifications-menu-panel" role="menu">
                  <div className="notifications-menu-header">
                    <h3>Notifications</h3>
                    <div className="notifications-menu-actions">
                      <button
                        type="button"
                        className="notifications-menu-refresh notifications-menu-mark-all"
                        onClick={handleMarkAllNotificationsRead}
                        disabled={notificationUnreadCount === 0 || notificationsLoading}
                      >
                        Mark all read
                      </button>
                      <button
                        type="button"
                        className="notifications-menu-refresh"
                        onClick={() => void loadNotifications()}
                        disabled={notificationsLoading}
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  {notificationsLoading ? (
                    <p className="notifications-menu-state">Loading notifications...</p>
                  ) : notificationsError ? (
                    <p className="notifications-menu-state error">{notificationsError}</p>
                  ) : notifications.length === 0 ? (
                    <p className="notifications-menu-state">No notifications yet.</p>
                  ) : (
                    <div className="notifications-menu-list">
                      {notifications.map((notification) =>
                        notification.link_path ? (
                          <Link
                            key={notification.id}
                            to={notification.link_path}
                            onClick={async () => {
                              await handleNotificationItemClick(notification);
                              handleLinkClick();
                            }}
                            className={`notifications-menu-item ${notification.is_read ? "" : "is-unread"}`}
                            role="menuitem"
                          >
                            <div className="notifications-menu-item-top">
                              <h4>{notification.title}</h4>
                              <span>{toNotificationTime(notification.created_at)}</span>
                            </div>
                            <p>{notification.message}</p>
                          </Link>
                        ) : (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={async () => {
                              await handleNotificationItemClick(notification);
                              setNotificationsMenuOpen(false);
                            }}
                            className={`notifications-menu-item notifications-menu-item-button ${notification.is_read ? "" : "is-unread"}`}
                            role="menuitem"
                          >
                            <div className="notifications-menu-item-top">
                              <h4>{notification.title}</h4>
                              <span>{toNotificationTime(notification.created_at)}</span>
                            </div>
                            <p>{notification.message}</p>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>

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
                    <span className="profile-menu-link-content">
                      <AppIcon name="settings" className="profile-menu-link-icon" />
                      <span>Account Settings</span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="profile-menu-link profile-menu-action profile-menu-action-danger"
                    role="menuitem"
                  >
                    <span className="profile-menu-link-content">
                      <AppIcon name="logout" className="profile-menu-link-icon" />
                      <span>Logout</span>
                    </span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <Link to="/login" className="nav-link">
              <span className="nav-link-content">
                <AppIcon name="user" className="nav-link-icon" />
                <span>Login</span>
              </span>
            </Link>
          )}
        </div>
      </nav>

      {isMobileNav && (
        <div
          className={`mobile-drawer-overlay ${menuOpen ? "open" : ""}`}
          onClick={() => {
            setMenuOpen(false);
            setUploadMenuOpen(false);
            setNotificationsMenuOpen(false);
          }}
        >
          <div
            ref={mobileDrawerRef}
            className={`mobile-drawer ${menuOpen ? "open" : ""}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-drawer-header">
              <div className="mobile-drawer-title">
                <span className="mobile-drawer-title-content">
                  <span>RefereePoint</span>
                </span>
              </div>
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
                  <span className="mobile-menu-link-content">
                    <AppIcon name={link.icon} className="mobile-menu-link-icon" />
                    <span>{link.name}</span>
                  </span>
                </Link>
              ))}

              {uploadItems.length > 0 &&
                (singleUploadRouteItem ? (
                  <Link
                    to={singleUploadRouteItem.path}
                    onClick={handleLinkClick}
                    className={`mobile-menu-link ${location.pathname === singleUploadRouteItem.path ? "active" : ""}`}
                  >
                    <span className="mobile-menu-link-content">
                      <AppIcon name="upload" className="mobile-menu-link-icon" />
                      <span>Upload</span>
                    </span>
                  </Link>
                ) : (
                  <div className={`mobile-upload ${uploadMenuOpen ? "open" : ""}`}>
                    <button
                      type="button"
                      className={`mobile-menu-action mobile-upload-trigger ${uploadMenuOpen ? "active" : ""}`}
                      onClick={handleUploadMenuToggle}
                      aria-expanded={uploadMenuOpen}
                      aria-controls="mobile-upload-panel"
                    >
                      <span className="mobile-menu-action-content">
                        <AppIcon name="upload" className="mobile-menu-link-icon" />
                        <span>Upload</span>
                      </span>
                      <span className="mobile-upload-trigger-right" aria-hidden="true">
                        <span className="mobile-upload-trigger-count">{uploadItems.length}</span>
                        <span className="mobile-upload-caret">{uploadMenuOpen ? "▴" : "▾"}</span>
                      </span>
                    </button>
                    <div id="mobile-upload-panel" className="mobile-upload-panel">
                      {uploadItems.map((item) => (
                        item.kind === "modal" ? (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => openUploadModal(item.type)}
                            className="mobile-upload-item"
                          >
                            <span className="mobile-upload-item-content">
                              <AppIcon name={item.icon} className="mobile-menu-link-icon" />
                              <span>{item.label}</span>
                            </span>
                          </button>
                        ) : (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={handleLinkClick}
                            className="mobile-upload-item"
                          >
                            <span className="mobile-upload-item-content">
                              <AppIcon name={item.icon} className="mobile-menu-link-icon" />
                              <span>{item.label}</span>
                            </span>
                          </Link>
                        )
                      ))}
                    </div>
                  </div>
                ))}
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
            </div>
            <div className="upload-modal-body">
              {activeUploadModal === "game" && (
                <UploadGamePanel
                  embedded
                  onPosted={handleUploaded}
                  onCancel={closeUploadModal}
                />
              )}
              {activeUploadModal === "event" && (
                <UploadEventPanel onUploaded={handleUploaded} onCancel={closeUploadModal} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopNavBar;
