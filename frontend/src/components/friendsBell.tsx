import { useCallback, useEffect, useState } from 'react'

import { api } from '../lib/api'
import { NavLink } from 'react-router-dom'
import { PendingRequest } from '../lib/types'

export default function FriendsBell() {
	const [count, setCount] = useState(0)


	const fetchPendingCount = useCallback(async () => {
		try {
			const data = await api.get<PendingRequest[]>('/friends/pending')
			setCount(data.length)
		} catch { }
	}, [])

	useEffect(() => {
		void fetchPendingCount()
	}, [fetchPendingCount])

	return (
		<NavLink
			key={'/friends'}
			to={'/friends'}
			className={({ isActive }) =>
				`flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[14px] ${isActive
					? 'bg-[rgba(13,148,136,0.08)] font-semibold text-accent'
					: 'font-medium text-[#46544F] hover:bg-canvas hover:text-ink'
				}`
			}
		>
			{<svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15.75V14.25C12 12.594 10.656 11.25 9 11.25H4.5C2.844 11.25 1.5 12.594 1.5 14.25V15.75M3.75 5.25a3 3 0 1 0 6 0 3 3 0 0 0-6 0v0M16.5 15.75V14.25c0-1.367-.926-2.56-2.25-2.903M12 2.348c1.327.34 2.256 1.536 2.256 2.906s-.929 2.566-2.256 2.906" /></svg>}
			<span className="flex-1">{'friends'}</span>
			{count > 0 && (
				<span className={`flex h-[19px] items-center justify-center rounded-full px-2 text-[11px] font-bold bg-[#0d9488] text-[#FFFFFF]`}>
					{count}
				</span>
			)}
		</NavLink>
	)
}
