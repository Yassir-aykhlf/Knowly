import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import { relativeTime } from '../lib/format';
import type { QuestionListItem } from '../lib/types';

type Props = {
	question: QuestionListItem;
};

function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export default function QuestionCard({ question }: Props) {
	const {
		id,
		title,
		excerpt,
		tags,
		author,
		vote_total,
		answer_count,
		view_count,
		has_accepted_answer,
		created_at,
	} = question;

	return (
		<article className="flex gap-[18px] border-b border-line4 px-[6px] py-5 text-left transition-colors hover:bg-surface-raised">
			{/* Stats */}
			<ul className="m-0 flex w-[62px] shrink-0 list-none flex-col items-end gap-[10px] p-0 pt-[2px]">
				<li className="flex flex-col items-end leading-[1.1]">
					<span className="text-[16px] font-bold text-ink">
						{vote_total}
					</span>
					<span className="text-[11px] text-ink-ghost">
						{vote_total === 1 ? 'vote' : 'votes'}
					</span>
				</li>

				{answer_count > 2 ?
					<li
						className={`flex flex-col items-end leading-[1.1] ${has_accepted_answer
							? 'rounded-[7px] border  border-accent px-[7px] py-[3px] text-accent'
							: 'text-ink-faint'
							}`}
						title={has_accepted_answer ? 'Has an accepted answer' : undefined}
					>
						<span className="text-sm font-bold">
							{has_accepted_answer && <span aria-hidden="true">✓ </span>}
							{answer_count}
						</span>
						<span className="text-[11px] opacity-80">
							{answer_count === 1 ? 'answer' : 'answers'}
						</span>
						{has_accepted_answer ?
							(<span className="sr-only">Has an accepted answer</span>) :
							(<span className="sr-only">Has no accepted answer yet</span>)
						}
					</li>
					:
					<li
						className={`flex flex-col items-end leading-[1.1] ${has_accepted_answer
							? 'rounded-[7px] border  border-gray px-[7px] py-[3px] text-gray'
							: 'text-ink-faint'
							}`}
						title={has_accepted_answer ? 'Has an accepted answer' : undefined}
					>
						<span className="text-sm font-bold">
							{has_accepted_answer && <span aria-hidden="true">✓ </span>}
							{answer_count}
						</span>
						<span className="text-[11px] opacity-80">
							{answer_count === 1 ? 'answer' : 'answers'}
						</span>
						{has_accepted_answer ?
							(<span className="sr-only">Has an accepted answer</span>) :
							(<span className="sr-only">Has no accepted answer yet</span>)
						}
					</li>
				}

				<li className="text-right text-[11px] text-ink-ghost">
					{plural(view_count, 'view')}
				</li>
			</ul>

			{/* Main content */}
			<div className="min-w-0 flex-1">
				<h2 className="mb-[6px] mt-0 text-title-sm font-semibold text-ink">
					<Link
						to={`/questions/${id}`}
						className="rounded-sm text-inherit no-underline hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					>
						{title}
					</Link>
				</h2>

				<p className="mb-3 mt-0 line-clamp-2 text-body leading-[1.55] text-ink-muted">
					{excerpt}
				</p>

				<div className="flex flex-wrap items-center justify-between gap-[10px]">
					{tags.length > 0 && (
						<ul
							className="m-0 flex list-none flex-wrap gap-[6px] p-0"
							aria-label="Tags"
						>
							{tags.map((tag) => (
								<li
									key={tag}
									className="ah-tag"
								>
									{tag}
								</li>
							))}
						</ul>
					)}

					<div className="ml-auto flex flex-wrap items-center gap-2 text-[12.5px] text-ink-faint">
						<span className="inline-flex size-[22px] shrink-0 items-center justify-center overflow-hidden rounded-full [&>*]:size-full [&_img]:object-cover">
							<Avatar user={author} />
						</span>

						<span className="font-medium text-[#46544F]">
							{author.username}
						</span>

						<span>· {relativeTime(created_at)}</span>
					</div>
				</div>
			</div>
		</article>
	);
}
