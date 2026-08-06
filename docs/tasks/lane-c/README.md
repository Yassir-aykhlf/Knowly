# Lane C — Social & Signals: your ten issues

You own three things in Knowly: the **friend graph**, **direct messages**, and the
**notification system**. Ten issues, one per task. Each one is written so you can
pick it up cold and know both what to build and when you're finished — if an issue
ever fails that test, say so and it gets fixed. That's a bug in the issue, not in you.

## The order to work in

Lane C is three chains. Two of them are independent, so if one stalls you are never
actually stuck.

```
C-01 ──> C-02 ──> C-03 ──> C-04            notifications
C-01 ──> C-05 ──> C-06 ──> C-07 ──> C-08   friends
C-09 ──> C-10                              messages  (independent of everything above)
```

**Start with C-01 and finish it first.** Two other people are writing code today that
calls the functions in that ticket — they're currently calling do-nothing stubs, and
they stay blocked on their real features until you ship. It's also the hardest task in
the lane, which is a deliberate choice: hard things go first, while there's time.

If C-01 is fighting you, C-09 (messages) depends on none of it. Switching to it for a
day is a legitimate move, not an admission of anything.

| # | Issue | Size | Needs first |
|---|---|---|---|
| C-01 | Notification write-seam | ~2–3 d | — |
| C-02 | Notification inbox API | ~1 d | C-01 |
| C-03 | Notification bell | ~1–1.5 d | C-02 |
| C-04 | Notifications page | ~0.5 d | C-02 (do it after C-03) |
| C-05 | Friend requests | ~1 d | C-01 |
| C-06 | Friend respond & remove | ~0.5–1 d | C-05 |
| C-07 | Friend listings + state seam | ~1 d | C-05 |
| C-08 | Friends UI | ~1.5 d | C-07 |
| C-09 | Direct messages API | ~1.5 d | — |
| C-10 | Messages UI | ~1.5 d | C-09 |

## The tests: work test-first

The test suite in `backend/tests/` is already written and it starts **red**. That's
the point — turning your task's file green is the workflow, not an afterthought. Read
the test file for your task **before** you write any code: it is the most precise
statement of what the task wants, and it settles questions the prose can leave open
(is that 200 or 201? is the response an array or an envelope?).

```bash
docker-compose up --build                                       # the app runs
docker-compose exec backend pytest tests/lane_c/test_c05_friend_requests.py -v   # the task you're on
docker-compose exec backend pytest tests/lane_c                  # your whole lane, before every PR
```

| Issue | Its test file | Tests |
|---|---|---|
| C-01 | `tests/lane_c/test_c01_notification_seam.py` | 5 — called directly, no HTTP |
| C-02 | `tests/lane_c/test_c02_inbox_api.py` | 2 |
| C-03 | *(none — UI)* | covered by `test_c02_inbox_api.py` + `milestones/test_m7_notification_inbox.py` |
| C-04 | *(none — UI)* | covered by `test_c02_inbox_api.py` |
| C-05 | `tests/lane_c/test_c05_friend_requests.py` | 5 |
| C-06 | `tests/lane_c/test_c06_friend_respond_remove.py` | 4 |
| C-07 | `tests/lane_c/test_c07_friend_listings_state.py` | 3 |
| C-08 | *(none — UI)* | covered by `test_c05/c06/c07` + `milestones/test_m5_friendship.py` |
| C-09 | `tests/lane_c/test_c09_messages_api.py` | 5 |
| C-10 | *(none — UI)* | covered by `test_c09_messages_api.py` |

**Why lane tests ignore other lanes:** they're written to pass *while the cross-lane
stubs are still in place*, so you're never blocked by someone else's unfinished work.
That's what `tests/milestones/` is for — those assert the real cross-lane effects and
**stay red until the stubs get swapped**. Three of them are yours to watch:

- `test_m3_notifications.py` — turns green when **Lane B** wires your C-01 functions in.
- `test_m5_friendship.py` — turns green when **Lane A** embeds your C-07 seam.
- `test_m7_notification_inbox.py` — one inbox aggregating events from two lanes at once.

None of them gate your PRs. All of them are how you prove an integration actually
happened, so run the relevant one the day after you announce a seam.

The four UI tasks (C-03, C-04, C-08, C-10) have a numbered *Verify it yourself*
walkthrough instead of a test file. Walk every line. Most steps need **two logged-in
accounts** — a normal window and a private window — and skipping that is how UI tasks
get shipped broken.

## Four rules that apply to every issue

1. **Never write an Alembic migration.** The database schema is frozen and shared by
   four people. If you think a column is missing, stop and ask — you're either right
   and it's a coordinated change, or you're about to break everyone's database.
2. **Never change `frontend/src/lib/types.ts` shapes that already exist.** They're the
   contract between your API and everyone's UI. Adding new types is fine.
3. **Don't wait on anyone.** If you need something another lane hasn't built, write a
   local stub with the real signature, mark it
   `# STUB: swap for <task-id>`, and keep moving. The moment they ship, delete the
   stub and swap in the real import — the signature is identical, so only the import
   line changes. Do that swap the *day* they ship, not at the end.
4. **You own three seams other people import.** `create_notification` (C-01),
   `friendship_state_for` (C-07), and `<AddFriendButton>` (C-08). Their signatures are
   already written into the stub files precisely so others can code against them.
   Don't change a signature without asking; do announce in the team channel the day
   each one lands.
