import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import { useToast } from "../context/ToastContext";

import 'leaflet/dist/leaflet.css';



interface Venue {
  id: number;
  name: string;
  address: string | null;
  lat: number;
  lon: number;
  distance_km?: number;
}

const API_BASE = 'http://127.0.0.1:8000/api';

// Component to recenter map
function RecenterMap({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom());
  }, [lat, lon, map]);
  return null;
}

const styles = {
  container: {
    height: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    padding: '16px 24px',
    background: '#111111',
    color: 'white',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    borderBottom: '1px solid rgba(210,35,42,0.45)',
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: '24px',
    fontWeight: 600,
  },
  controls: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  controlGroup: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    background: 'rgba(210,35,42,0.14)',
    padding: '8px 12px',
    borderRadius: '8px',
  },
  button: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: '#d2232a',
    color: '#ffffff',
  },
  buttonPrimary: {
    background: '#d2232a',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  input: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
  },
  inputNumber: {
    width: '60px',
    textAlign: 'center' as const,
  },
  inputSearch: {
    width: '180px',
  },
  label: {
    fontSize: '14px',
    opacity: 0.9,
  },
  status: {
    marginTop: '12px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '6px',
    fontSize: '14px',
  },
  error: {
    color: '#ffcdd2',
  },
  mapContainer: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    position: 'relative' as const,
  },
  popup: {
    minWidth: '200px',
  },
  popupTitle: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    color: '#333',
  },
  popupAddress: {
    margin: '0 0 4px 0',
    color: '#666',
    fontSize: '14px',
  },
  popupDistance: {
    margin: 0,
    color: '#d2232a',
    fontSize: '14px',
    fontWeight: 500,
  },
};

export default function VenueMap() {
  const { showToast } = useToast();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [searchName, setSearchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'all' | 'nearby' | 'search'>('all');

  // Default center (Dublin)
  const defaultCenter = { lat: 53.3498, lon: -6.2603 };

  // Get user location
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
          setError(null);
        },
        (err) => {
          const locationMessage =
            typeof err?.message === 'string' && err.message.trim()
              ? err.message
              : 'Could not get your location';
          setError(locationMessage);
          showToast(locationMessage, "error");
        }
      );
    } else {
      const message = 'Geolocation not supported';
      setError(message);
      showToast(message, "error");
    }
  };

  // Fetch all venues
  const fetchAllVenues = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/venues/`);
      if (!res.ok) throw new Error('Failed to fetch venues');
      const data = await res.json();
      setVenues(data);
      setMode('all');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching venues';
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch nearby venues
  const fetchNearbyVenues = async () => {
    if (!userLocation) {
      const message = 'Get your location first';
      setError(message);
      showToast(message, "error");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/venues/nearby/?lat=${userLocation.lat}&lon=${userLocation.lon}&radius_km=${radiusKm}`
      );
      if (!res.ok) throw new Error('Failed to fetch nearby venues');
      const data = await res.json();
      setVenues(data);
      setMode('nearby');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching nearby venues';
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Search venues by name
  const searchVenues = async () => {
    if (!searchName.trim()) {
      const message = 'Enter a search term';
      setError(message);
      showToast(message, "error");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/venues/search/?name=${encodeURIComponent(searchName)}`);
      if (!res.ok) throw new Error('Failed to search venues');
      const data = await res.json();
      setVenues(data);
      setMode('search');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error searching venues';
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Load all venues on mount
  useEffect(() => {
    fetchAllVenues();
    getUserLocation();
  }, []);

  const center = userLocation || defaultCenter;

  return (
    <div style={styles.container}>
      {/* Header & Controls */}
      <div style={styles.header}>
        <h1 style={styles.title}>Venue Map</h1>
        
        <div style={styles.controls}>
          {/* All venues */}
          <button
            onClick={fetchAllVenues}
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
          >
            Show All
          </button>

          {/* Location & Nearby */}
          <div style={styles.controlGroup}>
            <button
              onClick={getUserLocation}
              style={styles.button}
              title="Get your location"
            >
              My Location
            </button>
            <input
              type="number"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              style={{ ...styles.input, ...styles.inputNumber }}
              min={1}
              max={100}
            />
            <span style={styles.label}>km</span>
            <button
              onClick={fetchNearbyVenues}
              disabled={loading || !userLocation}
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
                ...(loading || !userLocation ? styles.buttonDisabled : {}),
              }}
            >
              Find Nearby
            </button>
          </div>

          {/* Search */}
          <div style={styles.controlGroup}>
            <input
              type="text"
              placeholder="Search venues..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchVenues()}
              style={{ ...styles.input, ...styles.inputSearch }}
            />
            <button
              onClick={searchVenues}
              disabled={loading}
              style={{
                ...styles.button,
                ...(loading ? styles.buttonDisabled : {}),
              }}
            >
              Search
            </button>
          </div>
        </div>

        {/* Status */}
        <div style={styles.status}>
          {loading && <span>Loading...</span>}
          {error && <span style={styles.error}>{error}</span>}
          {!loading && !error && (
            <span>
              Showing <strong>{venues.length}</strong> venue{venues.length !== 1 ? 's' : ''}
              {mode === 'nearby' && ` within ${radiusKm}km`}
              {mode === 'search' && ` matching "${searchName}"`}
              {userLocation && (
                <> | Your location: {userLocation.lat.toFixed(4)}, {userLocation.lon.toFixed(4)}</>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Map */}
      <div style={styles.mapContainer}>
        <MapContainer
          center={[center.lat, center.lon]}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <RecenterMap lat={center.lat} lon={center.lon} />

          {/* Radius circle when in nearby mode */}
          {mode === 'nearby' && userLocation && (
            <Circle
              center={[userLocation.lat, userLocation.lon]}
              radius={radiusKm * 1000}
              pathOptions={{
                color: '#d2232a',
                fillColor: '#d2232a',
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
          )}

          {/* User location marker */}
          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lon]}>
              <Popup>
                <div style={styles.popup}>
                  <h3 style={styles.popupTitle}>Your Location</h3>
                  <p style={styles.popupAddress}>
                    {userLocation.lat.toFixed(6)}, {userLocation.lon.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Venue markers */}
          {venues.map((venue) => (
            <Marker key={venue.id} position={[venue.lat, venue.lon]}>
              <Popup>
                <div style={styles.popup}>
                  <h3 style={styles.popupTitle}>{venue.name}</h3>
                  {venue.address && (
                    <p style={styles.popupAddress}>{venue.address}</p>
                  )}
                  {venue.distance_km !== undefined && (
                    <p style={styles.popupDistance}>
                      Distance: {venue.distance_km} km
                    </p>
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
