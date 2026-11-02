import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { UserPage } from '../lib/types';
import Avatar from '../components/Avatar';
import UserSearchBar from '../components/UserSearchBar';

const LIMIT = 15;

type State =
	| { status: 'loading' }
	| { status: 'error'; message: string }
	| { status: 'ready'; data: UserPage };

function parsePage(value: string | null): number {
	const n = Number(value);
	return Number.isInteger(n) && n >= 1 ? n : 1;
}

function errorMessage(err: unknown): string {
	return err instanceof Error && err.message ? err.message : 'Something went wrong.';
}

export default function UsersPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const page = parsePage(searchParams.get('page'));
	const q = searchParams.get('q') ?? '';

	const [state, setState] = useState<State>({ status: 'loading' });
	const [attempt, setAttempt] = useState(0); // bumped by Retry to refetch

	useEffect(() => {
		let ignore = false;
		setState({ status: 'loading' });

		const query = new URLSearchParams({
			page: String(page),
			limit: String(LIMIT),
		});
		if (q) query.set('q', q);

		api
			.get<UserPage>(`/users?${query.toString()}`)
			.then((data) => {
				if (!ignore) setState({ status: 'ready', data });
			})
			.catch((err: unknown) => {
				if (!ignore) setState({ status: 'error', message: errorMessage(err) });
			});

		return () => {
			ignore = true;
		};
	}, [page, q, attempt]);

	// A hand-typed ?page=99 beyond the last page jumps to the last page.
	useEffect(() => {
		if (state.status !== 'ready') return;
		const { total, limit } = state.data;
		const lastPage = Math.max(1, Math.ceil(total / limit));
		if (page > lastPage) {
			const params: Record<string, string> = { page: String(lastPage) };
			if (q) params.q = q;
			setSearchParams(params, { replace: true });
		}
	}, [state, page, q, setSearchParams]);

	useEffect(() => {
		window.scrollTo(0, 0);
	}, [page]);

	function goToPage(next: number) {
		const params: Record<string, string> = { page: String(next) };
		if (q) params.q = q;
		setSearchParams(params);
	}

	function handleSearch(value: string) {
		setSearchParams(value ? { q: value, page: '1' } : { page: '1' });
	}

	function renderBody() {
		if (state.status === 'loading') {
			return <p role="status" className="px-10 py-6 text-body text-ink-faint">Loading…</p>;
		}

		if (state.status === 'error') {
			return (
				<div role="alert" className="mx-auto max-w-[880px] px-10 py-8 text-sm">
					<p className="mb-2 text-ink-muted">Couldn&apos;t load users.</p>
					<p className="mb-4 text-ink-faint">{state.message}</p>
					<button type="button" onClick={() => setAttempt((n) => n + 1)} className="ah-btn-secondary">
						Retry
					</button>
				</div>
			);
		}

		const { items, total, limit } = state.data;

		const totalPages = Math.max(1, Math.ceil(total / limit));

		if (items.length === 0) {
			return (
				<p className="mx-auto max-w-[880px] px-10 py-8 text-body text-ink-faint">
					No users found.
				</p>
			);
		}

		return (
			<>
				<div>
					<ul className="flex gap-4 mx-auto w-full max-w-[880px] list-none px-10 pb-20 pt-[34px]">
						{items.map((item) => (

							<li key={item.id}>
								<Avatar user={item} />
								<Link to={`/users/${item.id}`} className="font-medium text-[#46544F] hover:underline">
									{item.username}
								</Link>
								{item.bio}
							</li>
						))}
					</ul>

					<nav className="mx-auto flex w-full max-w-[880px] items-center justify-center gap-4 px-10 pb-20">
						<button
							type="button"
							disabled={page <= 1}
							onClick={() => goToPage(page - 1)}
							className="ah-btn-primary"
						>
							Previous
						</button>

						<span className="text-body font-medium text-ink-faint">
							Page {page} of {totalPages}
						</span>

						<button
							type="button"
							disabled={page >= totalPages}
							onClick={() => goToPage(page + 1)}
							className="ah-btn-primary"
						>
							Next
						</button>
					</nav>
				</div>
			</>
		);
	}

	return (
		<main className="bg-canvas-main">
			<header className="mx-auto w-full max-w-[880px] px-10 pb-0 pt-[34px]">
				<div className='relative flex flex-row gap-8 w-full pb-[18px] items-end justify-between'>
					<div className='flex flex-col gap-[5px] flex-1'>
						<h1 className="m-0 font-display text-display font-bold tracking-[-0.03em] text-ink">
							Users
						</h1>

					</div>
				</div>
				<div className="border-b border-line pb-4">
					<UserSearchBar value={q} onSearch={handleSearch} />
				</div>

			</header>

			{renderBody()}
		</main>
	);
}