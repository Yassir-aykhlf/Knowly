import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import Avatar from '../components/Avatar'
import NavIcon, { type IconName } from '../components/NavIcon'
import { useAuth } from '../contexts/AuthContext'
import { useHeartbeat } from '../hooks/useHeartbeat'
import { useNavCounts, type NavCounts } from '../hooks/useNavCounts'

const COLLAPSE_KEY = 'knowly.sidebar.collapsed'

type NavItem = {
  to: string
  label: string
  icon: IconName
  badge?: keyof NavCounts
  adminOnly?: boolean
  // Extra path prefixes that should light this item up.
  also?: string[]
}

const NAV_GROUPS: NavItem[][] = [
  [
    { to: '/home', label: 'Ask', icon: 'ask', also: ['/ask'] },
    { to: '/search', label: 'Browse', icon: 'questions', also: ['/questions'] },
    { to: '/ai', label: 'AI Assistant', icon: 'ai' },
    { to: '/messages', label: 'Messages', icon: 'messages', badge: 'messages' },
  ],
  [
    { to: '/notifications', label: 'Notifications', icon: 'notifications', badge: 'notifications' },
    { to: '/friends', label: 'Friends', icon: 'friends', badge: 'friends' },
    { to: '/users', label: 'People', icon: 'users' },
  ],
  [
    { to: '/admin/moderation', label: 'Moderation', icon: 'moderation', adminOnly: true },
    { to: '/settings', label: 'Settings', icon: 'settings' },
  ],
]

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

type SidebarProps = {
  collapsed: boolean
  counts: NavCounts
  onLogout: () => void
}

