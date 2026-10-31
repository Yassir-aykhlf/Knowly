import { Link, Outlet } from 'react-router-dom'
import KnowlyLogo from '../../assets/KnowlyLogo.svg'

import Footer from './Footer'

export default function PublicLayout() {
	return (
		<div className="flex min-h-screen flex-col">
			<header className="flex border-b border-slate-200 px-4 py-3">
				<div className="flex h-10 w-full">
					<Link to="/" className="flex h-full items-center justify-start rounded-lg">
						<img
							src={KnowlyLogo}
							alt="Knowly logo"
							className="h-full max-h-12 w-auto object-contain"
						/>
					</Link>
				</div>
				// <div className="flex h-10 w-full justify-center items-center">
				// 	something
				// </div>
				// <div className="flex h-10 w-full justify-end items-center">
				// 	else
				// </div>
			</header>
			<main className="flex-1">
				<Outlet />
			</main>
			<Footer />
		</div>
	)
}
