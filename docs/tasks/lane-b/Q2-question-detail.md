# Q2 · Opening a question shows everything under it

- **Track:** Q "Asking"
- **Depends on:** Q1
- **Unblocks:** P6
- **Size:** L

## Goal

One request, `GET /api/questions/{id}`, returns the question with its visible answers (best first), its comments in two places, the scores, and the viewer's own votes.

## Can you already…?

- Write a SQL `SELECT … WHERE … IN (…)`?
- Explain why `SUM` needs a `GROUP BY`?
- Sort `[(1, "b"), (0, "z"), (0, "a")]` in your head?

## Concepts to learn

- **SELECT / WHERE / IN** — fetch the rows that match a condition. `IN (a, b, c)` matches any value in the list.
  - Learn: [PostgreSQL — Querying a Table](https://www.postgresql.org/docs/current/tutorial-select.html)
  - Used in: steps 3 and 4
- **The N+1 problem** — one query for the answers, then one more *per answer* for its comments, gets slower with every answer. The fix is one query for *all* the comments, then sorting them out in Python.
  - Learn: [SQLAlchemy glossary — N plus one problem](https://docs.sqlalchemy.org/en/20/glossary.html#term-N-plus-one-problem)
  - Used in: steps 3–5
- **Aggregation** — `SUM(value) … GROUP BY target_id` adds up the votes for each post. Scores are computed when read and never stored; `content.vote_totals` already does this.
  - Learn: [PostgreSQL — Aggregate Functions](https://www.postgresql.org/docs/current/tutorial-agg.html)
  - Used in: step 5
- **Bucketing with a hash map** — make one pass over the comments and drop each into `buckets[(parent_type, parent_id)]`. That's O(n), instead of scanning the whole list once per answer.
  - Learn: [Python — `collections.defaultdict`](https://docs.python.org/3/library/collections.html#collections.defaultdict)
  - Used in: step 4
- **Tuple sort keys** — Python compares tuples left to right. So `(not accepted, -votes, created_at)` means "accepted first, then most votes, then oldest", because `False < True`.
  - Learn: [Python — Sorting HOW TO](https://docs.python.org/3/howto/sorting.html) (key functions)
  - Used in: step 6
- **Atomic update vs read-modify-write** — "read 5, add 1, write 6" loses a view when two people read 5 at the same moment (a *race condition*). `UPDATE … SET view_count = view_count + 1` does it in one safe step inside the database.
  - Learn: [Wikipedia — Race condition](https://en.wikipedia.org/wiki/Race_condition) (intro)
  - Used in: step 7
- **404 vs 403 (information leakage)** — a 403 says "this exists, but you can't see it", which already leaks that it exists. For held content, answer 404.
  - Used in: step 1
- **Best effort** — some steps are allowed to fail quietly, like the view counter here. Wrap them in `try`/`except` and roll back, so the database session stays usable.
  - Used in: step 7

## To do

- [ ] **1. Load or 404** — in `services/questions.py`, write `load_viewable_question(db, question_id, viewer)`. It returns the question, or raises 404 `not_found` if the question is missing **or** `content.can_view` says no.
- [ ] **2. The route** — in `routers/questions.py`, add `GET "/{question_id}"`. Use `get_optional_user`, because visitors who aren't logged in may read too.
- [ ] **3. Answers** — in `build_question_out`, load this question's answers filtered by `visible_filter(Answer, viewer)`, loading their authors in the same go with `selectinload(Answer.author)`.
- [ ] **4. Comments in one query** — load comments whose parent is this question *or* one of those answers, visible only, oldest first. Bucket them by `(parent_type, parent_id)`.
- [ ] **5. Scores and attachments** — call `vote_totals` and `viewer_votes` once for the question and once for all the answer ids together, never once per answer. Get attachments with `files.attachments_for` (a stub that returns `{}`; mark it).
- [ ] **6. Sort** — build `AnswerOut.from_answer(...)` for each answer, sort with the key above, and return the full `QuestionOut`.
- [ ] **7. Count the view** — in the route, after building the payload:
  - run a targeted `update(Question)` that adds 1 to `view_count`, then commit and add 1 to the payload's `view_count`;
  - also set `updated_at=Question.updated_at` in that update. The model has `onupdate=func.now()` (see `models/question.py`), so without this every view would look like an edit;
  - on any exception, log a warning and `rollback`.

## Done when

- [ ] An accepted answer with **0** votes appears **before** an answer with +5, which appears before older answers with the same score.
- [ ] A comment on the question is in the top-level `comments`; a comment on an answer is nested inside that answer.
- [ ] Open the same question twice → the second response's `view_count` is one higher.
- [ ] In psql, `SELECT view_count, updated_at FROM questions;` before and after five views → `view_count` rose by 5 and `updated_at` didn't change.
- [ ] Set a question to pending with `UPDATE questions SET moderation_status='pending' WHERE id='…';` → another account gets **404**, and the author still gets it.
- [ ] A random UUID → **404**.
