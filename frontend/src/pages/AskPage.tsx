import { useEffect, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
// import { useAuth } from '../hooks/useAuth';
import { useAuth } from '../contexts/AuthContext'
import {
	BODY_MAX,
	TAGS_MAX, TITLE_MAX,
	validateBody,
	validateTag,
	validateTitle,
} from '../lib/validation';
import FileUpload from '../components/FileUpload';
import AttachmentList from '../components/AttachmentList';
import MarkdownBody from '../components/MarkdownBody';
import ModerationBanner from '../components/ModerationBanner';
import type { Attachment, Question } from '../lib/types';

type FieldName = 'title' | 'body' | 'tags';
type ServerErrors = Partial<Record<FieldName, string>>;

type LoadState =
	| { status: 'loading' }
	| { status: 'error'; message: string }
	| { status: 'ready'; question: Question };

// Reads the message and the per-field errors (err.fields) off whatever was thrown.
function readError(err: unknown): { message: string; fields: Record<string, unknown> } {
	const e = (typeof err === 'object' && err !== null ? err : {}) as {
		message?: unknown;
		fields?: unknown;
	};
	const fields =
		typeof e.fields === 'object' && e.fields !== null
			? (e.fields as Record<string, unknown>)
			: {};
	const message = typeof e.message === 'string' && e.message ? e.message : 'Something went wrong.';
	return { message, fields };
}

function QuestionForm({ id }: { id: string | undefined }) {

	const navigate = useNavigate();
	const { user } = useAuth();
	const isEdit = id !== undefined;

	const [load, setLoad] = useState<LoadState>({ status: 'loading' });

	const [title, setTitle] = useState('');
	const [body, setBody] = useState('');
	const [tags, setTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState('');

	const [tagError, setTagError] = useState<string | null>(null);
	const [attachments, setAttachments] = useState<Attachment[]>([]);

	const [touched, setTouched] = useState({ title: false, body: false });
	const [serverErrors, setServerErrors] = useState<ServerErrors>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [mode, setMode] = useState<'write' | 'preview'>('write');

	// Edit mode: load the question and fill in the fields.
	useEffect(() => {
		if (id === undefined) return;
		let ignore = false;

		api
			.get<Question>(`/questions/${id}`)
			.then((question) => {
				if (ignore)
					return;
				setTitle(question.title);
				setBody(question.body);
				setTags([...question.tags]);
				setAttachments(question.attachments ?? []);
				setLoad({ status: 'ready', question });
			})
			.catch((err: unknown) => {
				if (!ignore) setLoad({ status: 'error', message: readError(err).message });
			});

		return () => {
			ignore = true;
		};
	}, [id]);

	// A field shows the server's message until you edit that field, then the live check.
	const titleError = serverErrors.title ?? (touched.title ? validateTitle(title) : null);
	const bodyError = serverErrors.body ?? (touched.body ? validateBody(body) : null);
	const tagsError = tagError ?? serverErrors.tags ?? null;

	function clearServerError(field: FieldName) {
		setServerErrors((prev) => ({ ...prev, [field]: undefined }));
	}

	// ---- tags ----

	function tryAddTag(raw: string): boolean {
		const tag = raw.trim();
		if (tags.length >= TAGS_MAX) {
			setTagError(`You can add up to ${TAGS_MAX} tags.`);
			return false;
		}
		const problem = validateTag(tag);
		if (problem) {
			setTagError(problem);
			return false;
		}
		if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
			setTagError('That tag is already added.');
			return false;
		}
		setTags([...tags, tag]);
		setTagError(null);
		clearServerError('tags');
		return true;
	}

	// A comma commits the text before it as a tag. Handling it here (not in
	// onKeyDown) also covers pasted text and mobile keyboards.
	function handleTagInputChange(value: string) {
		const comma = value.indexOf(',');
		if (comma === -1) {
			setTagInput(value);
			setTagError(null);
			return;
		}

		const head = value.slice(0, comma);
		const rest = value.slice(comma + 1).replace(/,/g, '');

		if (head.trim() === '') {
			setTagInput(rest);
			return;
		}
		// On failure keep the text so the error message still makes sense.
		setTagInput(tryAddTag(head) ? rest : head);
	}

	function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
		if (e.nativeEvent.isComposing) return;
		if (e.key === 'Enter') {
			e.preventDefault(); // Enter in this input must not submit the form
			if (tagInput.trim() !== '' && tryAddTag(tagInput)) setTagInput('');
		} else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
			setTags(tags.slice(0, -1));
			setTagError(null);
			clearServerError('tags');
		}
	}

	function removeTag(tag: string) {
		setTags(tags.filter((t) => t !== tag));
		setTagError(null);
		clearServerError('tags');
	}

	// ---- attachments (FileUpload and AttachmentList are Lane D's) ----

	function handleUploaded(attachment: Attachment) {
		setAttachments((prev) => [...prev, attachment]);
	}

	function handleRemoveAttachment(attachmentId: Attachment['id']) {
		setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
	}

	// ---- submit ----

	function showServerError(err: unknown) {
		const { message, fields } = readError(err);
		const next: ServerErrors = {};
		const other: string[] = [];
		for (const [name, value] of Object.entries(fields)) {
			const text = String(value);
			if (name === 'title' || name === 'body' || name === 'tags') next[name] = text;
			else other.push(text);
		}
		setServerErrors(next);
		const shownUnderFields = Object.keys(next).length > 0;
		setFormError(other.length > 0 ? other.join(' ') : shownUnderFields ? null : message);
	}

	async function handleSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (submitting) return;

		setTouched({ title: true, body: true });
		setFormError(null);

		if (validateTitle(title) || validateBody(body)) return;
		if (tagInput.trim() !== '') {
			setTagError(`Press Enter to add “${tagInput.trim()}” as a tag, or clear it.`);
			return;
		}

		const payload = {
			title: title.trim(),
			body: body.trim(),
			tags,
			attachment_ids: attachments.map((a) => a.id),
		};

		setSubmitting(true);
		setServerErrors({});
		try {
			if (isEdit) {
				await api.put(`/questions/${id}`, payload);
				navigate(`/questions/${id}`);
			} else {
				const created = await api.post<{ id: number | string }>('/questions', payload);
				navigate(`/questions/${created.id}`);
			}
		} catch (err) {
			showServerError(err);
			setSubmitting(false);
		}
	}

	// ---- edit mode gates ----

	if (isEdit) {
		if (load.status === 'loading') {
			return (
				<main className="ask-page">
					<p role="status">Loading…</p>
				</main>
			);
		}
		if (load.status === 'error') {
			return (
				<main className="ask-page">
					<p role="alert">{load.message}</p>
					<Link to="/home">Back to questions</Link>
				</main>
			);
		}
		if (user?.id !== load.question.author.id) {
			return (
				<main className="ask-page">
					<p>Only the author can edit this question.</p>
					<Link to={`/questions/${id}`}>Back to the question</Link>
				</main>
			);
		}
	}

	const atTagLimit = tags.length >= TAGS_MAX;

	return (
		<main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
			<h1>{isEdit ? 'Edit question' : 'Ask a question'}</h1>

			{isEdit && load.status === 'ready' && (
				<ModerationBanner
					status={load.question.moderation_status}
					note={load.question.moderation_note}
					kind='question'
					compact
				/>
			)}

			<form onSubmit={handleSubmit} noValidate>
				{/* Title */}
				<div className="flex w-full break-words text-2xl font-semibold">
					<input
						className='border border-gray-300 p-2 rounded'
						type="text"
						value={title}
						onChange={(e) => {
							setTitle(e.target.value);
							clearServerError('title');
						}}
						onBlur={() => setTouched((t) => ({ ...t, title: true }))}
						aria-invalid={titleError !== null}
						aria-describedby={titleError ? 'title-error' : undefined}
					/>
					<p className="mr-auto">
						{title.trim().length} / {TITLE_MAX}
					</p>
					{titleError && (
						<p id="title-error" className="field__error" role="alert">
							{titleError}
						</p>
					)}
				</div>

				{/* Body with Write / Preview */}
				<div className="field">
					<div className="field__header">
						<label htmlFor="question-body">Body</label>
						<div role="group" aria-label="Body view">
							<button
								type="button"
								className={mode === 'write' ? 'tab tab--active' : 'tab'}
								aria-pressed={mode === 'write'}
								onClick={() => setMode('write')}
							>
								Write
							</button>
							<button
								type="button"
								className={mode === 'preview' ? 'tab tab--active' : 'tab'}
								aria-pressed={mode === 'preview'}
								onClick={() => setMode('preview')}
							>
								Preview
							</button>
						</div>
					</div>

					{mode === 'write' ? (
						<textarea
							id="question-body"
							rows={12}
							value={body}
							onChange={(e) => {
								setBody(e.target.value);
								clearServerError('body');
							}}
							onBlur={() => setTouched((t) => ({ ...t, body: true }))}
							aria-invalid={bodyError !== null}
							aria-describedby={bodyError ? 'body-error' : undefined}
						/>
					) : (
						<div className="ask-page__preview">
							{body.trim() ? <MarkdownBody markdown={body} /> : <p>Nothing to preview yet.</p>}
						</div>
					)}

					<p className="field__help">
						{body.trim().length} / {BODY_MAX}
					</p>
					{bodyError && (
						<p id="body-error" className="field__error" role="alert">
							{bodyError}
						</p>
					)}
				</div>

				{/* Tags */}
				<div className="field">
					<label htmlFor="question-tags">
						Tags ({tags.length}/{TAGS_MAX})
					</label>
					<div className="tag-input">
						<ul className="tag-input__chips" aria-label="Added tags">
							{tags.map((tag) => (
								<li key={tag} className="chip">
									{tag}
									<button
										type="button"
										aria-label={`Remove tag ${tag}`}
										onClick={() => removeTag(tag)}
									>
										×
									</button>
								</li>
							))}
						</ul>
						<input
							id="question-tags"
							type="text"
							value={tagInput}
							disabled={atTagLimit}
							placeholder={atTagLimit ? 'Tag limit reached' : 'Type a tag, then press Enter'}
							onChange={(e) => handleTagInputChange(e.target.value)}
							onKeyDown={handleTagKeyDown}
							aria-invalid={tagsError !== null}
							aria-describedby={tagsError ? 'tags-error' : undefined}
						/>
					</div>
					{tagsError && (
						<p id="tags-error" className="field__error" role="alert">
							{tagsError}
						</p>
					)}
				</div>

				{/* Lane D builds these; for now they render nothing. */}
				<FileUpload onUploaded={handleUploaded} />
				<AttachmentList items={attachments} onDelete={handleRemoveAttachment} />

				{formError && (
					<p className="field__error" role="alert">
						{formError}
					</p>
				)}

				<div className="ask-page__actions">
					<button type="submit" disabled={submitting}>
						{submitting
							? isEdit
								? 'Saving…'
								: 'Posting…'
							: isEdit
								? 'Save changes'
								: 'Post question'}
					</button>
					<Link to={isEdit ? `/questions/${id}` : '/home'}>Cancel</Link>
				</div>
			</form>
		</main>
	);
}

// /ask and /questions/:id/edit render this same component. The key makes React
// start with fresh state when you move between them (or between two questions).
export default function AskPage() {
	const { id } = useParams<{ id: string }>();
	return <QuestionForm key={id ?? 'new'} id={id} />;
}

