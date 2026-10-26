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
			return <p role="status" className="px-10 py-6 text-body text-ink-faint">Loading…</p>;
		}

		if (state.status === 'error') {
			return (
				<div role="alert" className="mx-auto max-w-[880px] px-10 py-8 text-sm">
					<p className="mb-2 text-ink-muted">Couldn&apos;t load questions.</p>
					<p className="mb-4 text-ink-faint">{state.message}</p>
					<button type="button" onClick={() => setAttempt((n) => n + 1)} className="ah-btn-secondary">
						Retry
					</button>
				</div>
			);
		}

		const { items, total, limit } = state.data;

		if (total === 0) {
			return (
				<div className="mx-auto max-w-xl px-4 py-16 text-center">
					<p className="text-body text-ink-faint">No questions here yet.</p>
					<p className="text-body text-ink-faint">
						Be the first to <Link to="/ask" className="ah-link">ask a question</Link>.
					</p>
				</div>
			);
		}

		const totalPages = Math.max(1, Math.ceil(total / limit));

		return (
			<>
				<div>
					<ul className="mx-auto w-full max-w-[880px] list-none px-10 pb-20 pt-[34px]">
						{items.map((item) => (
							<li key={item.id}>
								<QuestionCard question={item} />
							</li>
						))}
					</ul>

					<nav className="mx-auto flex w-full max-w-[880px] items-center justify-center gap-4 px-10 pb-20">
						<button
							type="button"
							disabled={page <= 1}
							onClick={() => govoteage(page - 1)}
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
							onClick={() => govoteage(page + 1)}
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
							Questions
						</h1>

					</div>
					<Link
						to="/ask"
						className="ah-btn-primary shrink-0 self-end whitespace-nowrap no-underline"
					>
						Ask a question
					</Link>
				</div>
				<div
					className="flex gap-1 border-b border-line"
					role="group"
					aria-label="Sort questions"
				>
					{SORTS.map((s) => (
						<button
							key={s}
							type="button"
							className={`ah-sort-tab ${s === sort ? 'ah-sort-tab-active' : ''}`}
							aria-pressed={s === sort}
							onClick={() => selectSort(s)}
						>
							{SORT_LABELS[s]}
						</button>
					))}
				</div>

			</header>

			{renderBody()}
		</main>
	);
}
