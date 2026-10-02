# Lane B: Q&A Core

Lane B is the core of Knowly: **questions, answers, comments and votes**, from the database table all the way to the button on screen.

The lane is split into two tracks that run in parallel. Both of you start with the same setup ticket. After that, each of you owns one track.

## The tickets

Everyone starts with [00 · Setup and the map](00-setup-and-map.md).

| # | Track Q "Asking" (teammate 1) | Size |
|---|---|---|
| Q1 | [Post a question](Q1-post-a-question.md) | L |
| Q2 | [Open one question with everything under it](Q2-question-detail.md) | L |
| Q3 | [Browse the questions](Q3-question-feed.md) | M |
| Q4 | [Edit or withdraw a question](Q4-edit-delete-question.md) | M |
| Q5 | [Accept an answer](Q5-accept-answer.md) | S |
| Q6 | [Home page](Q6-home-page.md) | M |
| Q7 | [Ask / edit page](Q7-ask-edit-page.md) | L |

| # | Track P "Participating" (teammate 2) | Size |
|---|---|---|
| P1 | [Safe Markdown + moderation banner](P1-markdown-and-banner.md) | M |
| P2 | [Answer a question](P2-answer-a-question.md) | M |
| P3 | [Edit or remove an answer](P3-edit-delete-answer.md) | M |
| P4 | [Comments](P4-comments.md) | M |
| P5 | [Voting: endpoint + arrows](P5-voting.md) | L |
| P6 | [The question page](P6-question-page.md) | XL |

Both tracks cover the whole stack. Track Q starts in the backend and ends on screens. Track P starts with a screen component, goes down to the backend, and comes back up for the final page.

## When you wait for your partner

There are only three hand-offs between the tracks:

- **P2 needs Q1 merged.** P2 uses the answer/comment output shapes and `services/screening.py` from Q1.
- **Q7 needs P1 merged.** The ask page uses `MarkdownBody` for the preview and `ModerationBanner`.
- **P6 needs Q2, Q5 and Q7 merged.** The question page reads Q2's endpoint, calls Q5's, and reuses Q7's validation helpers.

If you're blocked, review your partner's open PR.

## How to work a ticket

1. **Can you already…?** Answer these quick questions honestly. Skip the reading for any concept you can already explain out loud.
2. **Concepts to learn.** Learn each concept when you reach the step that uses it, not all up front.
3. **To do.** Work through the steps in order. Commit after each step or group of steps.
4. **Done when.** Check every item yourself in the browser, in `/api/docs` or in psql.
5. **Pull request.** Open one PR per ticket. Your partner reviews it; reading each other's code is how each of you learns the other half of the lane.

## Who owns which file

Owning a file means only you edit it, so the two of you never collide.

**Track Q owns:**

- `backend/app/routers/questions.py`
- `backend/app/services/questions.py`, `backend/app/services/screening.py`
- `backend/app/schemas/question.py`, `backend/app/schemas/attachment.py`
- the `…Out` classes in `backend/app/schemas/answer.py` and `backend/app/schemas/comment.py`
- `frontend/src/components/QuestionCard.tsx`, `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/AskPage.tsx`
- the question rules in `frontend/src/lib/validation.ts`, and the edit route in `frontend/src/App.tsx`

**Track P owns:**

- `backend/app/routers/answers.py`, `backend/app/routers/comments.py`, `backend/app/routers/votes.py` (new)
- `backend/app/schemas/vote.py`
- the `…Create` / `…Update` classes appended to `schemas/answer.py` and `schemas/comment.py`
- `frontend/src/components/MarkdownBody.tsx`, `ModerationBanner.tsx`, `VoteArrows.tsx`
- `frontend/src/pages/QuestionDetailPage.tsx`
- `validateComment`, appended to `frontend/src/lib/validation.ts`

**Shared:** `backend/app/main.py`. Each of you adds one `include_router` line; if git reports a conflict there, keep both lines.

## Rules

- Never write an Alembic migration. The database schema is shared and frozen.
- Never change the existing types in `frontend/src/lib/types.ts`. Other lanes depend on them.
- Code marked `# STUB` belongs to another lane. Call it, but don't fill it in.
- One branch and one PR per ticket, always starting from the latest `main`: `git switch main && git pull && git switch -c feat/q1-post-a-question`.

## Still stubbed at the end

- **Moderation (Lane D, task D-02)** approves everything for now. When it ships, delete the two notification calls marked `# STUB` in `services/screening.py`, or users will get every notification twice.
- **File attachments (Lane D, tasks D-09 and D-10).** Attachment lists stay empty until then.
