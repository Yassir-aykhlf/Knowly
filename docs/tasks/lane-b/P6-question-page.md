# P6 · The question page: read, answer, comment, vote, accept

- **Track:** P "Participating"
- **Depends on:** P1–P5, and **Q2, Q5 and Q7 merged**
- **Size:** XL

## Goal

`/questions/:id` shows the question, its answers in the order the server sends them, and comments in both places. It also has working vote arrows, an Accept control for the asker, boxes for writing answers and comments, and banners that only the author sees.

## Can you already…?

- Split a big screen into components, and say which one owns which piece of state?
- Explain why hiding a button is not security?

## Concepts to learn

- **Decomposition** — one page is built from small parts: `AnswerItem`, `Comments`, `CommentItem`, `AnswerComposer`. Each part owns only its own state, such as "am I being edited?" or "am I busy?".
  - Learn: [react.dev — Thinking in React](https://react.dev/learn/thinking-in-react)
  - Used in: step 1
- **Props down, callbacks up** — the page owns the loaded question. The parts receive data as props, and call an `onChanged()` callback after they change something.
  - Learn: [react.dev — Sharing State Between Components](https://react.dev/learn/sharing-state-between-components)
  - Used in: step 3
- **Refetch after a change** — after any post, reload the whole question instead of patching your local copy. It costs one extra request, but the screen always matches the server: votes, order and comments included.
  - Used in: steps 3 and 4
- **UI authorization is only cosmetic** — hiding "Accept" from strangers keeps the page clear, but what actually protects the data is the server (Q5's 403).
  - Learn: [OWASP Top 10 — A01 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
  - Used in: step 4
- **The server decides the order** — render the answers exactly as they arrive (accepted first, then by votes, then oldest). Sorting them again in the browser would one day disagree with Q2.
  - Used in: step 1
- **Router state** — data can travel with a navigation instead of in the URL. Lane D's "Use this as my answer" button will send `{ prefillBody, fromConversationId, isAiAssisted }`. Read it with `useLocation().state`, and handle the common case where it's `null`.
  - Learn: in the [React Router docs](https://reactrouter.com/), pick v6, then Hooks → `useLocation` and `useNavigate` (the `state` option)
  - Used in: step 5

## To do

Build the page in five passes, committing after each one.

- [ ] **1. Read-only page** — fetch `GET /questions/:id`. On a 404, show "not found"; on any other error, show a Retry button. Then render:
  - the question: title, `MarkdownBody`, tags, and an author line that says "edited" when `updated_at > created_at`;
  - the question's comments;
  - the answers in the order received, each with its comments and with "AI-assisted" / "Accepted" badges;
  - an `AttachmentList` under each post (Lane D stub; renders nothing yet).
- [ ] **2. Votes** — put `VoteArrows` on the question and on every answer. On the viewer's own posts, set `disabled`, with the reason "You can't vote on your own post".
- [ ] **3. Writing boxes** —
  - an answer box with a live length check (Q7's `validateBody` and `BODY_MAX`); show it to the asker too, because answering your own question is allowed;
  - an "Add a comment" box under every post, using `validateComment` and `COMMENT_MAX = 1000`, which you append to `lib/validation.ts`;
  - after a successful post, call `onChanged()`, which reloads the question.
- [ ] **4. Owner controls** —
  - the asker gets an Accept / ✓ Accepted toggle on every **approved** answer, calling Q5's endpoint;
  - authors can edit and delete their own answers and comments in place;
  - the question's author gets an Edit link (to `/questions/:id/edit`) and a Delete button (confirm first, then go to `/home`);
  - show `ModerationBanner` on the viewer's own pending or rejected posts.
- [ ] **5. AI prefill** — read the router state. If it's there, pre-fill the answer box, and send `is_ai_assisted` and `from_conversation_id` along with the answer. After posting, clear the state with `navigate(location.pathname, { replace: true, state: null })`.

## Done when

- [ ] `docker-compose up -d --build frontend` succeeds, and the browser console is clean.
- [ ] With three accounts in three browser profiles (the asker, someone who answered, a stranger):
  - the stranger sees no Accept buttons, and every arrow is enabled;
  - the person who answered sees disabled arrows on their own answer, with the tooltip;
  - the asker accepts an answer → it moves to the top and is marked; accepts another → the mark moves; clears it → no mark.
- [ ] The asker can post an answer to their own question.
- [ ] A comment on the question and a comment on an answer each appear in the right place after posting.
- [ ] Editing an answer, then reloading → the "edited" marker appears.
- [ ] Set your answer to `pending` in psql → you see the amber banner, and the stranger doesn't see that answer at all.
- [ ] Prefill (before Lane D exists):
  - create a conversation in psql: `INSERT INTO ai_conversations (id, user_id, title) VALUES (gen_random_uuid(), '<your user id>', 'chat') RETURNING id;`;
  - temporarily add a button that calls `navigate(location.pathname, { state: { prefillBody: '<30+ characters>', fromConversationId: '<that id>', isAiAssisted: true } })`;
  - the answer box is pre-filled, and after posting, the answer shows "AI-assisted";
  - remove the button before committing.
