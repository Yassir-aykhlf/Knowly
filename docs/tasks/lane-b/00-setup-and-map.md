# 00 · Setup and the map

- **Track:** both teammates
- **Depends on:** nothing
- **Size:** M

## Goal

Run Knowly on your machine, and be able to follow one click from the browser to the database and back.

## Can you already…?

- Say, step by step, what happens when a browser loads a web page?
- Explain what a table, a row and a foreign key are?
- Create a git branch and switch between branches?

## Concepts to learn

- **Client and server** — the browser (client) sends a request, and a program on another machine (server) sends back a response.
  - Learn: [MDN — An overview of HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview)
  - Used in: step 4
- **HTTP request / response** — a request has a method (`GET` reads, `POST` creates, `PUT` replaces, `DELETE` removes), a path, headers and an optional body. A response has a status code, headers and a body.
  - Learn: [MDN — HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods), [MDN — HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status) (skim)
  - Used in: step 5
- **JSON** — the text format both sides use to exchange data, such as `{"title": "Hi", "tags": ["a"]}`.
  - Learn: [MDN — Working with JSON](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/JSON)
  - Used in: step 4
- **Reverse proxy** — nginx receives every request first. It forwards `/api/…` to the Python backend and serves everything else from the built frontend files.
  - Learn: [Wikipedia — Reverse proxy](https://en.wikipedia.org/wiki/Reverse_proxy) (intro)
  - Used in: step 5
- **Container** — a sealed mini-computer started from an *image*. The image is a snapshot of your code, so **after every code change you rebuild the image**.
  - Learn: [Docker — Get started](https://docs.docker.com/get-started/) (parts 1–2)
  - Used in: steps 2 and 3
- **Relational database** — data lives in tables. Each row has a primary key (`id`), and a *foreign key* is a column that points at another table's `id`.
  - Learn: [PostgreSQL tutorial, chapter 2](https://www.postgresql.org/docs/current/tutorial-sql.html)
  - Used in: step 6
- **ORM** — a library (SQLAlchemy) that maps each table to a Python class and each row to an object, so you write Python instead of SQL.
  - Learn: [SQLAlchemy 2.0 — Unified Tutorial](https://docs.sqlalchemy.org/en/20/tutorial/index.html) (read the overview only)
  - Used in: step 6
- **async / await** — the backend can wait for the database without freezing, because every database call is `await`ed.
  - Learn: [FastAPI — Concurrency and async / await](https://fastapi.tiangolo.com/async/)
  - Used in: step 5
- **Branch** — your own line of commits, so you can work without disturbing `main`.
  - Learn: [Pro Git — Branches in a Nutshell](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell)
  - Used in: step 8

## To do

- [ ] **1. Install** — install git and Docker (Docker Desktop, or Docker Engine with compose), then clone the repo.
- [ ] **2. Configure and start** — run these from the repo root, then wait until the `backend` service reports healthy:
  - `cp env.example .env`
  - `./scripts/generate-cert.sh`
  - `docker-compose up --build`
- [ ] **3. Learn the change loop** — code is baked into the images, so after every change you rebuild the part you touched:
  - backend: `docker-compose up -d --build backend`
  - frontend: `docker-compose up -d --build frontend`, then hard-reload the browser (Ctrl+Shift+R)
- [ ] **4. Look around** — open `https://localhost:8443`, accept the self-signed certificate warning, and register two accounts.
  - Open `https://localhost:8443/api/docs`. It lists every backend endpoint, and you can call each one from there. Try `GET /api/health`.
- [ ] **5. Trace one request** — follow `GET /api/notifications` (built by Lane C) and write one line for each file it passes through:
  - `nginx/nginx.conf`: which `location` block matches `/api/`, and where does it forward the request?
  - `backend/app/main.py`: which line plugs in the notifications router, and with what prefix?
  - `backend/app/routers/notifications.py` → `list_notifications`: what does `Depends(get_current_user)` give the function? What happens when there's no login cookie?
  - `backend/app/models/notification.py` is the table, and `backend/app/schemas/notification.py` is the JSON shape sent back.
  - `frontend/src/lib/api.ts`: how does the frontend send a request, and how does it turn an error into an `ApiError`?
- [ ] **6. Explore the database** — open it with `docker-compose exec db psql -U knowly knowly`.
  - Run `\dt`, then `\d questions`, `\d answers`, `\d comments` and `\d votes`.
  - Which tables have a foreign key to `questions`? Which don't, and how do they point at their parent instead?
  - `\q` quits psql.
- [ ] **7. Read the content helpers** — `backend/app/services/content.py` is Lane B's foundation, and every later ticket uses it. Fill in the table below for `can_view`.
  - `visible_filter` answers the same question inside SQL. Why do both exist?
- [ ] **8. Branch** — `git switch main && git pull && git switch -c feat/<your first ticket>`.

Table for step 7 (✔ = may see the post):

| `moderation_status` | anonymous visitor | the author | another user | an admin |
|---|---|---|---|---|
| `approved` | | | | |
| `pending` | | | | |

## Done when

- [ ] `https://localhost:8443` loads and you can log in.
- [ ] You can call `GET /api/health` from `/api/docs`.
- [ ] You have a written list of the files `GET /api/notifications` goes through, from nginx to the table.
- [ ] Your `can_view` table is filled in, and you can say why a stranger gets **404** rather than 403 for someone else's held post (read `load_owned`).
