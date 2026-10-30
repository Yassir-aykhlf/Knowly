import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'

import NotificationBell from '../components/NotificationBell'
import { useAuth } from '../contexts/AuthContext'
import { useHeartbeat } from '../hooks/useHeartbeat'
import FriendsBell from '../components/friendsBell'
import KnowlyLogo from '../../assets/KnowlyLogo.svg'
import AllUsercell from '../components/UsersComp'

const mainNav = [
	{
		to: '/home',
		label: 'Questions',
		icon: <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.25 7.875L9 2.25L15.75 7.875M3.75 7.125V15.75H14.25V7.125" /></svg>,
	},
	{
		to: '/ask',
		label: 'Ask',
		icon: <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3.75v10.5M3.75 9h10.5" /></svg>,
	},
	{
		to: '/ai',
		label: 'AI Assistant',
		icon: <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2.25L10.425 5.7L13.875 7.125L10.425 8.55L9 12L7.575 8.55L4.125 7.125L7.575 5.7L9 2.25M14.25 11.25L14.775 12.6L16.125 13.125L14.775 13.65L14.25 15L13.725 13.65L12.375 13.125L13.725 12.6L14.25 11.25" /></svg>,
	},
	{
		to: '/messages',
		label: 'Messages',
		icon: <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15.75 8.625A6.75 6.75 0 0 1 9.375 15C8.33 14.986 7.304 14.729 6.375 14.25L2.25 15L3 11.625C2.25 9.67 2.25 8.625 2.25 8.625a6.75 6.75 0 1 1 13.5 0Z" /></svg>,
	},
]

export default function AppLayout() {
	const { user, logout } = useAuth()
	const navigate = useNavigate()
	useHeartbeat()

	async function handleLogout() {
		await logout()
		navigate('/login')
	}

	const renderItem = (item: (typeof mainNav)[0] & { badge?: string; badgeCls?: string }) => (
		<NavLink
			key={item.to}
			to={item.to}
			className={({ isActive }) =>
				`flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[14px] ${isActive
					? 'bg-[rgba(13,148,136,0.08)] font-semibold text-accent'
					: 'font-medium text-[#46544F] hover:bg-canvas hover:text-ink'
				}`
			}
		>
			{item.icon}
			<span className="flex-1">{item.label}</span>
			{item.badge && (
				<span className={`flex h-[19px] items-center justify-center rounded-full px-2 text-[11px] font-bold ${item.badgeCls}`}>
					{item.badge}
				</span>
			)}
		</NavLink>
	)

	return (
		<div className="flex min-h-screen flex-col bg-canvas md:flex-row">
			<aside className="flex w-full shrink-0 flex-col justify-between border-b border-line bg-surface p-4 md:sticky md:top-0 md:h-screen md:w-[262px] md:border-b-0 md:border-r md:overflow-y-auto">
				<div>
					<div className="flex h-20 w-full items-center justify-left">
						<Link to="/home" className="flex h-full items-center justify-center rounded-lg">
							<img
								src={KnowlyLogo}
								alt="Knowly logo"
								className="h-full max-h-12 w-auto object-contain"
							/>
						</Link>
					</div>

					<Link
						to="/search"
						className="mb-2 flex items-center gap-[9px] rounded-[10px] border border-line-subtle bg-surface-subtle px-[11px] py-[9px] text-[13.5px] text-ink-faint hover:border-line"
					>
						<svg className="h-4 w-4 shrink-0 text-ink-faint" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.47" strokeLinecap="round">
							<circle cx="7.33" cy="7.33" r="4.67" /><path d="m14 14-2.87-2.87" />
						</svg>
						<span className="flex-1">Search</span>
						<kbd className="rounded-[5px] border border-line-subtle bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-faint">/</kbd>
					</Link>

					<nav className="flex flex-col gap-[5px]">
						{mainNav.map(renderItem)}
						{user?.role === 'admin' && (
							<NavLink to="/admin/moderation" className="block rounded-lg px-3 py-2">
								Moderation
							</NavLink>
						)}
						<div className="px-[11px] pb-1.5 pt-3.5 font-display text-[11px] font-bold tracking-[0.07em] text-[#A4AFAA]">
							SOCIAL
						</div>
					</nav>
					<NotificationBell />
					<FriendsBell />
					<AllUsercell />

				</div>

				{user && (
					<div className="mt-auto border-t border-[#EEF1EF] px-[9px] pb-[9px] pt-[13px]">
						<div className="flex items-center gap-2.5">
							<Link to={`/users/${user.id}`} className="group flex flex-1 items-center gap-2.5 min-w-0">
								<div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold uppercase text-white">
									{user.username.slice(0, 2)}
								</div>
								<div className="flex flex-1 flex-col min-w-0">
									<span className="truncate text-[13.5px] font-semibold text-ink group-hover:text-accent">
										{user.username}
									</span>
									<span className="text-[12px] text-ink-faint">View profile</span>
								</div>
							</Link>
							<Link to="/settings" title="Settings" className="p-1 text-ink-faint hover:text-ink">
								<svg className="h-[15px] w-[15px] shrink-0 text-[#AAB3AE]" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
									<circle cx="7.5" cy="7.5" r="1.88" /><path d="M12.13 9.38a1.1 1.1 0 0 0 .24 1.17l.04.04a1.15 1.15 0 0 1-1.63 1.62l-.04-.04a1.1 1.1 0 0 0-1.14-.2 1.1 1.1 0 0 0-.8 1.05v.1a1.15 1.15 0 0 1-2.3 0v-.05a1.1 1.1 0 0 0-.68-.95 1.1 1.1 0 0 0-1.14.2l-.04.04a1.15 1.15 0 0 1-1.62-1.62l.04-.04a1.1 1.1 0 0 0 .2-1.14 1.1 1.1 0 0 0-1.05-.8H1.88a1.15 1.15 0 0 1 0-2.3h.05a1.1 1.1 0 0 0 .95-.68 1.1 1.1 0 0 0-.2-1.14l-.04-.04a1.15 1.15 0 0 1 1.62-1.62l.04.04a1.1 1.1 0 0 0 1.14.2h.05a1.1 1.1 0 0 0 .8-1.05V1.88a1.15 1.15 0 0 1 2.3 0v.05a1.1 1.1 0 0 0 .68.95 1.1 1.1 0 0 0 1.14-.2l.04-.04a1.15 1.15 0 0 1 1.62 1.62l-.04.04a1.1 1.1 0 0 0-.2 1.14v.05a1.1 1.1 0 0 0 1.05.8h.1a1.15 1.15 0 0 1 0 2.3h-.05a1.1 1.1 0 0 0-.95.68z" />
								</svg>
							</Link>
							<button onClick={handleLogout} className="text-[12px] text-ink-faint hover:text-accent">
								Log out
							</button>
						</div>
					</div>
				)}
			</aside>

			<main className="flex-1 min-w-0">
				<Outlet />
			</main>
		</div>
	)
}
