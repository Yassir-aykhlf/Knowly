import { Link } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'

type Props = { code: string; title: string; children: string }

// Full-page message for 403 / 404.
export default function StatusPage({ code, title, children }: Props) {
  const { user } = useAuth()
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <p className="font-mono text-body-sm font-bold uppercase tracking-[0.08em] text-accent-dark">{code}</p>
        <h1 className="ah-h1 mt-2">{title}</h1>
        <p className="ah-lead mt-3">{children}</p>
        <Link to={user ? '/home' : '/'} className="ah-btn-primary mt-6">
          {user ? 'Back to questions' : 'Back to the home page'}
        </Link>
      </div>
    </div>
  )
}
