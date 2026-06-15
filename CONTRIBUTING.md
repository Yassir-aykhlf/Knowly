# Contributing to Knowly

## Workflow

`main` is protected; no direct pushes. All work happens on a feature branch and lands via pull request.

1. Branch off the latest `main`:
   ```
   git switch main && git pull
   git switch -c <type>/<short-description>  #e.g. feat/avatar-upload
   ```
2. Commit in small, logical steps
3. Push and open a PR against `main`.
4. At least one teammate reviews; CI must be green.
5. Squash or rebase-merge into `main`. Delete the branch after merge.

## Branch naming

`<type>/<short-description>`, where `<type>` is one of:
`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `infra`.

## Commit message convention

Conventional-Commits style:

```
<type>(<scope>): <imperative summary>

<optional body explaining what and why>
```

- `type`: `feat` | `fix` | `chore` | `docs` | `refactor` | `test` | `infra`
- `scope`: the module or area, e.g. `auth`, `models`, `nginx`.
- Summary: imperative mood, no trailing period, ≤ 72 chars.

Example: `feat(auth): add bcrypt password hashing utility`

## Code conventions

- **Backend**: FastAPI + SQLAlchemy 2.0. No raw SQL in application code.
  All schema changes go through Alembic.
- **Frontend**: React 18 + TypeScript. Tailwind for styling. Zero
  browser console errors/warnings on any page.
- Keep changes scoped so a single feature touches one or two files where possible.