import React, { useEffect } from "react";
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

type GamesMapProps = {
  games: Game[];
};

function ResizeMap() {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);

  return null;
}

export default function GamesMap({ games }: GamesMapProps) {
  const gamesWithCoords = games.filter(
    (game) => game.lat !== null && game.lng !== null
  );

  const mapCenter: [number, number] =
    gamesWithCoords.length > 0
      ? [gamesWithCoords[0].lat as number, gamesWithCoords[0].lng as number]
      : [53.3498, -6.2603];

  return (
    <div className="games-map-panel">
      <div className="games-map-header">
        <h2>Map View</h2>
        <span>{gamesWithCoords.length} games shown</span>
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

          {gamesWithCoords.map((game) => (
            <Marker
              key={game.id}
              position={[game.lat as number, game.lng as number]}
            >
              <Popup>
                <div>
                  <strong>
                    {game.home_team_name} vs {game.away_team_name}
                  </strong>
                  <br />
                  {game.venue_name}
                  <br />
                  {game.date} at {game.time}
                  <br />
                  {game.division_display}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}