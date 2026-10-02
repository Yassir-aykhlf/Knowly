# Q3 · Anyone can browse the questions

- **Track:** Q "Asking"
- **Depends on:** Q1
- **Size:** M

## Goal

`GET /api/questions?sort=newest|votes|unanswered&page=…&limit=…` returns one page of question cards, even to visitors who aren't logged in.

## Can you already…?

- Work out which rows are on page 3 when there are 20 per page?
- Explain what a `LEFT JOIN` keeps that a plain `JOIN` drops?
- Say what `NULL + 1` is in SQL?

## Concepts to learn

- **Pagination** — `OFFSET (page - 1) * limit LIMIT limit` fetches one page, and the number of pages is ceil(total / limit). The client needs `total` to draw the pager.
  - Learn: [PostgreSQL — LIMIT and OFFSET](https://www.postgresql.org/docs/current/queries-limit.html)
  - Used in: step 4
- **The count and the items must agree** — `total` must use exactly the same filter as `items`, or held questions inflate the count. Build the conditions once and use them in both queries.
  - Used in: steps 2 and 4
- **EXISTS / NOT EXISTS** — "keep the questions for which *no* approved answer exists". This pattern is called an *anti-join*.
  - Learn: [PostgreSQL — Subquery Expressions](https://www.postgresql.org/docs/current/functions-subquery.html) (EXISTS)
  - Used in: step 3
- **Subquery + LEFT JOIN + COALESCE** — compute each question's vote sum in a subquery, then LEFT JOIN it. Questions without votes keep their row, with NULL as the sum. Sort by `COALESCE(sum, 0)` so NULL counts as 0.
  - Learn: [PostgreSQL — Joins Between Tables](https://www.postgresql.org/docs/current/tutorial-join.html), [PostgreSQL — COALESCE](https://www.postgresql.org/docs/current/functions-conditional.html)
  - Used in: step 5
- **One shape per concept** — Lane A already returns this exact card for profile pages (`ProfileQuestionOut` in `schemas/user.py`). Two shapes for the same card would drift apart.
  - Used in: step 1

## To do

- [ ] **1. Schemas** — in `schemas/question.py`, add `QuestionListItem = ProfileQuestionOut` and `QuestionPage` (`items`, `total`, `page`, `limit`). To see how Lane A builds the same card, read `get_profile_questions` in `routers/users.py`.
- [ ] **2. The route** — in `routers/questions.py`, add `GET ""` with these query parameters:
  - `sort`: only `newest`, `votes` or `unanswered` (use `Literal[...]`), default `newest`;
  - `page` ≥ 1;
  - `limit` from 1 to 100, default 20.
  - Start a list of conditions with `visible_filter(Question, viewer)`.
- [ ] **3. Unanswered** — for `unanswered`, add a condition meaning "no approved answer of this question exists" (`~exists().where(...)`).
- [ ] **4. Count and page** — `total` is a count using the conditions. The items query uses the same conditions, plus the ordering and `offset`/`limit`, and loads authors with `selectinload`.
- [ ] **5. Ordering** —
  - `newest`: `created_at` descending;
  - `votes`: outer-join the vote-sum subquery and sort by `coalesce(sum, 0)` descending, then `created_at` descending;
  - in both cases, add `id` as the last tie-breaker so no question ever appears on two pages.
- [ ] **6. Card numbers** — for the ids on this page only, call `vote_totals` and run one grouped count of **approved** answers per question. Build each excerpt with `excerpt(q.body)` from `schemas/common.py`.

## Done when

- [ ] Logged out, `GET /api/questions` → 200 with items.
- [ ] With 3 questions, `?limit=2` → `total: 3` and 2 items, newest first; `?limit=2&page=2` → the third one.
- [ ] A held question is missing from the items **and** not counted in `total`.
- [ ] A question with an approved answer disappears from `?sort=unanswered`, while one whose only answer is pending stays.
- [ ] A question with more votes comes first in `?sort=votes` (vote with P5's endpoint, or insert a row into `votes` in psql).
- [ ] A 3 000-character body shows up as a single line of 240 characters ending in `...`.
- [ ] `?sort=hot` → **400**; `?limit=0` → **400**.
