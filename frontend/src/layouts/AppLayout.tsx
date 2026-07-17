import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'

import NotificationBell from '../components/NotificationBell'
import { useAuth } from '../contexts/AuthContext'
import { useHeartbeat } from '../hooks/useHeartbeat'

const navItems = [
  { to: '/home', label: 'Home' },
  { to: '/ask', label: 'Ask' },
  { to: '/search', label: 'Search' },
  { to: '/messages', label: 'Messages' },
  { to: '/friends', label: 'Friends' },
  { to: '/ai', label: 'AI' },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  // Keep our online status fresh while any authenticated screen is open.
  useHeartbeat()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-slate-200 px-4 py-3">
        <Link to="/home" className="text-lg font-semibold text-accent">Knowly</Link>
        <nav className="flex flex-1 gap-3 text-sm">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'font-semibold text-accent' : 'text-slate-600 hover:text-accent'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <NotificationBell />
        {user && (
          <Link to={`/users/${user.id}`} className="text-sm text-slate-600 hover:text-accent">
            {user.username}
          </Link>
        )}
        <Link to="/settings" className="text-sm text-slate-600 hover:text-accent">Settings</Link>
        <button onClick={handleLogout} className="text-sm text-slate-600 hover:text-accent">
          Log out
        </button>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
