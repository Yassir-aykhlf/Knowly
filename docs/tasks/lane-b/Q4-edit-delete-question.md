# Q4 · An author can edit or withdraw their question

- **Track:** Q "Asking"
- **Depends on:** Q2
- **Size:** M

## Goal

`PUT /api/questions/{id}` rewrites your own question and screens it again. `DELETE /api/questions/{id}` removes it, along with everything attached to it.

## Can you already…?

- Tell authentication apart from authorization?
- Say what `ON DELETE CASCADE` does?
- Explain why a bank transfer must be a single transaction?

## Concepts to learn

- **Authentication vs authorization** — *who are you?* (401 if unknown) vs *are you allowed to?* (403 if not). `content.load_owned` handles both for you: 404 if you can't see the post, 403 if it isn't yours.
  - Learn: [OWASP Top 10 — A01 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) (intro)
  - Used in: steps 1 and 4
- **Idempotent methods** — doing a PUT or a DELETE twice leaves the same end state as doing it once. The second DELETE returns 404, but nothing more is lost.
  - Learn: [MDN — Idempotent](https://developer.mozilla.org/en-US/docs/Glossary/Idempotent)
  - Used in: steps 1 and 4
- **Foreign keys and cascades** — a foreign key forbids pointing at a row that doesn't exist. `ON DELETE CASCADE` deletes the children along with their parent; `SET NULL` blanks the pointer instead.
  - Learn: [PostgreSQL — Foreign Keys](https://www.postgresql.org/docs/current/tutorial-fk.html), [PostgreSQL — Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) (the foreign-key section)
  - Used in: step 5
- **Polymorphic links** — comments and votes point at "a question *or* an answer" using two columns (`parent_type` + `parent_id`, or `target_type` + `target_id`). No foreign key can express that, so the database can't cascade them for you. Your code must.
  - Used in: step 5
- **Atomicity and side effects** — do every delete in one transaction, so that if one fails, none of them happened. Files on disk aren't part of the transaction, so delete them only **after** the commit succeeds.
  - Learn: [PostgreSQL — Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
  - Used in: steps 5 and 6

## To do

- [ ] **1. Edit: load and validate** — add `PUT "/{question_id}"`. Call `load_owned(db, Question, question_id, user, "question")`, run the same `clean_question_fields` as Q1, and assign the new values.
- [ ] **2. Edit: screen again** — call `screen_and_stage(..., editing=True, question_author_id=question.author_id)`. The new verdict replaces the old status; that's how a held question gets fixed and published again.
- [ ] **3. Edit: finish** — bind the attachments again (stub), commit, refresh, and return `build_question_out`.
- [ ] **4. Delete: load, then collect** — add `DELETE "/{question_id}"`. Call `load_owned`, then collect the ids of **all** this question's answers (held ones included) *before* deleting anything. Afterwards they're gone.
- [ ] **5. Delete: one transaction**, in this order:
  - Clear `accepted_answer_id` with a targeted update. The model declares this foreign key `ondelete="SET NULL"`, but `\d questions` in psql shows it doesn't exist in the database (the model marks it `use_alter`, and the migration never created it). Nothing will clear the pointer for you.
  - Call `delete_comments_for` and `delete_votes_for` (in `content.py`) for the question **and** for all its answers.
  - Call `files.delete_attachments_for` for both (a stub that returns `[]`), and keep the returned paths.
  - Delete the question with a `delete(Question).where(...)` statement. Its answers go with it through the real `ON DELETE CASCADE` on `answers.question_id`. (Avoid `db.delete(obj)`, which tries to load relationships in async code.)
  - Commit.
- [ ] **6. Delete: clean up** — after the commit, call `files.delete_file(path)` for each path, each inside its own `try`/`except`. Return `Response(status_code=204)`.

## Done when

- [ ] Editing someone else's question → **403**; editing your own → **200** with the new title, body and tags.
- [ ] Editing with a 5-character title → **400** with `fields.title`.
- [ ] You delete a question that has answers, comments on the question *and* on an answer, votes on both, and an accepted answer → **204**, and in psql `answers`, `comments` and `votes` contain no rows that belonged to it.
- [ ] Deleting the same question again → **404**.
- [ ] (After Lane D ships moderation) editing a held question into clean text makes it `approved` again, and it reappears in the feed.
