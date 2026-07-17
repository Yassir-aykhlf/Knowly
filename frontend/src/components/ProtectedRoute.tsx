// Guards the authenticated routes. While we're still figuring out who the user
// is (isLoading) we render nothing so we don't flash the login page at someone
// who is actually signed in. No user -> send them to /login.
import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
