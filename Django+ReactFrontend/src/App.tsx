import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import RefereeSignup from './pages/RefereeSignup'
import RefereeLogin from './pages/RefereeLogin'
import RefereeDashboard from './pages/RefereeDashboard'
import Games from './pages/Games'
import CoverRequests from './pages/CoverRequests'
import Events from './pages/Events'
import Reports from './pages/Reports'
import Earnings from './pages/Earnings'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes (no layout) */}
        <Route path="/signup" element={<RefereeSignup />} />
        <Route path="/login" element={<RefereeLogin />} />
        
        {/* Protected routes (with layout) */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<RefereeDashboard />} />
          <Route path="/games" element={<Games />} />
          <Route path="/cover-requests" element={<CoverRequests />} />
          <Route path="/events" element={<Events />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/earnings" element={<Earnings />} />
        </Route>
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
