import { Outlet, Link, useLocation } from 'react-router-dom'
import React from 'react';
import TopNavBar from './TopNavBar';

const navItems = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/games', label: 'Games' },
  { path: '/cover-requests', label: 'Cover Requests' },
  { path: '/events', label: 'Events' },
  { path: '/reports', label: 'Reports' },
  { path: '/earnings', label: 'Earnings' },
  { path: '/upload-game', label: 'Upload Game' }
]

export default function Layout() {
  const location = useLocation()

  return (
    <div>
      <TopNavBar />
      <main style={{ marginTop: '60px' }}>
        <Outlet />
      </main>
    </div>
  )
}
