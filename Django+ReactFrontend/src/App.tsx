import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import RefereeSignup from './pages/RefereeSignup'
import RefereeLogin from './pages/RefereeLogin'
import RefereeDashboard from './pages/RefereeDashboard'
import Games from './pages/Games'
import CoverRequests from './pages/CoverRequests'
import Events from './pages/Events'
import Reports from './pages/Reports'
import Earnings from './pages/Earnings'
import AccountSettings from './pages/AccountSettings'
import AccountApprovals from './pages/AccountApprovals'
import { ThemeProvider } from './context/ThemeContext'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
        <Route path="/signup" element={<RefereeSignup />} />
        <Route path="/login" element={<RefereeLogin />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<RefereeDashboard />} />
          <Route path="/games" element={<Games />} />
          <Route path="/upload-game" element={<Navigate to="/games" replace />} />
          <Route path="/cover-requests" element={<CoverRequests />} />
          <Route path="/events" element={<Events />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/account-approvals" element={<AccountApprovals />} />
          <Route path="/upload-games" element={<Navigate to="/games" replace />} />
          <Route path="/account-settings" element={<AccountSettings />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </ThemeProvider>
)}

export default App
