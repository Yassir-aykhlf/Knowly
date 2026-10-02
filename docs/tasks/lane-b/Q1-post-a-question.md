# Q1 · A user can post a question

- **Track:** Q "Asking"
- **Depends on:** 00
- **Unblocks:** P2
- **Size:** L

## Goal

`POST /api/questions` saves a question for the logged-in user and replies with the full question, in the same shape the question page will read.

## Can you already…?

- Name the status code for "created", "your input is wrong" and "you're not logged in"?
- Say what a Python class with typed fields like `title: str` is for?
- Explain what "commit" means for a database?

## Concepts to learn

- **Status codes 201 / 400 / 401** — created / bad input / not logged in.
  - Learn: [MDN — HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
  - Used in: steps 5 and 7
- **Trust boundary** — anything that arrives over the network may be wrong or hostile, so the server checks every field again, even if the web page already did.
  - Learn: [OWASP — Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) (intro)
  - Used in: step 5
- **Schema (a "DTO")** — a class that declares the exact shape of the JSON going in or out. Pydantic checks and converts it for you.
  - Learn: [FastAPI — Request Body](https://fastapi.tiangolo.com/tutorial/body/), [FastAPI — Response Model](https://fastapi.tiangolo.com/tutorial/response-model/)
  - Used in: steps 2 and 3
- **Dependency injection** — the route declares `user = Depends(get_current_user)`, and FastAPI supplies the user, or answers 401 on its own.
  - Learn: [FastAPI — Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/)
  - Used in: step 7
- **Transactions: flush vs commit** — `flush` sends your pending INSERT into the open transaction, so the row gets its id, but nothing is permanent yet. `commit` makes everything permanent at once, or nothing if it fails (*atomicity*).
  - Learn: [PostgreSQL — Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html), [SQLAlchemy — Data Manipulation with the ORM](https://docs.sqlalchemy.org/en/20/tutorial/orm_data_manipulation.html)
  - Used in: step 7
- **Seam / stub** — a function owned by another team. It already has its real signature but a placeholder body, so you can build today. You call it; you don't fill it in. `services/moderation.py` and `services/files.py` are stubs.
  - Used in: steps 4 and 7

## To do

- [ ] **1. Learn the target shape** — in `frontend/src/lib/types.ts`, read `Author`, `Comment`, `Answer`, `Question` and `Attachment`. What the backend sends must match them field for field.
- [ ] **2. Output schemas** — create these (P2 builds on them):
  - `backend/app/schemas/attachment.py`: `AttachmentOut`.
  - `backend/app/schemas/comment.py`: `CommentOut`, with a `from_comment(comment)` classmethod.
  - `backend/app/schemas/answer.py`: `AnswerOut`, with a `from_answer(answer, vote_total=0, my_vote=0, comments=None, attachments=None)` classmethod.
  - Build authors with the existing `AuthorOut.from_user` in `schemas/user.py`.
- [ ] **3. Question schemas** — `backend/app/schemas/question.py`:
  - `QuestionCreate`: `title`, `body`, `tags=[]`, `attachment_ids=[]`.
  - `QuestionOut`: every field of the frontend `Question` type.
- [ ] **4. Screening wrapper** — `backend/app/services/screening.py`: a `screen_and_stage(...)` that takes the same keyword arguments as the stub in `services/moderation.py`. In order, it:
  - remembers whether this is an edit of content that was already approved;
  - calls the moderation stub, which sets `moderation_status` and flushes;
  - works out the question id (for a question, that's its own id). If there isn't one, it returns without doing anything else (see P4);
  - calls `notifications.emit_content_approved`, which sends @mention notifications;
  - if approved content was edited and is still approved, calls `notifications.notify_content_edited`;
  - marks the last two calls `# STUB: drop once D-02 stages notifications itself`.
- [ ] **5. Validation** — in `backend/app/services/questions.py`, write `clean_question_fields(title, body, tags, attachment_ids)`:
  - It returns the trimmed values, or raises a 400 whose detail is `{"code": "validation_error", "message": …, "fields": {…}}` and lists **every** bad field at once, not just the first.
  - Rules: title 10–200 characters after trimming; body 30–30 000 characters; empty tags dropped, then at most 5 tags of 2–30 characters each; at most 10 attachment ids.
  - Keep the numbers in named constants. P2 imports them.
- [ ] **6. First serializer** — in the same file, write `build_question_out(db, question, viewer)`:
  - It returns a `QuestionOut` with empty `answers`, `comments` and `attachments`. Q2 fills these in.
  - Take `vote_total` and `my_vote` from `content.vote_totals` and `content.viewer_votes`.
- [ ] **7. The route** — `backend/app/routers/questions.py`, `POST ""` with `status_code=201`. In order:
  - require the user;
  - validate;
  - create `Question(author_id=user.id, …)` and `db.add` it;
  - call `screen_and_stage(kind="question", text=f"{title}\n\n{body}")`, so the title and body are screened together;
  - call `files.bind_attachments(...)` (a stub; mark it `# STUB: swap for D-09`);
  - `commit`, then `refresh` (the database fills in `created_at` and friends), then return `build_question_out`.
- [ ] **8. Mount it** — in `backend/app/main.py`, import the router and add `app.include_router(questions.router, prefix="/api")`.

Two things to know about async SQLAlchemy:

- Touching a relationship that isn't loaded (such as `question.author`) raises `MissingGreenlet`. Load the user with `await db.get(User, question.author_id)` instead.
- Values the database generates, such as `created_at`, only exist on the object after `await db.refresh(question)`.

## Done when

In `/api/docs`, logged in on the site in the same browser:

- [ ] A valid question → **201**, the full question comes back, and `moderation_status` is `"approved"`, `answers` and `comments` are `[]`, and `vote_total` and `view_count` are `0`.
- [ ] Tags `["ok", "", "  ", "fine"]` → saved as `["ok", "fine"]`.
- [ ] A 5-character title **and** a 10-character body → **400**, with both `title` and `body` in `fields`.
- [ ] Six tags → **400** with `tags`; 11 attachment ids → **400** with `attachment_ids`.
- [ ] Logged out → **401**.
