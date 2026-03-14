import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { Opportunity } from "../pages/Games";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
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

  return (
    <MapContainer
      center={[53.3498, -6.2603]}
      zoom={10}
      scrollWheelZoom={true}
      className="games-map"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {venues.map((venue) => (
        <Marker
          key={venue.venueId}
          position={[venue.lat, venue.lng]}
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