import { Link, Outlet } from 'react-router-dom'

// Sign in / register: a dark brand panel beside the form on desktop, the form
// alone (with the logo above it) on smaller screens.
export default function AuthLayout() {
  return (
    <div className="grid min-h-dvh bg-canvas-main lg:grid-cols-[5fr_6fr]">
      <aside className="hidden flex-col justify-between bg-sidebar p-10 lg:flex xl:p-14">
        <Link to="/" className="flex items-center gap-2.5 no-underline" aria-label="Knowly home">
          <span className="ah-kmark" aria-hidden="true">K</span>
          <span className="font-display text-[20px] font-bold tracking-[-0.02em] text-white">Knowly</span>
        </Link>
        <p className="max-w-[420px] text-balance font-display text-[34px] font-bold leading-[1.12] tracking-[-0.03em] text-white">
          Ask better questions. Get answers worth keeping.
        </p>
        <p className="text-body-sm text-sidebar-muted">
          © Knowly ·{' '}
          <Link to="/privacy-policy" className="hover:text-white">Privacy</Link> ·{' '}
          <Link to="/terms-of-service" className="hover:text-white">Terms</Link>
        </p>
      </aside>

      <main className="flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <Link to="/" className="mb-8 flex items-center gap-2.5 no-underline lg:hidden" aria-label="Knowly home">
            <span className="ah-kmark" aria-hidden="true">K</span>
            <span className="font-display text-[20px] font-bold tracking-[-0.02em] text-ink">Knowly</span>
          </Link>
          <Outlet />
          <p className="mt-10 text-center text-meta text-ink-faint lg:hidden">
            © Knowly ·{' '}
            <Link to="/privacy-policy" className="hover:text-accent-dark">Privacy</Link> ·{' '}
            <Link to="/terms-of-service" className="hover:text-accent-dark">Terms</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
