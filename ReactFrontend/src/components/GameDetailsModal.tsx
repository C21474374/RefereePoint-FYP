import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import { useTheme } from "../context/ThemeContext";
import AppIcon from "./AppIcon";
import "leaflet/dist/leaflet.css";
import "./GameDetailsModal.css";

export type GameDetailsModalData = {
  id: string | number;
  title: string;
  typeLabel?: string | null;
  date: string;
  time?: string | null;
  endDate?: string | null;
  venueName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  roleDisplay?: string | null;
  gameTypeDisplay?: string | null;
  divisionDisplay?: string | null;
  paymentTypeDisplay?: string | null;
  statusDisplay?: string | null;
  badge?: string | null;
  description?: string | null;
  reason?: string | null;
  originalRefereeName?: string | null;
  requestedByName?: string | null;
  claimedByName?: string | null;
  postedByName?: string | null;
  feePerGame?: string | null;
  joinedRefereesCount?: number | null;
  slotsLeft?: number | null;
  assignedReferees?: Array<{
    name: string;
    role?: string | null;
    grade?: string | null;
    phone?: string | null;
  }>;
};

type GameDetailsModalProps = {
  open: boolean;
  details: GameDetailsModalData | null;
  onClose: () => void;
  onAction?: () => void;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionBusy?: boolean;
  actionBusyLabel?: string;
  actionHelpText?: string | null;
};

