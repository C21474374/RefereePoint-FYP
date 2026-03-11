import React from 'react';

// Example props: array of games with lat/lng, venue name, and game info
interface Game {
  id: string;
  venue: string;
  lat: number;
  lng: number;
  date: string;
  teams: string;
}

interface GamesMapProps {
  games: Game[];
}

// This component uses Leaflet for mapping
// To use: install leaflet and react-leaflet
// npm install leaflet react-leaflet
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const defaultPosition = { lat: 53.3498, lng: -6.2603 }; // Dublin center

const GamesMap: React.FC<GamesMapProps> = ({ games }) => {
  return (
    <div style={{ height: '500px', width: '100%', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px #0001' }}>
      <MapContainer center={[defaultPosition.lat, defaultPosition.lng]} zoom={11} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {games.map(game => (
          <Marker key={game.id} position={[game.lat, game.lng]}>
            <Popup>
              <strong>{game.venue}</strong><br />
              {game.date}<br />
              {game.teams}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default GamesMap;
