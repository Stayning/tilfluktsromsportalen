import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Login from '@/pages/Login'
import Onboarding from '@/pages/Onboarding'
import Dashboard from '@/pages/Dashboard'
import ShelterList from '@/pages/ShelterList'
import ShelterDetail from '@/pages/ShelterDetail'
import ShelterEdit from '@/pages/ShelterEdit'
import UserDirectory from '@/pages/UserDirectory'
import CustomerDirectory from '@/pages/CustomerDirectory'
import CustomerDetail from '@/pages/CustomerDetail'
import VurderingDetail from '@/pages/VurderingDetail'
import RapportList from '@/pages/RapportList'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-500">Loading...</div>
    </div>
  )
}

// Route for users who are NOT logged in
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/oversikt" replace />

  return <>{children}</>
}

// Route for users who ARE logged in but may need onboarding
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/innlogging" replace />

  // Check if user needs to complete onboarding (no ToS accepted)
  if (!profile?.tos_accepted_at) {
    return <Navigate to="/velkommen" replace />
  }

  return <>{children}</>
}

// Route specifically for onboarding - user must be logged in but NOT have completed onboarding
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/innlogging" replace />

  // If already completed onboarding, redirect to dashboard
  if (profile?.tos_accepted_at) {
    return <Navigate to="/oversikt" replace />
  }

  return <>{children}</>
}

// Route for admin-only pages
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/innlogging" replace />

  // Check if user needs to complete onboarding
  if (!profile?.tos_accepted_at) {
    return <Navigate to="/velkommen" replace />
  }

  // Check if user is admin
  if (!isAdmin) {
    return <Navigate to="/oversikt" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/innlogging"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/velkommen"
        element={
          <OnboardingRoute>
            <Onboarding />
          </OnboardingRoute>
        }
      />
      <Route
        path="/oversikt"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tilfluktsrom"
        element={
          <ProtectedRoute>
            <ShelterList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tilfluktsrom/ny"
        element={
          <ProtectedRoute>
            <ShelterEdit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tilfluktsrom/:id"
        element={
          <ProtectedRoute>
            <ShelterDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tilfluktsrom/:id/rediger"
        element={
          <ProtectedRoute>
            <ShelterEdit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vurderinger/:id"
        element={
          <ProtectedRoute>
            <VurderingDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inspeksjonsrapporter"
        element={
          <AdminRoute>
            <RapportList />
          </AdminRoute>
        }
      />
      <Route
        path="/inspeksjonsrapporter/:id"
        element={
          <AdminRoute>
            <VurderingDetail from="rapporter" />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/brukere"
        element={
          <AdminRoute>
            <UserDirectory />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/kunder"
        element={
          <AdminRoute>
            <CustomerDirectory />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/kunder/:id"
        element={
          <AdminRoute>
            <CustomerDetail />
          </AdminRoute>
        }
      />
      <Route path="/" element={<Navigate to="/oversikt" replace />} />
      <Route path="*" element={<Navigate to="/oversikt" replace />} />
    </Routes>
  )
}
