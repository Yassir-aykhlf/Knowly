import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { usePolling } from '../hooks/usePolling'
import { api } from '../lib/api'
import { relativeTime } from '../lib/format'
import { describeNotification } from '../lib/notifications'
import type { AppNotification, Paginated, UnreadCount } from '../lib/types'
import Avatar from './Avatar'

export default function NotificationBell() {
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef(0)

  const navigate = useNavigate()

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await api.get<UnreadCount>('/notifications/unread-count')
      setCount(data.count)
    } catch {
    }
  }, [])

  useEffect(() => {
    void fetchUnreadCount()
  }, [fetchUnreadCount])

  usePolling(fetchUnreadCount, 30000)


  async function fetchNotifications() {
    const requestId = ++requestRef.current

    setNotifications(null)

    try {
      const data = await api.get<Paginated<AppNotification>>('/notifications?limit=10')
      if (requestRef.current === requestId) {
        setNotifications(data.items)
      }
    } catch {
      if (requestRef.current === requestId) {
        setNotifications([])
      }
    }
  }


  function toggleDropdown() {
    const next = !open

    setOpen(next)

    if (next) {
      void fetchNotifications()
    }
  }


  useEffect(() => {
    if (!open) return

    function handleClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)

    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])


  useEffect(() => {
    if (!open) return

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])


  async function openNotification(notification: AppNotification) {
    setOpen(false)

    if (notification.read_at === null) {
      try {
        await api.put(`/notifications/${notification.id}/read`)
      } catch {
      }

      void fetchUnreadCount()
    }

    navigate(notification.link)
  }


  async function markAllRead() {
    try {
      await api.put('/notifications/read-all')
    } catch {
      return
    }

    setCount(0)

    setNotifications(previous =>
      previous
        ? previous.map(notification => ({
            ...notification,
            read_at: notification.read_at ?? new Date().toISOString(),
          }))
        : previous
    )
  }


  return (
    <div ref={dropdownRef} className="relative">

      <button
        ref={buttonRef}
        type="button"
        aria-label={count > 0 ? `Notifications (${count} unread)` : 'Notifications'}
        aria-expanded={open}
        onClick={toggleDropdown}
        className="relative"
      >
        🔔

        {count > 0 && (
          <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1.5 text-xs text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>


      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border bg-white shadow-lg">

          <div className="flex justify-between border-b p-3">
            <span>Notifications</span>

            <button type="button" onClick={() => void markAllRead()}>
              Mark all read
            </button>
          </div>


          {notifications === null && (
            <p className="p-3">
              Loading...
            </p>
          )}


          {notifications !== null && notifications.length === 0 && (
            <p className="p-3">
              You&rsquo;re all caught up.
            </p>
          )}


          {notifications !== null && notifications.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map(notification => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void openNotification(notification)}
                  className={`flex w-full gap-3 p-3 text-left ${notification.read_at ? '' : 'bg-gray-100'}`}
                >

                  <Avatar user={notification.actor ?? { username: 'Someone', avatar_url: null }} size={32} />

                  <div>
                    <p>
                      {describeNotification(notification)}
                    </p>

                    <span>
                      {relativeTime(notification.created_at)}
                    </span>
                  </div>

                </button>
              ))}
            </div>
          )}


          <div className="border-t p-3 text-center">
            <Link to="/notifications" onClick={() => setOpen(false)}>
              See all
            </Link>
          </div>

        </div>
      )}
    </div>
  )
}