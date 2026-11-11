import { Link, Outlet } from 'react-router-dom'

import Footer from './Footer'
import { useAuth } from '../contexts/AuthContext'

export default function PublicLayout() {
  const { user } = useAuth()

  return (
    <div className="flex min-h-dvh flex-col bg-canvas-main">
      <header className="mx-auto flex w-full max-w-[1160px] items-center justify-between gap-3 px-4 py-4 lg:px-10">
        <Link to="/" className="flex items-center gap-2.5 no-underline" aria-label="Knowly home">
          <span className="ah-kmark" aria-hidden="true">K</span>
          <span className="font-display text-[20px] font-bold tracking-[-0.02em] text-ink">Knowly</span>
        </Link>
        <nav aria-label="Account" className="flex items-center gap-1">
          {user ? (
            <Link to="/home" className="ah-btn-dark ah-btn-sm">Open Knowly</Link>
          ) : (
            <>
              <Link to="/login" className="ah-btn-ghost ah-btn-sm">Sign in</Link>
              <Link to="/register" className="ah-btn-dark ah-btn-sm">Get started</Link>
            </>
          )}
        </nav>
      </header>
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
