// NotificationBell — STUB. A plain bell that links to the inbox. Task C-03 turns
// this into a polled unread badge with a dropdown of the latest notifications.
import { Link } from 'react-router-dom'

export default function NotificationBell() {
  return (
    <Link to="/notifications" aria-label="Notifications" className="text-slate-600 hover:text-accent">
      🔔
    </Link>
  )
}
