export const USERNAME_RE = /^[A-Za-z0-9_-]{3,30}$/

export function validatePassword(pw: string): string | null {
	if (pw.length < 8 || pw.length > 128) return 'Password must be 8–128 characters'
	if (!/[A-Za-z]/.test(pw)) return 'Password must contain a letter'
	if (!/[0-9]/.test(pw)) return 'Password must contain a digit'
	return null
}

export const BODY_MIN = 30
export const BODY_MAX = 30_000

export const TITLE_MAX = 200
export const TITLE_MIN = 10

export const TAGS_MAX = 5
export const TAG_LEN_MIN = 2
export const TAG_LEN_MAX = 30

export function validateTitle(title: string): string | null {
	const length = title.trim().length
	if (length < TITLE_MIN) return `Must be at least ${TITLE_MIN} characters`
	if (length > TITLE_MAX) return `Must be at most ${TITLE_MAX.toLocaleString()} characters`
	return null
}

function parseTags(input: string): string[] {
	return input.trim().split(/\s+/).filter(Boolean)
}

export function validateBody(body: string): string | null {
	const length = body.trim().length
	if (length < BODY_MIN) return `Must be at least ${BODY_MIN} characters`
	if (length > BODY_MAX) return `Must be at most ${BODY_MAX.toLocaleString()} characters`
	return null
}

export function validateTag(input: string): string | null {
	const tags = parseTags(input)

	if (tags.length > TAGS_MAX) return `Use at most ${TAGS_MAX} tags`

	for (const tag of tags) {
		if (tag.length < TAG_LEN_MIN) {
			return `Tag "${tag}" must be at least ${TAG_LEN_MIN} characters`
		}
		if (tag.length > TAG_LEN_MAX) {
			return `Tag "${tag.slice(0, TAG_LEN_MAX)}…" must be at most ${TAG_LEN_MAX} characters`
		}
	}
	return null
}

export const COMMENT_MAX = 1000

export function validateComment(body: string): string | null {
	const length = body.trim().length
	if (length === 0) return 'Comment cannot be empty'
	if (length > COMMENT_MAX) return `Must be at most ${COMMENT_MAX.toLocaleString()} characters`
	return null
}
