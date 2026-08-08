# Lane A — Identity & Access: your fourteen issues

You own the `users` and `sessions` tables, and every endpoint and screen for
authentication, profiles, avatars, online status, Google OAuth, and account deletion.

You are the keystone. Your `get_current_user` dependency is what makes every other
lane's protected route real — until A-01 lands, the whole app runs on one hardcoded
fake user and nobody's permission rules can be tested.

## The order to work in

```
A-01 ──> A-02 ──┬─> A-04                     auth
         A-03 ──┘
A-01 ──> A-05 ──┬─> A-06 ──> A-07 ──┐        profiles
                ├─> A-08 ───────────┤
                ├─> A-09 ───────────┼─> A-12
                ├─> A-10            │
                └─> A-11 ───────────┘
A-01, A-02 ──> A-13 ──> A-14                 OAuth
```

**A-01 first, and finish it.** Three other people are building on the fixed-dev-user
stub right now; every 401 and 403 in the app is fake until you ship. It's also the task
everything else in your own lane depends on.

After A-05, the middle block (A-06, A-08, A-09, A-10, A-11) is genuinely parallel — pick
them in any order. A-10 is half a day and unblocks Lane C's online dots, so it's a good
one to slot in early.

| # | Issue | Size | Needs first |
|---|---|---|---|
| A-01 | Real sessions + auth dependency | ~1.5–2 d | — |
| A-02 | Registration | ~1 d | A-01 |
| A-03 | Login & logout | ~0.5–1 d | A-01 |
| A-04 | Auth UI + AuthContext | ~1.5 d | A-02, A-03 |
| A-05 | Current user + password change | ~0.5–1 d | A-01 |
| A-06 | Public profile + counts | ~1 d | A-01 |
| A-07 | Profile contribution listings | ~1 d | A-06 |
| A-08 | Profile edit | ~0.5 d | A-05 |
| A-09 | Avatars | ~1–1.5 d | A-05 |
| A-10 | Online status (heartbeat) | ~0.5 d | A-05 |
| A-11 | Account deletion | ~1.5 d | A-05 |
| A-12 | Profile & Settings pages | ~2 d | A-07/08/09/11 |
| A-13 | Google OAuth sign-in | ~1.5–2 d | A-01, A-02 |
| A-14 | OAuth account linking | ~1 d | A-13 |

## The tests: work test-first

The suite in `backend/tests/` is already written and starts **red**. Turning your task's
file green is the workflow, not an afterthought. Read the test file **before** you write
code — it settles questions the prose leaves open (is that 200 or 201? does the response
nest under `user`?).

```bash
docker-compose up --build
docker-compose exec backend pytest tests/lane_a/test_a02_registration.py -v   # the task you're on
docker-compose exec backend pytest tests/lane_a                                # before every PR
```

| Issue | Its test file | Tests |
|---|---|---|
| A-01 | `tests/lane_a/test_a01_sessions.py` | 3 |
| A-02 | `tests/lane_a/test_a02_registration.py` | 4 |
| A-03 | `tests/lane_a/test_a03_login_logout.py` | 5 |
| A-04 | *(none — UI)* | covered by `test_a02` + `test_a03` |
| A-05 | `tests/lane_a/test_a05_me_and_password.py` | 4 |
| A-06 | `tests/lane_a/test_a06_public_profile.py` | 4 |
| A-07 | `tests/lane_a/test_a07_profile_listings.py` | 3 |
| A-08 | `tests/lane_a/test_a08_profile_edit.py` | 5 |
| A-09 | `tests/lane_a/test_a09_avatars.py` | 3 |
| A-10 | `tests/lane_a/test_a10_online_status.py` | 2 |
| A-11 | `tests/lane_a/test_a11_account_deletion.py` | 3 |
| A-12 | *(none — UI)* | covered by `test_a06`–`test_a11` |
| A-13 | `tests/lane_a/test_a13_oauth_signin.py` | 3 |
| A-14 | `tests/lane_a/test_a14_oauth_linking.py` | 2 |

**Green is a floor, not a finish line.** Each issue has a *The tests that grade this
task* section listing what its tests check **and what they don't** — and in this lane the
gaps are large. A-11 has three tests and six cleanup steps, **none** of which are
checked. A-13 and A-14 can't test the happy path at all, because OAuth is unconfigured
in the test environment. Work the acceptance criteria; use the tests to catch yourself.

**Milestone tests** (`tests/milestones/`) assert cross-lane effects and stay red until
stubs get swapped. Two matter to you:

- `test_m1_real_auth.py` — turns green when **everyone** drops the fixed-dev-user stub
  after your A-01. It's the proof that milestone 1 actually happened.
- `test_m2_content_seam.py` — turns green when **Lane B** ships B-01 and you swap your
  `visible_filter` stub in A-06. It asserts the owner sees their own held content in
  their profile counts while a stranger doesn't.

Neither gates your PRs. Run the relevant one the day after a swap.

## Four rules that apply to every issue

1. **Never write an Alembic migration.** The schema is frozen and shared. If you think a
   column is missing, stop and ask.
2. **Never change existing shapes in `frontend/src/lib/types.ts`.** They're the contract
   between your API and everyone's UI. Adding new types is fine.
3. **Don't wait on anyone.** Need something another lane hasn't built? Write a local stub
   with the real signature, mark it `# STUB: swap for <task-id>`, and keep moving. Swap it
   the *day* they ship, not at the end. You have two: `visible_filter` (B-01) and
   `friendship_state_for` (C-07), both in A-06.
4. **You own one seam everyone imports** — `get_current_user` / `get_optional_user` /
   `require_admin`. Their signatures are already in `services/auth.py` so others could
   code against them. Don't change a signature without asking; do announce the day A-01
   lands.
