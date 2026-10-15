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
		<article className="question-card">
			<h2 className="question-card__title">
				<Link to={`/questions/${id}`}>{title}</Link>
			</h2>

			<p className="question-card__excerpt">{excerpt}</p>

			{tags.length > 0 && (
				<ul className="question-card__tags" aria-label="Tags">
					{tags.map((tag) => (
						<li key={tag} className="question-card__tag">
							{tag}
						</li>
					))}
				</ul>
			)}

			<div className="question-card__footer">
				<ul className="question-card__stats">
					<li>{plural(vote_total, 'vote')}</li>
					<li
						className={has_accepted_answer ? 'is-accepted' : undefined}
						title={has_accepted_answer ? 'Has an accepted answer' : undefined} >

						{has_accepted_answer && <span aria-hidden="true">✓ </span>}
						{plural(answer_count, 'answer')}
						{has_accepted_answer && <span className="visually-hidden"> (accepted)</span>}
					</li>
					<li>{plural(view_count, 'view')}</li>
				</ul>

				<div className="question-card__author">
					<Avatar user={author} />
					<span>{author.username}</span>
					<span className="question-card__age">{relativeTime(created_at)}</span>
				</div>
			</div>
		</article>
	);
}
