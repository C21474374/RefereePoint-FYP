import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { Game } from "../pages/Games";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as L.Icon.Default & {
  _getIconUrl?: () => string;
})._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type VenueGroup = {
  venueId: number;
  venueName: string;
  lat: number;
  lng: number;
  games: Game[];
};

type GamesMapProps = {
  games: Game[];
  selectedVenueId: number | null;
  onVenueSelect: (venueId: number | null) => void;
};

function ResizeMap() {
  const map = useMap();

  useEffect(() => {
    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => clearTimeout(timeout);
  }, [map]);

  return null;
}

export default function GamesMap({
  games,
  selectedVenueId,
  onVenueSelect,
}: GamesMapProps) {
  // Group games by venue
  const venueGroups = useMemo<VenueGroup[]>(() => {
    const grouped = new Map<number, VenueGroup>();

    games.forEach((game) => {
      if (
        game.venue === null ||
        game.venue_name === null ||
        game.lat === null ||
        game.lng === null
      ) {
        return;
      }

      if (!grouped.has(game.venue)) {
        grouped.set(game.venue, {
          venueId: game.venue,
          venueName: game.venue_name,
          lat: game.lat,
          lng: game.lng,
          games: [],
        });
      }

      grouped.get(game.venue)!.games.push(game);
    });

    return Array.from(grouped.values());
  }, [games]);

  const mapCenter: [number, number] =
    venueGroups.length > 0
      ? [venueGroups[0].lat, venueGroups[0].lng]
      : [53.3498, -6.2603];

  return (
    <div className="games-map-panel">
      <div className="games-map-header">
        <h2>Map View</h2>
        <span>{venueGroups.length} venues shown</span>
      </div>

      <div className="games-map-wrapper">
        <MapContainer
          center={mapCenter}
          zoom={11}
          scrollWheelZoom={true}
          className="games-leaflet-map"
        >
          <ResizeMap />

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {venueGroups.map((venue) => (
            <Marker
              key={venue.venueId}
              position={[venue.lat, venue.lng]}
              eventHandlers={{
                click: () => {
                  onVenueSelect(venue.venueId);
                },
              }}
            >
              <Popup>
                <div>
                  <strong>{venue.venueName}</strong>
                  <br />
                  {venue.games.length} game{venue.games.length !== 1 ? "s" : ""} at this venue
                  
                
                    
               
                  {selectedVenueId === venue.venueId && (
                    <>
                      <br />
                      <small>Currently displaying in games list</small>
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}