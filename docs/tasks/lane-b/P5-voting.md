# P5 · Vote content up or down: the endpoint and the arrows

- **Track:** P "Participating"
- **Depends on:** P2
- **Size:** L

## Goal

`POST /api/questions/{id}/vote` and `POST /api/answers/{id}/vote` take `{"value": 1 | 0 | -1}`, and a `<VoteArrows>` control makes voting feel instant.

## Can you already…?

- Explain what a unique constraint is?
- Say what happens if you click a button twice before the first request comes back?

## Concepts to learn

- **Unique constraint and upsert** — `votes` allows only one row per (voter, target), enforced by `uq_votes_voter_target`. "Insert, or update if it already exists" is a single statement, `INSERT … ON CONFLICT DO UPDATE`, and `content.apply_vote` already runs it.
  - Learn: [PostgreSQL — Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) (unique constraints), [PostgreSQL — INSERT](https://www.postgresql.org/docs/current/sql-insert.html) (the ON CONFLICT clause)
  - Used in: step 3
- **Compute on read vs store a counter** — a score is always `SUM(value)` over the `votes` table. That's slower than reading a stored number, but it can never drift out of sync.
  - Used in: step 3
- **Check, then act** — `notify_vote_if_new` decides "is this the first vote?" by looking for your existing vote row, so it must run **before** the vote is written. In the other order, it never fires.
  - Used in: step 3
- **An exact contract** — the response is exactly `{"vote_total": …, "my_vote": …}`. Nothing more, because the arrows reconcile against it.
  - Used in: step 2
- **Optimistic UI** — change the screen immediately and send the request. Then *reconcile* with the server's numbers, or *roll back* to a saved snapshot of the previous numbers if the request fails.
  - Learn: [react.dev — Updating Objects in State](https://react.dev/learn/updating-objects-in-state)
  - Used in: step 5
- **Double clicks and refs** — while a request is in flight, ignore further clicks. A `useRef` flag changes immediately and doesn't cause a redraw; a `useState` value only updates on the next render, too late to stop a second click.
  - Learn: [react.dev — Referencing Values with Refs](https://react.dev/learn/referencing-values-with-refs)
  - Used in: step 6
- **Syncing from props** — when the parent page reloads with new totals, the arrows must adopt them, with a `useEffect` on those props.
  - Learn: [react.dev — Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
  - Used in: step 7

## To do

### Backend

- [ ] **1. Input schema** — in `schemas/vote.py`, add `VoteIn` with `value: Literal[-1, 0, 1]` next to the existing `VoteOut`.
- [ ] **2. Router** — create `backend/app/routers/votes.py` with no prefix, holding `POST "/questions/{question_id}/vote"` and `POST "/answers/{answer_id}/vote"`. Both call one `cast_vote(db, user, target_type, target_id, value)` and use `response_model=VoteOut`. Mount the router in `main.py`.
- [ ] **3. cast_vote** —
  - load the target; if it's missing or not viewable (for an answer, its question must be viewable too), raise 404;
  - if it's the voter's own post, raise **400** with the code `self_vote`;
  - call `notifications.notify_vote_if_new(...)` first, then `return await content.apply_vote(...)`.

### Frontend

- [ ] **4. Presentation** — `frontend/src/components/VoteArrows.tsx` takes the props `targetType`, `targetId`, `total`, `myVote`, `disabled?` and `disabledReason?`, and shows ▲, the total, and ▼.
- [ ] **5. Click logic** —
  - the new value is `0` if the clicked arrow is already the active one, otherwise that arrow's direction (clicking again clears the vote; the API itself has no toggle);
  - save the current numbers as `previous`, then show the optimistic numbers;
  - call `api.post` on `/${targetType}s/${targetId}/vote` with `{ value }`;
  - on success, show the server's `vote_total` and `my_vote`; on failure, restore `previous` and call `showToast(message, 'error')`.
- [ ] **6. Guard and disabled state** — ignore clicks while a request is in flight (a `useRef` flag). When `disabled`, grey out both arrows and show `disabledReason` as a tooltip (`title`).
- [ ] **7. Resync** — add a `useEffect` that resets the local numbers whenever the `total` or `myVote` props change.
- [ ] **8. Try it** — temporarily render `<VoteArrows targetType="question" targetId="<a real id>" total={0} myVote={0} />` in `pages/QuestionDetailPage.tsx`, as you did in P1. Undo it before committing.

## Done when

- [ ] Voting `1` on someone else's question → exactly `{"vote_total": 1, "my_vote": 1}`. Then `-1` → `{-1, -1}`, then `0` → `{0, 0}`.
- [ ] After voting, switching and clearing, psql shows at most **one** row of yours in `votes` for that post.
- [ ] Voting on your own question or answer → **400** `self_vote`; voting on a stranger's pending answer → **404**; `{"value": 2}` → **400**.
- [ ] The post's author gets exactly **one** `vote_cast` notification, however many times you change your vote, and it doesn't say which direction.
- [ ] In the browser: clicking ▲ moves the number instantly; clicking ▲ again clears it; clicking quickly never sends two requests at once (devtools → Network).
- [ ] After `docker-compose stop backend`, a click → the number jumps back and a red toast appears.
- [ ] With `disabled`, both arrows are grey, show the tooltip, and do nothing when clicked.
