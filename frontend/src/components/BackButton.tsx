import { Link, type To } from 'react-router-dom'

import NavIcon from './NavIcon'

export default function BackButton({ to, label = 'Back' }: { to: To; label?: string }) {
  return (
    <Link to={to} className="ah-back">
      <NavIcon name="back" size={16} strokeWidth={2} />
      {label}
    </Link>
  )
}
