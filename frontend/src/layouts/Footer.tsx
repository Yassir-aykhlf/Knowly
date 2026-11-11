import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-line px-4 py-6 text-center text-body-sm text-ink-faint">
      <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <Link to="/privacy-policy" className="hover:text-accent-dark">Privacy Policy</Link>
        <span aria-hidden="true">·</span>
        <Link to="/terms-of-service" className="hover:text-accent-dark">Terms of Service</Link>
        <span aria-hidden="true">·</span>
        <span>© Knowly</span>
      </nav>
    </footer>
  )
}
