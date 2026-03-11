import React from 'react';
import GamesMap from '../components/GamesMap';

// Example game data
const games = [
  {
    id: '1',
    venue: 'National Basketball Arena',
    lat: 53.3044,
    lng: -6.3798,
    date: '2026-03-15',
    teams: 'Dublin Lions vs Belfast Giants',
  },
  {
    id: '2',
    venue: 'Tallaght Sports Complex',
    lat: 53.2887,
    lng: -6.3731,
    date: '2026-03-16',
    teams: 'Galway Eagles vs Cork Rebels',
  },
  {
    id: '3',
    venue: 'UCD Sports Centre',
    lat: 53.3081,
    lng: -6.2235,
    date: '2026-03-17',
    teams: 'UCD Stars vs Limerick Lakers',
  },
];

export default function Games() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Games</h1>
        <button className="btn-primary">+ Create Game</button>
      </div>
      <p className="page-description">View and manage all scheduled games.</p>

      <div className="filters">
        <select>
          <option value="">All Game Types</option>
          <option value="DOA">DOA</option>
          <option value="NL">National League</option>
          <option value="SCHOOL">School</option>
          <option value="CLUB">Club</option>
          <option value="FRIENDLY">Friendly</option>
        </select>
        <input type="date" />
        <select>
          <option value="">All Divisions</option>
        </select>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <GamesMap games={games} />
      </div>

      <div className="table-container">
        <h2>Upcoming Games</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Venue</th>
              <th>Teams</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {games.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-state">
                  No games scheduled yet
                </td>
              </tr>
            ) : (
              games.map(game => (
                <tr key={game.id}>
                  <td>{game.date}</td>
                  <td>{game.venue}</td>
                  <td>{game.teams}</td>
                  <td>Scheduled</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