function SidebarNav({ collapsed, counts, onLogout }: SidebarProps) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const isAdmin = user?.role === 'admin'

  return (
    <>
      <nav aria-label="Main" className="relative min-h-0 overflow-y-auto overflow-x-hidden">
        {NAV_GROUPS.map((group, index) => (
          <div key={group[0].to}>
            {index > 0 && <div className="ah-side-divider" />}
            <ul className="flex flex-col gap-1">
              {group
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => {
                  const count = item.badge ? counts[item.badge] : 0
                  const forced = item.also?.some((prefix) => pathname.startsWith(prefix)) ?? false
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        title={collapsed ? item.label : undefined}
                        aria-label={
                          collapsed ? (count > 0 ? `${item.label}, ${count} new` : item.label) : undefined
                        }
                        className={({ isActive }) =>
                          `ah-side-item ${isActive || forced ? 'ah-side-item-active' : ''} ${
                            collapsed ? 'ah-side-item-collapsed' : ''
                          }`
                        }
                      >
                        <NavIcon name={item.icon} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {count > 0 &&
                          (collapsed ? (
                            <span
                              aria-hidden="true"
                              className="absolute right-3 top-2 h-[9px] w-[9px] rounded-full bg-accent ring-2 ring-sidebar"
                            />
                          ) : (
                            <span className="ah-count">
                              {count > 99 ? '99+' : count}
                              <span className="sr-only"> new</span>
                            </span>
                          ))}
                      </NavLink>
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
      </nav>

      {user && (
        <div
          className={`flex items-center gap-1 border-t border-white/[0.08] pt-3 ${
            collapsed ? 'flex-col' : ''
          }`}
        >
          <Link
            to={`/users/${user.id}`}
            title={collapsed ? 'View profile' : undefined}
            className={`group flex min-w-0 flex-1 items-center gap-2.5 rounded-btn p-1.5 no-underline transition-colors hover:bg-white/[0.06] ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <Avatar user={user} size={34} />
            {!collapsed && (
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body font-semibold text-white">{user.username}</span>
                <span className="text-meta text-sidebar-muted">View profile</span>
              </span>
            )}
          </Link>
          <button type="button" onClick={onLogout} className="ah-side-btn" title="Log out" aria-label="Log out">
            <NavIcon name="logout" size={18} />
          </button>
        </div>
      )}
    </>
  )
}

function Brand() {
  return (
    <Link to="/home" className="flex min-w-0 items-center gap-2.5 rounded-btn no-underline" aria-label="Knowly home">
      <span className="ah-kmark" aria-hidden="true">K</span>
      <span className="font-display text-[20px] font-bold tracking-[-0.02em] text-white">Knowly</span>
    </Link>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const counts = useNavCounts()
  useHeartbeat()

  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLDialogElement>(null)
  const mainRef = useRef<HTMLElement>(null)

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        // Storage can be unavailable (private mode); the toggle still works.
      }
      return next
    })
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  // A new page starts at the top and closes the mobile drawer.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    const dialog = drawerRef.current
    if (!dialog) return
    if (drawerOpen && !dialog.open) dialog.showModal()
    if (!drawerOpen && dialog.open) dialog.close()
  }, [drawerOpen])

  // The drawer is mobile-only: close it if the viewport grows past the breakpoint.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const onChange = () => {
      if (query.matches) setDrawerOpen(false)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const totalNew = counts.notifications + counts.friends + counts.messages

  return (
    <div
      className={`relative grid h-dvh grid-rows-[56px_minmax(0,1fr)] overflow-hidden bg-canvas-main lg:grid-rows-1 ${
        collapsed ? 'lg:grid-cols-[68px_minmax(0,1fr)]' : 'lg:grid-cols-[240px_minmax(0,1fr)]'
      }`}
    >
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-btn focus:bg-surface focus:px-3 focus:py-2 focus:text-body focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>

      {/* Mobile header */}
      <header className="flex items-center gap-1 bg-sidebar px-1.5 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="ah-side-btn relative text-white"
          aria-label={totalNew > 0 ? `Open menu, ${totalNew} new` : 'Open menu'}
          aria-haspopup="dialog"
        >
          <NavIcon name="menu" size={22} />
          {totalNew > 0 && (
            <span aria-hidden="true" className="absolute right-2 top-2 h-[9px] w-[9px] rounded-full bg-accent ring-2 ring-sidebar" />
          )}
        </button>
        <Link to="/home" className="flex-1 font-display text-[19px] font-bold tracking-[-0.02em] text-white no-underline">
          Knowly
        </Link>
        {user && (
          <Link
            to={`/users/${user.id}`}
            aria-label="Your profile"
            className="inline-flex h-11 w-11 items-center justify-center rounded-btn"
          >
            <Avatar user={user} size={32} />
          </Link>
        )}
      </header>

      {/* Mobile drawer */}
      <dialog
        ref={drawerRef}
        aria-label="Menu"
        className="ah-drawer lg:hidden"
        onClose={() => setDrawerOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDrawerOpen(false)
        }}
      >
        <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-2 px-3 py-4">
          <div className="flex items-center justify-between pl-1.5">
            <Brand />
            <button type="button" onClick={() => setDrawerOpen(false)} className="ah-side-btn" aria-label="Close menu">
              <NavIcon name="close" />
            </button>
          </div>
          <SidebarNav collapsed={false} counts={counts} onLogout={() => void handleLogout()} />
        </div>
      </dialog>

      {/* Desktop sidebar */}
      <aside className="hidden min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 bg-sidebar px-3 py-4 lg:grid">
        <div className={`flex h-9 items-center ${collapsed ? 'justify-center' : 'justify-between pl-1.5'}`}>
          {/* Collapsed: the toggle takes the brand's place. */}
          {!collapsed && <Brand />}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="ah-side-btn"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <NavIcon name={collapsed ? 'expand' : 'collapse'} />
          </button>
        </div>
        <SidebarNav collapsed={collapsed} counts={counts} onLogout={() => void handleLogout()} />
      </aside>

      <main
        id="app-main"
        ref={mainRef}
        tabIndex={-1}
        className="relative flex min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden focus:outline-none"
      >
        <Outlet />
      </main>
    </div>
  )
}
