# Lane D — AI & Trust: your twelve issues

You own `ai_conversations`, `ai_messages` and `attachments`, plus four services that layer
onto content through narrow seams: the **AI assistant** (streaming chat), **content
moderation** and the admin queue, **file** upload/serve, and **search**.

You own no core content tables — you read them. That's what makes your lane unusual:
almost everything you build sits next to someone else's data.

## The order to work in

Your lane is **four independent sub-spines**. Build them in any order; if one stalls, move
to another. That's unusual and it's worth using.

```
D-01 ──> D-04 ──> D-05           AI assistant
D-02 ──> D-06 ──> D-07 ──> D-08  moderation
D-03 ──> D-04                    (conversations feed the AI spine)
D-09 ──> D-10                    files
D-11 ──> D-12                    search
```

Two of your tasks unblock other people, so they're worth doing early even though nothing
in your own lane needs them yet:

- **D-02** — Lane B has five endpoints calling an approve-everything stub (milestone 4).
- **D-09** — Lane B's ask and answer forms can't attach anything until your seam exists
  (milestone 6).

| # | Issue | Size | Needs first |
|---|---|---|---|
| D-01 | LLM provider client | ~1 d | — |
| D-02 | Moderation service | ~1.5 d | — |
| D-03 | AI conversation CRUD | ~1 d | A-01 (stubbed) |
| D-04 | AI streaming endpoint | ~2 d | D-01, D-03 |
| D-05 | AI assistant pages | ~2 d | D-03, D-04 |
| D-06 | Admin bootstrap | ~0.5 d | — |
| D-07 | Moderation queue API | ~1.5 d | D-02, D-06 |
| D-08 | Moderation queue UI | ~1 d | D-07 |
| D-09 | Files API + binding seam | ~2 d | A-01 (stubbed) |
| D-10 | Files UI | ~1–1.5 d | D-09 |
| D-11 | Search API | ~2 d | — |
| D-12 | Search UI | ~1–1.5 d | D-11 |

## The tests: work test-first

The suite in `backend/tests/` is already written and starts **red**. Read your task's test
file **before** you write code. In this lane that advice is unusually load-bearing —
three of your test files require **function names or call signatures the prose spec
doesn't give you**:

- **D-01** — the tests call `llm.chat_stream([...])` and expect it to raise
  **without being awaited or iterated**. Write it as a bare async generator and it silently
  won't. Read that test before you write a line.
- **D-02** — the tests call `moderation.evaluate_scores(scores_dict)`, a synchronous
  function the spec never names.
- **D-06** — the tests call `promote_to_admin(db, email)`; the spec writes it as
  `promote_to_admin(email)`.
- **D-04** — the tests monkeypatch `app.routers.ai.settings.LLM_RATE_LIMIT_PER_HOUR` and
  assert the exact substring `"delta": "Hel"`, which fixes both where your endpoint lives
  and how you serialise the JSON.

```bash
docker-compose up --build
docker-compose exec backend pytest tests/lane_d/test_d09_files_api.py -v   # the task you're on
docker-compose exec backend pytest tests/lane_d                             # before every PR
```

| Issue | Its test file | Tests |
|---|---|---|
| D-01 | `tests/lane_d/test_d01_llm_client.py` | 3 |
| D-02 | `tests/lane_d/test_d02_moderation_service.py` | 3 |
| D-03 | `tests/lane_d/test_d03_ai_crud.py` | 3 |
| D-04 | `tests/lane_d/test_d04_ai_streaming.py` | 3 |
| D-05 | *(none — UI)* | covered by `test_d03` + `test_d04`; contract in `m8` |
| D-06 | `tests/lane_d/test_d06_admin_bootstrap.py` | 2 |
| D-07 | `tests/lane_d/test_d07_moderation_queue.py` | 4 |
| D-08 | *(none — UI)* | covered by `test_d07` + `m1` |
| D-09 | `tests/lane_d/test_d09_files_api.py` | 4 |
| D-10 | *(none — UI)* | covered by `test_d09` + `m6` |
| D-11 | `tests/lane_d/test_d11_search_api.py` | 4 |
| D-12 | *(none — UI)* | covered by `test_d11` |

**Green is a floor, not a finish line.** Each issue's *The tests that grade this task*
section says what its tests check and what they don't. The largest gaps in this lane:
D-04's **entire cancellation and partial-persistence path** is untested and is the hardest
thing you'll write; D-07's on-approval notification flush has no test anywhere; D-09's
**whole binding seam** is only covered by a milestone test that needs Lane B; and D-11
tests four of its dozen behaviours.

**Milestone tests** (`tests/milestones/`) assert cross-lane effects and stay red until
stubs get swapped. Four involve you:

- `test_m1_real_auth.py` — needs **Lane A**'s `require_admin` plus your D-06 admin; it's
  what proves `/api/moderation/pending` really is admin-only.
- `test_m4_moderation.py` — turns green when **Lane B** swaps your D-02 hook in: flagged
  content is held, hidden from strangers, and its author notified.
- `test_m6_files.py` — turns green when **Lane B** swaps your D-09 binding in: an uploaded
  file appears in a question's detail.
- `test_m8_ai_answer.py` — the contract for D-05's "Use this as my answer" hand-off into
  Lane B's answer create.

None of them gate your PRs. Run the relevant one the day after a swap.

## Four rules that apply to every issue

1. **Never write an Alembic migration.** The schema is frozen — including the
   `search_vector` trigger and the GIN index you'll use in D-11.
2. **Never change existing shapes in `frontend/src/lib/types.ts`.**
3. **Don't wait on anyone.** Stub what you don't own, mark it
   `# STUB: swap for <task-id>`, and swap it the *day* the owner ships. You have two:
   `content.can_view` / `visible_filter` (B-01) and the `notifications.*` family (C-01).
4. **You own four seams other people import** — `moderation.screen_and_stage` (B),
   `bind_attachments` / `attachments_for` / `delete_attachments_for` (B), `<FileUpload>` /
   `<AttachmentList>` (B), and `is_initial_admin` (A). Their signatures are already in the
   stubs. Don't change one without asking; announce the day each lands.