const DEFAULT_CENTER: [number, number] = [53.3498, -6.2603];
const detailsMapMarkerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function formatDateRange(dateValue: string, endDateValue?: string | null) {
  const start = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    return dateValue;
  }

  const startLabel = start.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (!endDateValue || endDateValue === dateValue) {
    return startLabel;
  }

  const end = new Date(`${endDateValue}T00:00:00`);
  if (Number.isNaN(end.getTime())) {
    return startLabel;
  }

  const endLabel = end.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${startLabel} to ${endLabel}`;
}

function formatTimeValue(timeValue: string | null | undefined) {
  if (!timeValue) {
    return "All day";
  }

  const [hours, minutes] = timeValue.split(":");
  if (!hours || !minutes) {
    return timeValue;
  }

  const parsed = new Date();
  parsed.setHours(Number(hours), Number(minutes));
  return parsed.toLocaleTimeString("en-IE", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasUsefulVenueName(venueName: string | null | undefined) {
  if (!venueName) {
    return false;
  }

  const normalized = venueName.trim().toLowerCase();
  return normalized.length > 0 && normalized !== "venue tbc";
}

function buildGoogleMapsDirectionsUrl(details: GameDetailsModalData) {
  if (isFiniteNumber(details.latitude) && isFiniteNumber(details.longitude)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      `${details.latitude},${details.longitude}`
    )}`;
  }

  if (hasUsefulVenueName(details.venueName)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      details.venueName!.trim()
    )}`;
  }

  return null;
}

const GameDetailsModal = ({
  open,
  details,
  onClose,
  onAction,
  actionLabel,
  actionDisabled = false,
  actionBusy = false,
  actionBusyLabel = "Working...",
  actionHelpText = null,
}: GameDetailsModalProps) => {
  const { theme } = useTheme();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open || !details) {
    return null;
  }

  const latitude = details.latitude;
  const longitude = details.longitude;
  const hasCoordinates =
    isFiniteNumber(latitude) && isFiniteNumber(longitude);
  const mapCenter: [number, number] = hasCoordinates
    ? [latitude, longitude]
    : DEFAULT_CENTER;
  const directionsUrl = buildGoogleMapsDirectionsUrl(details);

  const tileLayerUrl =
    theme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const attribution =
    theme === "dark"
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  const detailFields: Array<[string, string | null | undefined]> = [
    ["Date", formatDateRange(details.date, details.endDate)],
    ["Time", formatTimeValue(details.time)],
    ["Venue", details.venueName || "Venue TBC"],
    ["Role", details.roleDisplay],
    ["Game Type", details.gameTypeDisplay],
    ["Division", details.divisionDisplay],
    ["Payment", details.paymentTypeDisplay],
    ["Posted By", details.postedByName],
    ["Requested By", details.requestedByName],
    ["Original Ref", details.originalRefereeName],
    ["Claimed By", details.claimedByName],
    [
      "Fee / Game",
      details.feePerGame ? `EUR ${details.feePerGame}` : null,
    ],
    [
      "Joined Refs",
      details.joinedRefereesCount !== null && details.joinedRefereesCount !== undefined
        ? String(details.joinedRefereesCount)
        : null,
    ],
    [
      "Slots Left",
      details.slotsLeft !== null && details.slotsLeft !== undefined
        ? String(details.slotsLeft)
        : null,
    ],
  ];
  const assignedReferees = details.assignedReferees;
  const shouldShowAssignedReferees = Array.isArray(assignedReferees);

  return (
    <div className="game-details-modal-overlay" onClick={onClose}>
      <div className="game-details-modal" onClick={(event) => event.stopPropagation()}>
        <div className="game-details-modal-header">
          <div>
            <h2 className="section-title-with-icon">
              <span>{details.title}</span>
            </h2>
            <p className="inline-icon-label">
              <span>{details.typeLabel || "Game Opportunity"}</span>
            </p>
          </div>
        </div>

        <div className="game-details-modal-body">
          <div className="game-details-grid">
            {detailFields
              .filter(([, value]) => Boolean(value))
              .map(([label, value]) => (
                <div className="game-details-field" key={label}>
                  <span>{label}</span>
                  <p>{value}</p>
                </div>
              ))}
          </div>

          {details.description && (
            <div className="game-details-block">
              <h3 className="section-title-with-icon">
                <AppIcon name="reports" className="section-title-icon" />
                <span>Description</span>
              </h3>
              <p>{details.description}</p>
            </div>
          )}

          {details.reason && (
            <div className="game-details-block">
              <h3 className="section-title-with-icon">
                <AppIcon name="whistle" className="section-title-icon" />
                <span>Reason</span>
              </h3>
              <p>{details.reason}</p>
            </div>
          )}

          {shouldShowAssignedReferees && (
            <div className="game-details-block">
              <h3 className="section-title-with-icon">
                <AppIcon name="user" className="section-title-icon" />
                <span>Assigned Referees</span>
              </h3>
              {assignedReferees.length === 0 ? (
                <p>No referees assigned yet.</p>
              ) : (
                <div className="game-details-referees-list">
                  {assignedReferees.map((referee, index) => (
                    <div
                      key={`${referee.name}-${referee.role || "role"}-${index}`}
                      className="game-details-referee-item"
                    >
                      <p className="game-details-referee-name">{referee.name}</p>
                      <p className="game-details-referee-meta">
                        {[
                          referee.role || null,
                          referee.grade || null,
                          referee.phone || null,
                        ]
                          .filter(Boolean)
                          .join(" | ")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="game-details-map-section">
            <h3 className="section-title-with-icon">
              <AppIcon name="home" className="section-title-icon" />
              <span>Location</span>
            </h3>
            {hasCoordinates ? (
              <MapContainer
                center={mapCenter}
                zoom={13}
                scrollWheelZoom
                className="game-details-map"
              >
                <TileLayer attribution={attribution} url={tileLayerUrl} />
                <Marker position={mapCenter} icon={detailsMapMarkerIcon}>
                  <Popup>{details.venueName || "Venue location"}</Popup>
                </Marker>
              </MapContainer>
            ) : (
              <p className="game-details-no-map">
                Location coordinates are not available for this game.
              </p>
            )}
            {!directionsUrl && (
              <p className="game-details-directions-help">
                Add a venue to enable directions.
              </p>
            )}
          </div>
        </div>

        <div className="game-details-modal-actions">
          {onAction && actionLabel && (
            <button
              type="button"
              className="game-details-primary"
              onClick={onAction}
              disabled={actionDisabled || actionBusy}
            >
              <span className="button-with-icon">
                <AppIcon name="plus" />
                <span>{actionBusy ? actionBusyLabel : actionLabel}</span>
              </span>
            </button>
          )}
          {directionsUrl && (
            <a
              className="game-details-directions-link"
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="button-with-icon">
                <AppIcon name="home" />
                <span>Get Directions</span>
              </span>
            </a>
          )}
          <button type="button" className="game-details-close-btn" onClick={onClose}>
            <span className="button-with-icon">
              <AppIcon name="filter" />
              <span>Close</span>
            </span>
          </button>
        </div>

        {actionHelpText && <p className="game-details-help">{actionHelpText}</p>}
      </div>
    </div>
  );
};

export default GameDetailsModal;
