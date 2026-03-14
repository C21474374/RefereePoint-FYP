import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { Game } from "../pages/Games";
import "leaflet/dist/leaflet.css";

// Hooks
import { useEffect } from "react";
import { useMap } from "react-leaflet";

function ResizeMap() {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);

  return null;
}

type GamesMapProps = {
  games: Game[];
};

export default function GamesMap({ games }: GamesMapProps) {
  // Default map center = Dublin
  // If there are filtered games, center on the first one
  const mapCenter: [number, number] =
    games.length > 0 ? [games[0].lat, games[0].lng] : [53.3498, -6.2603];

  return (
    <div className="games-map-panel">
      {/* Header above the map */}
      <div className="games-map-header">
        <h2>Map View</h2>
        <span>{games.length} games shown</span>
      </div>

      {/* Real React Leaflet map */}
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

          {games.map((game) => (
            <Marker key={game.id} position={[game.lat, game.lng]}>
              <Popup>
                <strong>
                  {game.homeTeam} vs {game.awayTeam}
                </strong>
                <br />
                {game.venue}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}