import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
      <nav className="flex justify-center gap-4">
        <Link to="/privacy-policy" className="hover:text-accent">Privacy Policy</Link>
        <Link to="/terms-of-service" className="hover:text-accent">Terms of Service</Link>
      </nav>
      <p className="mt-2">© Knowly</p>
    </footer>
  )
}
