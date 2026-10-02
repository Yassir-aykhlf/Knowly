# P2 · A user can answer a question

- **Track:** P "Participating"
- **Depends on:** P1, and **Q1 merged**
- **Size:** M

## Goal

`POST /api/questions/{id}/answers` saves an answer, notifies the person who asked, and never credits someone else's AI conversation.

## Can you already…?

- Read the URL `/questions/{id}/answers` as a sentence?
- Say what an attacker gains by changing an id inside a request?

## Concepts to learn

- **Nested resources** — the URL says "the answers *of* question {id}", so that question must exist and be visible to you. Otherwise the reply is 404.
  - Learn: [FastAPI — Path Parameters](https://fastapi.tiangolo.com/tutorial/path-params/)
  - Used in: steps 2 and 6
- **Broken access control (IDOR)** — the client sends the id of *something else* (`from_conversation_id`), and the server must check that the thing belongs to the caller.
  - Learn: [OWASP Top 10 — A01 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
  - Used in: step 5
- **Failing silently on purpose** — a conversation id that belongs to someone else is not an error: the AI badge is simply dropped. An error would reveal that the conversation exists, and the answer itself is fine.
  - Used in: step 5
- **Side effects inside the transaction** — the "new answer" notification goes into the same transaction as the answer, so either both are saved or neither is. It's also *idempotent*: staging it twice for the same answer has no extra effect. Q1's `screening.py` handles this.
  - Learn: [MDN — Idempotent](https://developer.mozilla.org/en-US/docs/Glossary/Idempotent)
  - Used in: step 6
- **Organising routers** — your answers router has no prefix and spells out full paths, so one file can hold both `/questions/{id}/answers` and `/answers/{id}` without touching Track Q's file.
  - Learn: [FastAPI — Bigger Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
  - Used in: step 1

## To do

- [ ] **1. Router** — create `backend/app/routers/answers.py` with `router = APIRouter(tags=["answers"])` (no prefix). Mount it in `main.py`; if git reports a conflict with Track Q's line there, keep both.
- [ ] **2. Load the question** — write a helper that loads the question and raises 404 if it's missing or if `content.can_view` says no.
- [ ] **3. Input schema** — append `AnswerCreate` to `schemas/answer.py`:
  - fields: `body`, `is_ai_assisted=False`, `from_conversation_id: str | None`, `attachment_ids=[]`;
  - the conversation id is a plain *string*, so a malformed id just drops the badge instead of failing validation.
- [ ] **4. Validation** — body 30–30 000 characters after trimming, and at most 10 attachments; otherwise a 400 with `fields`. Import the limits from `services/questions.py` (Q1) rather than copying the numbers.
- [ ] **5. The AI flag** — write `_owns_conversation(db, raw_id, user)`:
  - if `raw_id` doesn't parse as a UUID, return `False`;
  - otherwise look for an `AiConversation` with that id **and** `user_id == user.id`;
  - the answer's flag is `payload.is_ai_assisted and await _owns_conversation(...)`.
- [ ] **6. The route** — `POST "/questions/{question_id}/answers"` with status 201:
  - create the `Answer` and add it;
  - call `screen_and_stage(kind="answer", obj=answer, text=body, question_id=question.id, parent_author_id=question.author_id)`, which stages the asker's `answer_created` notification;
  - call `files.bind_attachments(...)` (a stub; mark it), then commit;
  - refresh the answer, plus its author with `await db.refresh(answer, ["author"])`, since async SQLAlchemy won't load it lazily;
  - return `AnswerOut.from_answer(answer)`.

## Done when

- [ ] Answering someone else's question → **201**, with your body echoed back and `is_ai_assisted: false`.
- [ ] Answering your own question → **201**, and you get no notification about it.
- [ ] The asker's `GET /api/notifications` now contains an `answer_created` item.
- [ ] Answering a random question id, or a `pending` question as a stranger → **404**.
- [ ] A 9-character body → **400** with `fields.body`.
- [ ] With a conversation you own (create one in psql: `INSERT INTO ai_conversations (id, user_id, title) VALUES (gen_random_uuid(), '<your user id>', 'chat') RETURNING id;`) and `is_ai_assisted: true` → the answer comes back with `is_ai_assisted: true`.
- [ ] The same request with someone else's conversation id, or with `"garbage"` → still **201**, but `is_ai_assisted: false`.
