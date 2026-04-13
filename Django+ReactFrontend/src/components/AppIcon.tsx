import type { SVGProps } from "react";

export type AppIconName =
  | "dashboard"
  | "games"
  | "opportunities"
  | "cover"
  | "events"
  | "reports"
  | "earnings"
  | "settings"
  | "approvals"
  | "upload"
  | "calendar"
  | "time"
  | "filter"
  | "notifications"
  | "user"
  | "logout"
  | "home"
  | "plus"
  | "sun"
  | "moon";

type AppIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: AppIconName;
  size?: number;
  strokeWidth?: number;
};

function renderIconPath(name: AppIconName) {
  switch (name) {
    case "dashboard":
      return (
        <>
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
        </>
      );
    case "games":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17" />
          <path d="M12 3.5a14.6 14.6 0 0 1 0 17" />
          <path d="M12 3.5a14.6 14.6 0 0 0 0 17" />
        </>
      );
    case "opportunities":
      return (
        <>
          <path d="M12 2.5l2.6 5.3 5.9.9-4.3 4.2 1 5.8L12 16l-5.2 2.7 1-5.8L3.5 8.7l5.9-.9z" />
        </>
      );
    case "cover":
      return (
        <>
          <path d="M12 3.2 4.5 6v5.5c0 4.2 2.8 7.9 7.5 9.3 4.7-1.4 7.5-5.1 7.5-9.3V6z" />
          <path d="m8.5 12 2.2 2.2 4.8-4.8" />
        </>
      );
    case "events":
      return (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2.2" />
          <path d="M3 9.5h18" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <circle cx="12" cy="14.5" r="2.2" />
        </>
      );
    case "reports":
      return (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
          <path d="M9 16h4" />
        </>
      );
    case "earnings":
      return (
        <>
          <path d="M4 18h16" />
          <path d="m6 15 4-4 3 2 5-6" />
          <circle cx="10" cy="9" r="2.3" />
          <path d="M10 7.4v3.2" />
          <path d="M9 8h2" />
        </>
      );
    case "settings":
      return (
        <>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15.2a1 1 0 0 0 .2 1.1l.1.1a1.5 1.5 0 1 1-2.1 2.1l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.5 1.5 0 0 1-3 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.5 1.5 0 1 1-2.1-2.1l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H7a1.5 1.5 0 0 1 0-3h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.5 1.5 0 1 1 2.1-2.1l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V7a1.5 1.5 0 0 1 3 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.5 1.5 0 1 1 2.1 2.1l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a1.5 1.5 0 0 1 0 3h-.2a1 1 0 0 0-.9.6z" />
        </>
      );
    case "approvals":
      return (
        <>
          <path d="M12 2.5 4 6v6c0 4.8 3.2 8.8 8 10 4.8-1.2 8-5.2 8-10V6z" />
          <path d="m8.5 12.4 2.2 2.2 4.8-4.8" />
        </>
      );
    case "upload":
      return (
        <>
          <path d="M12 15V4" />
          <path d="m8 8 4-4 4 4" />
          <path d="M4 15.5v3A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-3" />
        </>
      );
    case "calendar":
      return (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2.2" />
          <path d="M3 9.5h18" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
        </>
      );
    case "time":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.8v4.6l3.1 1.8" />
        </>
      );
    case "filter":
      return (
        <>
          <path d="M3 5h18" />
          <path d="M6.5 11h11" />
          <path d="M10 17h4" />
        </>
      );
    case "notifications":
      return (
        <>
          <path d="M15 18H9" />
          <path d="M17 8a5 5 0 1 0-10 0c0 4-2 5-2 5h14s-2-1-2-5z" />
        </>
      );
    case "user":
      return (
        <>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </>
      );
    case "logout":
      return (
        <>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </>
      );
    case "home":
      return (
        <>
          <path d="m3 11 9-8 9 8" />
          <path d="M6.5 9.5V21h11V9.5" />
        </>
      );
    case "plus":
      return (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      );
    case "sun":
      return (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.2" />
          <path d="M12 19.3v2.2" />
          <path d="m4.9 4.9 1.6 1.6" />
          <path d="m17.5 17.5 1.6 1.6" />
          <path d="M2.5 12h2.2" />
          <path d="M19.3 12h2.2" />
          <path d="m4.9 19.1 1.6-1.6" />
          <path d="m17.5 6.5 1.6-1.6" />
        </>
      );
    case "moon":
      return (
        <>
          <path d="M20 14.3A7.8 7.8 0 1 1 9.7 4a8.2 8.2 0 0 0 10.3 10.3z" />
        </>
      );
    default:
      return <circle cx="12" cy="12" r="8" />;
  }
}

export default function AppIcon({
  name,
  size = 18,
  strokeWidth = 1.8,
  className = "",
  ...rest
}: AppIconProps) {
  return (
    <svg
      className={`app-icon app-icon-${name} ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {renderIconPath(name)}
    </svg>
  );
}
