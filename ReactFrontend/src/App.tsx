import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import RefereeSignup from './pages/RefereeSignup'
import RefereeLogin from './pages/RefereeLogin'
import LandingPage from './pages/Landing'
import RefereeDashboard from './pages/RefereeDashboard'
import Games from './pages/Games'
import CoverRequests from './pages/CoverRequests'
import Events from './pages/Events'
import Reports from './pages/Reports'
import Earnings from './pages/Earnings'
import AccountSettings from './pages/AccountSettings'
import AccountApprovals from './pages/AccountApprovals'
import ConfigurePage from './pages/Configure'
import {
  canAccessAccountApprovalsPage,
  canAccessConfigurePage,
  canAccessCoverRequestsPage,
  canAccessEarningsPage,
  canAccessEventsPage,
  canAccessGamesPage,
  canAccessReportsPage,
} from "./utils/access";
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
          <Route
            path="/games"
            element={
              <ProtectedRoute allow={canAccessGamesPage}>
                <Games />
              </ProtectedRoute>
            }
          />
          <Route path="/upload-game" element={<Navigate to="/games" replace />} />
          <Route
            path="/cover-requests"
            element={
              <ProtectedRoute allow={canAccessCoverRequestsPage}>
                <CoverRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events"
            element={
              <ProtectedRoute allow={canAccessEventsPage}>
                <Events />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute allow={canAccessReportsPage}>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/earnings"
            element={
              <ProtectedRoute allow={canAccessEarningsPage}>
                <Earnings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account-approvals"
            element={
              <ProtectedRoute allow={canAccessAccountApprovalsPage}>
                <AccountApprovals />
              </ProtectedRoute>
            }
          />
          <Route
            path="/configure"
            element={
              <ProtectedRoute allow={canAccessConfigurePage}>
                <ConfigurePage />
              </ProtectedRoute>
            }
          />
          <Route path="/upload-games" element={<Navigate to="/games" replace />} />
          <Route path="/account-settings" element={<AccountSettings />} />
        </Route>

        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </ThemeProvider>
)}

export default App
