import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { Opportunity } from "../pages/Games";
import { useTheme } from "../context/ThemeContext";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

// Create red marker icons
const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
});

type GamesMapProps = {
  opportunities: Opportunity[];
  selectedVenueId: number | null;
  onVenueSelect: (venueId: number | null) => void;
};

type VenueGroup = {
  venueId: number;
  venueName: string;
  lat: number;
  lng: number;
  items: Opportunity[];
};

const GamesMap = ({ opportunities, selectedVenueId, onVenueSelect }: GamesMapProps) => {
  const { theme } = useTheme();

  const groupedByVenue = opportunities.reduce<Record<number, VenueGroup>>((acc, item) => {
    if (
      item.venue_id === null ||
      item.venue_name === null ||
      item.lat === null ||
      item.lng === null
    ) {
      return acc;
    }

    if (!acc[item.venue_id]) {
      acc[item.venue_id] = {
        venueId: item.venue_id,
        venueName: item.venue_name,
        lat: item.lat,
        lng: item.lng,
        items: [],
      };
    }

    acc[item.venue_id].items.push(item);
    return acc;
  }, {});

  const venues = Object.values(groupedByVenue);

  // Select tile layer based on theme
  const tileLayerUrl = theme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const attribution = theme === 'dark'
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <MapContainer
      center={[53.3498, -6.2603]}
      zoom={10}
      scrollWheelZoom={true}
      className="games-map"
    >
      <TileLayer
        attribution={attribution}
        url={tileLayerUrl}
      />

      {venues.map((venue) => (
        <Marker
          key={venue.venueId}
          position={[venue.lat, venue.lng]}
          icon={redIcon}
          eventHandlers={{
            click: () => onVenueSelect(venue.venueId),
          }}
        >
          <Popup>
            <div className="venue-popup">
              <strong>{venue.venueName}</strong>
              <p>{venue.items.length} opportunity/opportunities</p>
              <button
                type="button"
                className="venue-popup-btn"
                onClick={() =>
                  onVenueSelect(selectedVenueId === venue.venueId ? null : venue.venueId)
                }
              >
                {selectedVenueId === venue.venueId ? "Clear Venue Filter" : "View Opportunities"}
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default GamesMap;