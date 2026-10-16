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
		<article className="flex gap-[18px] border-b border-[#eef1ef] px-[6px] py-5 text-left transition-colors hover:bg-[#fbfcfb]">
			{/* Stats */}
			<ul className="m-0 flex w-[62px] shrink-0 list-none flex-col items-end gap-[10px] p-0 pt-[2px]">
				<li className="flex flex-col items-end leading-[1.1]">
					<span className="text-base font-bold text-[#1a201e]">
						{vote_total}
					</span>
					<span className="text-[11px] text-[#9aa6a1]">
						{vote_total === 1 ? 'vote' : 'votes'}
					</span>
				</li>

				<li
					className={`flex flex-col items-end leading-[1.1] ${has_accepted_answer
							? 'rounded-[7px] border border-[var(--accent,#0d9488)] px-[7px] py-[3px] text-[var(--accent,#0d9488)]'
							: 'text-[#7d8a85]'
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
					{has_accepted_answer && (
						<span className="sr-only">Has an accepted answer</span>
					)}
				</li>

				<li className="text-right text-[11px] text-[#9aa6a1]">
					{plural(view_count, 'view')}
				</li>
			</ul>

			{/* Main content */}
			<div className="min-w-0 flex-1">
				<h2 className="mb-[6px] mt-0 text-[17px] font-semibold leading-[1.35] tracking-[-0.01em] text-[#15302b]">
					<Link
						to={`/questions/${id}`}
						className="rounded-sm text-inherit no-underline hover:text-[var(--accent,#0d9488)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent,#0d9488)]"
					>
						{title}
					</Link>
				</h2>

				<p className="mb-3 mt-0 line-clamp-2 text-sm leading-[1.55] text-[#5a6863]">
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
									className="rounded-[6px] bg-[#eef2f0] px-[9px] py-[3px] font-mono text-[11.5px] text-[#46544f]"
								>
									{tag}
								</li>
							))}
						</ul>
					)}

					<div className="ml-auto flex flex-wrap items-center gap-2 text-[12.5px] text-[#8a958f]">
						<span className="inline-flex size-[22px] shrink-0 items-center justify-center overflow-hidden rounded-full [&>*]:size-full [&_img]:object-cover">
							<Avatar user={author} />
						</span>

						<span className="font-medium text-[#46544f]">
							{author.username}
						</span>

						<span>· {relativeTime(created_at)}</span>
					</div>
				</div>
			</div>
		</article>
	);
}
