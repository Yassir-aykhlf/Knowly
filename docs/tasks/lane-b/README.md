# Lane B — Q&A Core: your fourteen issues

You own `questions`, `answers`, `comments` and `votes`, and the entire content lifecycle:
create, read, edit, delete, vote, accept — plus the `content` service that Lanes A and D
read through.

You are the gravity well of this app. Almost every other lane hooks into content you
produce: Lane A's profile counts, Lane C's notifications, Lane D's moderation, files and
search. Keep your seam clean and land your read paths early.

One thing to internalise before you start: **all content is born `approved`.** The schema
defaults it that way, and the moderation seam (D-02) is a stub that approves everything
until Lane D ships. Nothing you build waits on that.

## The order to work in

```
B-01 ──┬─> B-02 ──> B-05 ──┐
       ├─> B-03 ───────────┼─> B-11
       ├─> B-04 ──┬─> B-06 ──> B-07
       │          ├─> B-08
       │          └─> B-09
       └─> B-10                        B-14 (independent — build early)
B-02, B-05 ──> B-12
B-04/06/08/09/10 + B-14 ──> B-13
```

**B-01 first, and finish it.** Three other lanes are on stub visibility rules until you
ship, and every task in your own lane composes it.

Then B-02/B-03/B-04 as a block — B-02 returns B-04's payload, so building those two
together is usually less work than building them apart. After that, B-05 through B-10 are
genuinely parallel. **B-14 depends on nothing** — if you're blocked, take it, and Lane D
stops waiting on `<MarkdownBody>`.

| # | Issue | Size | Needs first |
|---|---|---|---|
| B-01 | Content seam | ~1.5–2 d | — |
| B-02 | Create question | ~1 d | B-01 |
| B-03 | Question feed | ~1 d | B-01 |
| B-04 | Question detail | ~1.5 d | B-01 |
| B-05 | Edit & delete question | ~1 d | B-04 |
| B-06 | Create answer | ~1 d | B-04 |
| B-07 | Edit & delete answer | ~1 d | B-06 |
| B-08 | Accept answer | ~0.5 d | B-06 |
| B-09 | Comments | ~1 d | B-04 |
| B-10 | Voting | ~0.5–1 d | B-01 |
| B-11 | Home feed page | ~1 d | B-03 |
| B-12 | Ask / edit question page | ~1–1.5 d | B-02, B-05 |
| B-13 | Question detail page | ~2–2.5 d | B-04/06/08/09/10, B-14 |
| B-14 | MarkdownBody + VoteArrows | ~1 d | — |

## The tests: work test-first

The suite in `backend/tests/` is already written and starts **red**. Read your task's
test file **before** you write code — it settles things the prose leaves open (is the
response `{vote_total, my_vote}` exactly, or may it carry extra keys? does `total`
respect the filter?).

```bash
docker-compose up --build
docker-compose exec backend pytest tests/lane_b/test_b04_question_detail.py -v   # the task you're on
docker-compose exec backend pytest tests/lane_b                                   # before every PR
```

| Issue | Its test file | Tests |
|---|---|---|
| B-01 | `tests/lane_b/test_b01_content_seam.py` | 4 — called directly, no HTTP |
| B-02 | `tests/lane_b/test_b02_create_question.py` | 5 |
| B-03 | `tests/lane_b/test_b03_question_feed.py` | 3 |
| B-04 | `tests/lane_b/test_b04_question_detail.py` | 4 |
| B-05 | `tests/lane_b/test_b05_edit_delete_question.py` | 2 |
| B-06 | `tests/lane_b/test_b06_create_answer.py` | 4 |
| B-07 | `tests/lane_b/test_b07_edit_delete_answer.py` | 3 |
| B-08 | `tests/lane_b/test_b08_accept_answer.py` | 4 |
| B-09 | `tests/lane_b/test_b09_comments.py` | 4 |
| B-10 | `tests/lane_b/test_b10_voting.py` | 4 |
| B-11 | *(none — UI)* | covered by `test_b03` |
| B-12 | *(none — UI)* | covered by `test_b02` + `test_b05` |
| B-13 | *(none — UI)* | covered by `test_b04/06/08/09/10` + `m8` |
| B-14 | *(none — UI)* | covered by `test_b10` |

**Green is a floor, not a finish line.** Each issue's *The tests that grade this task*
section says what its tests check **and what they don't**. In this lane the notable gaps:
nothing checks that a page view leaves `updated_at` alone (B-04); nothing counts comments
or votes after an **answer** delete (B-07); and **no lane-B test ever asserts a
notification**, by design — lane tests never assert another lane's side effects.

**Milestone tests** (`tests/milestones/`) assert exactly those cross-lane effects, and
stay red until stubs get swapped. Four touch your code:

- `test_m2_content_seam.py` — **Lane A** swaps to your B-01 `visible_filter`; the owner's
  profile counts start including their own held content.
- `test_m3_notifications.py` — you swap **C-01** into B-06 and B-10; answers and first
  votes start notifying.
- `test_m4_moderation.py` — you swap **D-02** into B-02 and friends; flagged content is
  actually held, hidden from strangers, and its author notified.
- `test_m6_files.py` — you swap **D-09** into B-02/B-04; attachments appear in the
  question detail.
- `test_m8_ai_answer.py` — grades **your** AI-assisted rule in B-06 once Lane D's
  conversations exist. Build the rule now; the test arrives later.

None of them gate your PRs. Run the relevant one the day after each swap.

## Four rules that apply to every issue

1. **Never write an Alembic migration.** The schema is frozen and shared.
2. **Never change existing shapes in `frontend/src/lib/types.ts`.**
3. **Don't wait on anyone.** Stub what you don't own, mark it
   `# STUB: swap for <task-id>`, and swap it the *day* the owner ships. You have four
   sets of stubs: moderation (D-02), files (D-09/D-10), notifications (C-01), and the AI
   prefill (D-05).
4. **You own one seam three lanes import** — `services/content.py`. Its signatures are
   already written into the stub so others could code against them. Don't change one
   without asking; announce the day B-01 lands.
