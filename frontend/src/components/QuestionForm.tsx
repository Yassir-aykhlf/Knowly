import { useEffect, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
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
import BackButton from '../components/BackButton';
import { AnswerStatus } from '../components/QuestionCard';
import { EmptyState, ErrorState } from '../components/StateBlocks';
import { useSimilarQuestions } from '../hooks/useSimilarQuestions';
import type { Question } from '../lib/types';
import { useAttachments } from '../hooks/useAttachments';

type FieldName = 'title' | 'body' | 'tags';
type ServerErrors = Partial<Record<FieldName, string>>;

type LoadState =
	| { status: 'loading' }
	| { status: 'error'; message: string }
	| { status: 'ready'; question: Question };

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
export default function QuestionForm({ id }: { id: string | undefined }) {

	const navigate = useNavigate();
	const { user } = useAuth();
	const isEdit = id !== undefined;

	const [load, setLoad] = useState<LoadState>({ status: 'loading' });

	// The ask box on the home page hands its text over as the starting title.
	const location = useLocation();
	const carriedTitle =
		!isEdit && typeof (location.state as { title?: unknown } | null)?.title === 'string'
			? String((location.state as { title: string }).title).slice(0, TITLE_MAX)
			: '';

	const [title, setTitle] = useState(carriedTitle);
	const [body, setBody] = useState('');
	const [tags, setTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState('');

	const [tagError, setTagError] = useState<string | null>(null);
	const files = useAttachments();

	const [touched, setTouched] = useState({ title: false, body: false });
	const [serverErrors, setServerErrors] = useState<ServerErrors>({});
	const [formError, setFormError] = useState<string | null>(null);
	const { submitting, replace: replaceAttachments } = files;
	const [mode, setMode] = useState<'write' | 'preview'>('write');
	const similar = useSimilarQuestions(isEdit ? '' : title, 4, 400);

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
				replaceAttachments(question.attachments ?? []);
				setLoad({ status: 'ready', question });
			})
			.catch((err: unknown) => {
				if (!ignore) setLoad({ status: 'error', message: readError(err).message });
			});

		return () => {
			ignore = true;
		};
	}, [id, replaceAttachments]);

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
		if (files.blocked) return;

		setTouched({ title: true, body: true });
		setFormError(null);

		if (validateTitle(title) || validateBody(body)) return;
		if (tagInput.trim() !== '') {
			setTagError(`Press Enter to add “${tagInput.trim()}” as a tag, or clear it.`);
			return;
		}

		setServerErrors({});
		try {
			const questionId = await files.submit(async (attachment_ids) => {
				const payload = { title: title.trim(), body: body.trim(), tags, attachment_ids };
				if (isEdit) {
					await api.put(`/questions/${id}`, payload);
					return id;
				}
				const created = await api.post<{ id: number | string }>('/questions', payload);
				return String(created.id);
			});
			navigate(`/questions/${questionId}`);
		} catch (err) {
			showServerError(err);
		}
	}

	// ---- edit mode gates ----

	const backTo = isEdit ? `/questions/${id}` : '/home';

	if (isEdit) {
		if (load.status === 'loading') {
			return (
				<div className="ah-page max-w-[1200px]" role="status" aria-label="Loading question">
					<div className="ah-skeleton h-9 w-24" />
					<div className="ah-skeleton mt-6 h-10 w-72" />
					<div className="ah-skeleton mt-8 h-80 w-full rounded-2xl" />
				</div>
			);
		}
		if (load.status === 'error') {
			return (
				<div className="ah-page max-w-[840px]">
					<ErrorState title="Couldn't load this question" message={load.message} />
					<div className="mt-4 flex justify-center">
						<BackButton to="/home" label="Back to questions" />
					</div>
				</div>
			);
		}
		if (user?.id !== load.question.author.id) {
			return (
				<div className="ah-page max-w-[840px]">
					<EmptyState
						title="You can't edit this question"
						action={<BackButton to={backTo} label="Back to the question" />}
					>
						Only the author can edit this question.
					</EmptyState>
				</div>
			);
		}
	}

	const atTagLimit = tags.length >= TAGS_MAX;
	const titleLength = title.trim().length;
	const bodyLength = body.trim().length;

	return (
		<div className="ah-page max-w-[1200px]">
			<BackButton to={backTo} />
			<h1 className="ah-h1 mt-5">{isEdit ? 'Edit question' : 'Ask a question'}</h1>
			<p className="ah-lead mt-2.5 max-w-[640px]">
				Add the detail someone needs to reproduce the problem: what you tried, what happened, what you expected.
			</p>

			{isEdit && load.status === 'ready' && (
				<div className="mt-4">
					<ModerationBanner
						status={load.question.moderation_status}
						note={load.question.moderation_note}
						kind='question'
					/>
				</div>
			)}

			<div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				<form onSubmit={handleSubmit} noValidate className="ah-card min-w-0 space-y-5 p-4 lg:p-6">
					{/* Title */}
					<div>
						<label htmlFor="question-title" className="ah-label">Title</label>
						<input
							id="question-title"
							className="ah-input h-[46px] text-base font-semibold lg:text-base"
							type="text"
							value={title}
							placeholder="e.g. How do I debounce a search input in React?"
							onChange={(e) => {
								setTitle(e.target.value);
								clearServerError('title');
							}}
							onBlur={() => setTouched((t) => ({ ...t, title: true }))}
							aria-invalid={titleError !== null}
							aria-describedby={titleError ? 'title-error title-help' : 'title-help'}
						/>
						<p id="title-help" className="ah-help">
							<span className={`tabular-nums ${titleLength > TITLE_MAX ? 'text-danger' : ''}`}>
								{titleLength} / {TITLE_MAX}
							</span>
							{' · '}Be specific, like you&apos;d search for it
						</p>
						{titleError && (
							<p id="title-error" className="ah-error" role="alert">
								{titleError}
							</p>
						)}
					</div>

					{/* Body with Write / Preview */}
					<div>
						<div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
							<label htmlFor="question-body" className="ah-label mb-0">Details</label>
							<div role="group" aria-label="Body view" className="ah-seg">
								<button
									type="button"
									className={`ah-seg-item ${mode === 'write' ? 'ah-seg-item-active' : ''}`}
									aria-pressed={mode === 'write'}
									onClick={() => setMode('write')}
								>
									Write
								</button>
								<button
									type="button"
									className={`ah-seg-item ${mode === 'preview' ? 'ah-seg-item-active' : ''}`}
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
								rows={9}
								value={body}
								placeholder="What did you try? What happened? What did you expect?"
								onChange={(e) => {
									setBody(e.target.value);
									clearServerError('body');
								}}
								onBlur={() => setTouched((t) => ({ ...t, body: true }))}
								aria-invalid={bodyError !== null}
								aria-describedby={bodyError ? 'body-error body-help' : 'body-help'}
								className="ah-textarea-mono"
							/>
						) : (
							<div className="min-h-[236px] rounded-btn border border-line bg-canvas-main p-4">
								{body.trim() ? <MarkdownBody markdown={body} /> : <p className="text-body text-ink-faint">Nothing to preview yet.</p>}
							</div>
						)}

						<p id="body-help" className="ah-help">
							Markdown supported ·{' '}
							<span className={`tabular-nums ${bodyLength > BODY_MAX ? 'text-danger' : ''}`}>
								{bodyLength.toLocaleString()} / {BODY_MAX.toLocaleString()}
							</span>
						</p>
						{bodyError && (
							<p id="body-error" className="ah-error" role="alert">
								{bodyError}
							</p>
						)}
					</div>

					{/* Tags */}
					<div>
						<label htmlFor="question-tags" className="ah-label">
							Tags <span className="font-normal text-ink-faint">({tags.length}/{TAGS_MAX})</span>
						</label>
						<div className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-btn border border-line3 bg-surface px-3 py-2 transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
							{tags.length > 0 && (
								<ul className="flex flex-wrap gap-1.5" aria-label="Added tags">
									{tags.map((tag) => (
										<li key={tag} className="ah-tag gap-1 py-1 pr-1">
											{tag}
											<button
												type="button"
												aria-label={`Remove tag ${tag}`}
												onClick={() => removeTag(tag)}
												className="inline-flex h-4 w-4 items-center justify-center rounded text-[13px] text-ink-faint hover:bg-line3 hover:text-ink"
											>
												×
											</button>
										</li>
									))}
								</ul>
							)}
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
								className="min-w-[10rem] flex-1 border-0 bg-transparent p-0 text-base text-ink placeholder:text-ink-dim focus:outline-none focus:ring-0 lg:text-body"
							/>
						</div>
						{tagsError && (
							<p id="tags-error" className="ah-error" role="alert">
								{tagsError}
							</p>
						)}
					</div>

					<div className="space-y-3">
						<FileUpload
							attachmentCount={files.items.length}
							onUploaded={files.add}
							onRemoved={files.remove}
							beginOperation={files.beginOperation}
							disabled={submitting}
						/>
						<AttachmentList
							items={files.items}
							onDelete={files.remove}
							beginOperation={files.beginOperation}
							disabled={submitting}
						/>
						{files.pending > 0 && <p role="status" className="text-body-sm text-ink-muted">Waiting for files…</p>}
					</div>

					{formError && (
						<p className="ah-alert" role="alert">
							{formError}
						</p>
					)}

					<div className="flex flex-wrap items-center gap-2">
						<button type="submit" disabled={files.blocked} className="ah-btn-primary h-11 px-5 lg:h-[42px]">
							{submitting
								? isEdit
									? 'Saving…'
									: 'Posting…'
								: isEdit
									? 'Save changes'
									: 'Post question'}
						</button>
						<Link to={backTo} className="ah-btn-ghost">Cancel</Link>
					</div>
				</form>

				<aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
					{!isEdit && (
						<section className="ah-card p-4 lg:p-5" aria-live="polite">
							<h2 className="ah-overline mb-2">Similar questions</h2>
							{!similar.enabled ? (
								<p className="text-body-sm leading-relaxed text-ink-muted">
									Start typing a title and existing questions that match will show up here.
								</p>
							) : similar.items === null ? (
								<div className="space-y-2.5 py-1" role="status" aria-label="Looking for similar questions">
									<div className="ah-skeleton h-3.5 w-full" />
									<div className="ah-skeleton h-3.5 w-4/5" />
									<div className="ah-skeleton h-3.5 w-3/5" />
								</div>
							) : similar.items.length === 0 ? (
								<p className="text-body-sm leading-relaxed text-ink-muted">
									No existing question matches this title. Looks like a new one.
								</p>
							) : (
								<ul className="-mx-2">
									{similar.items.map((item) => (
										<li key={item.id}>
											<Link
												to={`/questions/${item.id}`}
												className="flex flex-col items-start gap-1.5 rounded-lg px-2 py-2 no-underline transition-colors hover:bg-accent-wash"
											>
												<span className="break-words text-body font-medium leading-snug text-ink">{item.title}</span>
												<AnswerStatus count={item.answer_count} accepted={item.has_accepted_answer} />
											</Link>
										</li>
									))}
								</ul>
							)}
						</section>
					)}

					<section className="ah-card p-4 lg:p-5">
						<h2 className="ah-overline mb-2">Writing a good question</h2>
						<ul className="list-disc space-y-1.5 pl-5 text-body-sm leading-relaxed text-ink-muted">
							<li>Put the actual problem in the title.</li>
							<li>Share the smallest code sample that shows it.</li>
							<li>Say what you expected and what happened instead.</li>
							<li>Add 1–{TAGS_MAX} tags so the right people find it.</li>
						</ul>
					</section>
				</aside>
			</div>
		</div>
	);
}
