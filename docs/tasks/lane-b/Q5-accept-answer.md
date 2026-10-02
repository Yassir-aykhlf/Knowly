# Q5 · The asker marks the answer that solved it

- **Track:** Q "Asking"
- **Depends on:** Q2
- **Unblocks:** P6
- **Size:** S

## Goal

`POST /api/questions/{id}/accept-answer` with `{"answer_id": "…"}` marks an answer as accepted or moves the mark to a different answer. With `{"answer_id": null}` it clears the mark.

## Can you already…?

- Say what an *invariant* is?
- Explain how `null` can mean "clear this" in an API?

## Concepts to learn

- **An invariant enforced in code** — a rule that must always hold, such as "the accepted answer belongs to *this* question and is approved". No single foreign key can express it, so the endpoint checks it. Without the check, anyone could point their question at any answer in the database.
  - Learn: [Wikipedia — Class invariant](https://en.wikipedia.org/wiki/Class_invariant) (intro)
  - Used in: step 3
- **Move / clear semantics** — a new id simply moves the mark, and `null` clears it. There's no "un-accept first" step: fewer states means fewer bugs.
  - Used in: step 4
- **Domain error codes** — two different problems (wrong question, not approved) share one code, `invalid_answer`, each with its own message. The client branches on the code and shows the message.
  - Learn: [FastAPI — Handling Errors](https://fastapi.tiangolo.com/tutorial/handling-errors/)
  - Used in: step 3
- **What counts as an edit** — accepting changes the question's row, but it isn't an edit of the question's text, so `updated_at` must not move. This is the same technique as the view counter in Q2.
  - Used in: step 4

## To do

- [ ] **1. Schemas** — in `schemas/question.py`, add `AcceptAnswerIn` (`answer_id: UUID | None`) and `AcceptAnswerOut` (`accepted_answer_id: UUID | None`).
- [ ] **2. The route** — add `POST "/{question_id}/accept-answer"` and call `load_owned` on the question, so only the asker gets through.
- [ ] **3. Check the answer** — when `answer_id` isn't null, load that answer:
  - missing, or `answer.question_id != question.id` → **400** `invalid_answer`. The URL is fine; it's the request body that's wrong.
  - not approved → **400** `invalid_answer` with the message "Only an approved answer can be accepted".
- [ ] **4. Save** — run a targeted `update(Question)` that sets `accepted_answer_id` and also sets `updated_at=Question.updated_at` so it doesn't move. Commit, then return the new value.

## Done when

- [ ] As the asker, accepting an approved answer → **200** with `accepted_answer_id` set, and `GET /api/questions/{id}` lists that answer first.
- [ ] Accepting a second answer moves the mark; exactly one answer is accepted.
- [ ] `{"answer_id": null}` → `accepted_answer_id: null`, and the feed's `has_accepted_answer` goes back to `false`.
- [ ] A user who isn't the asker → **403**.
- [ ] A pending answer → **400** `invalid_answer`; an answer from another question → **400** `invalid_answer`.
- [ ] The question's `updated_at` in psql is the same before and after accepting.
