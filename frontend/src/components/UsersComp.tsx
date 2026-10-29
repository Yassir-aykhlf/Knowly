import { NavLink } from 'react-router-dom'

export default function AllUsercell() {
	return (
		<NavLink
			key={'/Users'}
			to={'/users'}
			className={({ isActive }) =>
				`flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[14px] ${isActive
					? 'bg-[rgba(13,148,136,0.08)] font-semibold text-accent'
					: 'font-medium text-[#46544F] hover:bg-canvas hover:text-ink'
				}`
			}
		>
			{<svg
				className="h-[18px] w-[18px] shrink-0"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M18.5 19.5L20 21M4 21C4 17.134 7.13401 14 11 14M19 17.5C19 18.8807 17.8807 20 16.5 20C15.1193 20 14 18.8807 14 17.5C14 16.1193 15.1193 15 16.5 15C17.8807 15 19 16.1193 19 17.5ZM15 7C15 9.20914 13.2091 11 11 11C8.79086 11 7 9.20914 7 7C7 4.79086 8.79086 3 11 3C13.2091 3 15 4.79086 15 7Z"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
			}
			<span className="flex-1">{'Users'}</span>
		</NavLink>
	)
}
