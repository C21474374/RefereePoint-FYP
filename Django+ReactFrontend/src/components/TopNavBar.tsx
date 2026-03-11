import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Games', path: '/games' },
  { name: 'Cover Requests', path: '/cover-requests' },
  { name: 'Events', path: '/events' },
  { name: 'Reports', path: '/reports' },
  { name: 'Earnings', path: '/earnings' },
];

const TopNavBar: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="top-nav-bar">
      <div className="nav-left">
        <span className="nav-title">RefereePoint</span>
      </div>
      <div className="nav-center">
        {navLinks.map(link => (
          <Link
            key={link.name}
            to={link.path}
            className={
              'nav-link' + (location.pathname === link.path ? ' active' : '')
            }
          >
            {link.name}
          </Link>
        ))}
      </div>
      <div className="nav-right">
        <span className="nav-user">Demet</span>
        {/* Add avatar or notifications here if needed */}
      </div>
    </nav>
  );
};

export default TopNavBar;
