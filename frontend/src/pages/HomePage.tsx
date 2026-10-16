import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import QuestionCard from '../components/QuestionCard';
import type { QuestionPage } from '../lib/types';

const SORTS = ['newest', 'votes', 'unanswered'] as const;
type Sort = (typeof SORTS)[number];

const SORT_LABELS: Record<Sort, string> = {
	newest: 'Newest',
	votes: 'Votes',
	unanswered: 'Unanswered',
};

const LIMIT = 20;

type State =
	| { status: 'loading' }
	| { status: 'error'; message: string }
	| { status: 'ready'; data: QuestionPage };

// Unknown or missing values fall back to the defaults.
function parseSort(value: string | null): Sort {
	return (SORTS as readonly string[]).includes(value ?? '') ? (value as Sort) : 'newest';
}

function parsePage(value: string | null): number {
	const n = Number(value);
	return Number.isInteger(n) && n >= 1 ? n : 1;
}

function errorMessage(err: unknown): string {
	return err instanceof Error && err.message ? err.message : 'Something went wrong.';
}

export default function HomePage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const sort = parseSort(searchParams.get('sort'));
	const page = parsePage(searchParams.get('page'));

	const [state, setState] = useState<State>({ status: 'loading' });
	const [attempt, setAttempt] = useState(0); // bumped by Retry to refetch

	useEffect(() => {
		let ignore = false;
		setState({ status: 'loading' });

		const query = new URLSearchParams({
			sort,
			page: String(page),
			limit: String(LIMIT),
		});

		api
			.get<QuestionPage>(`/questions?${query.toString()}`)
			.then((data) => {
				if (!ignore) setState({ status: 'ready', data });
			})
			.catch((err: unknown) => {
				if (!ignore) setState({ status: 'error', message: errorMessage(err) });
			});

		return () => {
			ignore = true;
		};
	}, [sort, page, attempt]);

	// A hand-typed ?page=99 beyond the last page jumps to the last page.
	useEffect(() => {
		if (state.status !== 'ready') return;
		const { total, limit } = state.data;
		const lastPage = Math.max(1, Math.ceil(total / limit));
		if (page > lastPage) {
			setSearchParams({ sort, page: String(lastPage) }, { replace: true });
		}
	}, [state, page, sort, setSearchParams]);

	useEffect(() => {
		window.scrollTo(0, 0);
	}, [sort, page]);

	function selectSort(next: Sort) {
		if (next === sort && page === 1) return;
		setSearchParams({ sort: next, page: '1' }); // pushes history, so Back works
	}

	function govoteage(next: number) {
		setSearchParams({ sort, page: String(next) });
	}

	function renderBody() {
		if (state.status === 'loading') {
			return <p role="status">Loading…</p>;
		}

		if (state.status === 'error') {
			return (
				<div role="alert" className="home-page__error">
					<p>Couldn&apos;t load questions.</p>
					<p>{state.message}</p>
					<button type="button" onClick={() => setAttempt((n) => n + 1)}>
						Retry
					</button>
				</div>
			);
		}

		const { items, total, limit } = state.data;

		if (total === 0) {
			return (
				<div className="home-page__empty">
					<p>No questions here yet.</p>
					<p>
						Be the first to <Link to="/ask">ask a question</Link>.
					</p>
				</div>
			);
		}

		const totalPages = Math.max(1, Math.ceil(total / limit));

		return (
			<>
				<div>
					<ul className="mx-auto w-full max-w-[880px] px-4 pb-20 pt-[34px] sm:px-10">
						{items.map((item) => (
							<li key={item.id}>
								<QuestionCard question={item} />
							</li>
						))}
					</ul>

					<nav className="mx-auto flex w-full max-w-[880px] items-center justify-center gap-4 px-4 pb-20 pt-[34px] sm:px-10">
						<button
							type="button"
							disabled={page <= 1}
							onClick={() => govoteage(page - 1)}
							className="inline-block w-fit h-fit shrink-0 cursor-pointer whitespace-nowrap rounded-[10px] bg-[var(--accent,#0d9488)] px-[18px] py-[11px] text-[14.5px] font-semibold text-white transition-colors hover:bg-[#0b7d72] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--accent,#0d9488)]"
						>
							Previous
						</button>

						<span className="text-[14.5px] font-medium">
							Page {page} of {totalPages}
						</span>

						<button
							type="button"
							disabled={page >= totalPages}
							onClick={() => govoteage(page + 1)}
							className="inline-block w-fit h-fit shrink-0 cursor-pointer whitespace-nowrap rounded-[10px] bg-[var(--accent,#0d9488)] px-[18px] py-[11px] text-[14.5px] font-semibold text-white transition-colors hover:bg-[#0b7d72] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--accent,#0d9488)]"
						>
							Next
						</button>
					</nav>
				</div>
			</>
		);
	}

	return (
		<main className="home-page">
			<header className="mx-auto px-10 py-10 w-full max-w-[880px] sm:px-10">
				<div className='relative flex flex-row gap-8 w-full'>
					<div className='flex flex-col gap-4 flex-1'>
						<h1 className="m-0 text-[32px] font-bold tracking-[-0.03em] text-[#1a201e] [font-family:'Bricolage_Grotesque',sans-serif]">
							Questions
						</h1>

					</div>
					<Link
						to="/ask"
						className="inline-block self-end w-fit h-fit shrink-0 whitespace-nowrap rounded-[10px] bg-[var(--accent,#0d9488)] px-[18px] py-[11px] text-[14.5px] font-semibold text-white no-underline transition-colors hover:bg-[#0b7d72]"
					>
						Ask a question
					</Link>
				</div>
				<div
					className="flex gap-1 border-b border-[#e7eae8]"
					role="group"
					aria-label="Sort questions"
				>
					{SORTS.map((s) => (
						<button
							key={s}
							type="button"
							className={`-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-[13px] py-[9px] font-inherit text-sm transition-colors ${s === sort
								? 'border-[var(--accent,#0d9488)] font-semibold text-[var(--accent,#0d9488)]'
								: 'border-transparent font-medium text-[#7d8a85] hover:text-[#15302b]'
								}`}
							aria-pressed={s === sort}
							onClick={() => selectSort(s)}
						>
							{SORT_LABELS[s]}
						</button>
					))}
				</div>

			</header>

			{renderBody()}
		</main >
	);
}
