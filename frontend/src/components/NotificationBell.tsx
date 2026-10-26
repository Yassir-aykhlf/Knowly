import { useCallback, useEffect, useRef, useState } from 'react'

import { usePolling } from '../hooks/usePolling'
import { api } from '../lib/api'
import { NavLink } from 'react-router-dom'
import { UnreadCount } from '../lib/types'

export default function NotificationBell() {
	const [count, setCount] = useState(0)
	const [open, setOpen] = useState(false)

	const buttonRef = useRef<HTMLButtonElement>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)

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

	return (
		<NavLink
			key={"/notifications"}
			to={"/notifications"}
			className={({ isActive }) =>
				`flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[14px] ${isActive
					? 'bg-[rgba(13,148,136,0.08)] font-semibold text-accent'
					: 'font-medium text-[#46544F] hover:bg-canvas hover:text-ink'
				}`
			}
		>
			{<svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 6a4.5 4.5 0 0 0-9 0c0 5.25-2.25 6.75-2.25 6.75h13.5S13.5 11.25 13.5 6M10.275 15.75a1.5 1.5 0 0 1-2.55 0" /></svg>}
			<span className="flex-1">{'Notifications'}</span>
			{count > 0 && (
				<span className={`flex h-[19px] items-center justify-center rounded-full px-2 text-[11px] font-bold bg-[#0d9488] text-[#FFFFFF]`}>
					{count}
				</span>
			)}
		</NavLink>
	)
}
