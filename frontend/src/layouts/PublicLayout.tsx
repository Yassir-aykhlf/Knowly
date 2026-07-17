import { Link, Outlet } from 'react-router-dom'

import Footer from './Footer'

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 px-4 py-3">
        <Link to="/" className="text-lg font-semibold text-accent">Knowly</Link>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
