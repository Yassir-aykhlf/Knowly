# P3 · An author can edit or remove their answer

- **Track:** P "Participating"
- **Depends on:** P2
- **Size:** M

## Goal

`PUT /api/answers/{id}` rewrites your answer; it is screened again, and the asker is told when the edit comes late. `DELETE /api/answers/{id}` removes the answer along with its comments and votes.

## Can you already…?

- Say why servers store times in UTC?
- Explain what an "orphan row" is?

## Concepts to learn

- **Time windows, in UTC** — "was this created more than 300 seconds ago?" compares two timestamps. Storing and comparing them in UTC avoids time-zone and daylight-saving bugs. The rule already lives in `notifications.notify_content_edited`: call it, don't rewrite it.
  - Learn: [Python — Aware and Naive datetime objects](https://docs.python.org/3/library/datetime.html#aware-and-naive-objects)
  - Used in: step 2
- **State transitions** — to readers, a post going from pending to approved is *new*, not edited. Only edits of already-approved content send `content_edited`. Q1's `screening.py` tracks this for you when you pass `editing=True`.
  - Used in: step 2
- **Order of side effects** — tell the asker about the deletion (`content_deleted`) **before** deleting, because afterwards you can no longer look up which question the answer was on. Do it only for approved answers: nobody else ever saw a held one.
  - Used in: step 4
- **Orphan rows and manual cascades** — comments and votes on an answer have no foreign key (see Q4, "Polymorphic links"). Delete them yourself, or they stay behind forever: invisible, but still counted.
  - Learn: [PostgreSQL — Foreign Keys](https://www.postgresql.org/docs/current/tutorial-fk.html)
  - Used in: step 5
- **The missing foreign key** — the model says `questions.accepted_answer_id` is `ON DELETE SET NULL`, but `\d questions` in psql shows that foreign key doesn't exist in the database. Deleting an accepted answer would leave the question pointing at nothing, so clear the pointer yourself.
  - Used in: step 5

## To do

- [ ] **1. Input schema** — append `AnswerUpdate` (`body`, `attachment_ids=[]`) to `schemas/answer.py`.
- [ ] **2. Edit** — add `PUT "/answers/{answer_id}"` to `routers/answers.py`:
  - call `load_owned(db, Answer, answer_id, user, "answer")`, validate the body, load the answer's question, and set the new body;
  - call `screen_and_stage(kind="answer", editing=True, question_id=…, parent_author_id=question.author_id, question_author_id=question.author_id)`;
  - bind the attachments again (stub), commit, and refresh.
- [ ] **3. One-answer view** — write `answer_out(db, answer, viewer)` and return it from the PUT. It gives the answer with its vote total, the viewer's vote, its visible comments (one query) and its attachments (stub).
- [ ] **4. Delete: notify first** — add `DELETE "/answers/{answer_id}"`. Call `load_owned`. If the answer is `approved`, call `notifications.create_notification(...)` with `event_type="content_deleted"` for the question's author.
- [ ] **5. Delete: one transaction** —
  - call `delete_comments_for`, `delete_votes_for` and `files.delete_attachments_for` (stub) for this answer;
  - run an `update(Question)` that clears any `accepted_answer_id` equal to this answer, also setting `updated_at=Question.updated_at` so the question doesn't look edited;
  - delete the answer with a `delete(Answer)` statement, then commit;
  - remove any returned files best-effort, then return 204.

## Done when

- [ ] Editing someone else's answer → **403**; editing your own → **200** with the new body.
- [ ] Editing within 5 minutes of posting → the asker gets no notification.
- [ ] Backdate the answer (`UPDATE answers SET created_at = now() - interval '1 hour' WHERE id='…';`), then edit it → the asker gets `content_edited`.
- [ ] Delete an answer that has 2 comments and 2 votes → **204**, and in psql `SELECT count(*) FROM comments WHERE parent_id='…';` and the same for `votes` (`target_id`) both return 0.
- [ ] Delete the accepted answer → the question's `accepted_answer_id` is `NULL`.
- [ ] Deleting an approved answer notifies the asker with `content_deleted`; deleting a pending one notifies nobody.
