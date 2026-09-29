# P4 · Short comments on questions and on answers

- **Track:** P "Participating"
- **Depends on:** P2
- **Size:** M

## Goal

One set of endpoints, `POST /api/comments` plus `PUT` and `DELETE /api/comments/{id}`, handles comments on questions *and* on answers.

## Can you already…?

- Explain why letting the client choose a database table is dangerous?
- Follow a chain of pointers, and stop cleanly when one of them is missing?

## Concepts to learn

- **Polymorphic parent** — a comment's parent is the pair `(parent_type, parent_id)`, such as "question 42" or "answer 7". This is flexible, but the database can't check it (see Q4), so your code has to.
  - Learn: [SQLAlchemy — Generic Associations example](https://docs.sqlalchemy.org/en/20/orm/examples.html#module-examples.generic_associations) (intro only)
  - Used in: step 3
- **Allow-listing input** — `parent_type` comes from the client and decides which table you read. Accept exactly `"question"` or `"answer"` (Pydantic `Literal`). Anything else must be a 400, never a crash.
  - Learn: [Pydantic — Models](https://docs.pydantic.dev/latest/concepts/models/)
  - Used in: step 1
- **Walking a chain** — to find who to notify, follow comment → answer → question. Any link may have been deleted in the meantime; treat a missing link as "notify nobody", not as a crash. `content.question_context` returns the ids, or `None`.
  - Used in: steps 5 and 6
- **Different events go to different people** — `comment_created` goes to the author of the *parent* (the person who answered, for a comment on an answer). `content_edited` and `content_deleted` go to the author of the *question*.
  - Used in: steps 4–6

## To do

- [ ] **1. Input schemas** — append to `schemas/comment.py`:
  - `CommentCreate`: `parent_type: Literal["question", "answer"]`, `parent_id`, `body`;
  - `CommentUpdate`: `body`.
- [ ] **2. Body check** — in `routers/comments.py` (prefix `/comments`), trim the body; it must then be 1–1000 characters, or you return a 400 with `fields.body`.
- [ ] **3. Resolve the parent** — write `_resolve_parent(db, parent_type, parent_id, user)`:
  - pick the model from a dict: `{"question": Question, "answer": Answer}`;
  - load the row, and raise 404 "Parent content not found" unless `can_view` allows it;
  - for an answer, its question must be viewable too.
- [ ] **4. Create** — `POST ""` with status 201: insert the comment, call `screen_and_stage(kind="comment", obj=comment, text=body, question_id=…, parent_author_id=parent.author_id)`, commit, refresh the comment and its author, and return a `CommentOut`.
- [ ] **5. Edit** — `PUT "/{comment_id}"`:
  - call `load_owned`, then validate the body;
  - call `question_context(db, comment.parent_type, comment.parent_id)`, which returns `(question_id, question_author_id, parent_author_id)`, or `None` if the chain is broken;
  - screen again with `editing=True`, passing those ids (or `None`). With no question id, the wrapper stages nothing; Q1 built that early return.
- [ ] **6. Delete** — `DELETE "/{comment_id}"`: if the comment is approved and the chain still exists, send `content_deleted` to the question's author. Then delete and return 204.
- [ ] **7. Mount** — add the router to `main.py`.

## Done when

- [ ] Commenting on a question and on an answer both → **201**, each echoing the correct `parent_type`, and each appears in the right place in `GET /api/questions/{id}`.
- [ ] `parent_type: "banana"` → **400** (not 500); an empty body → **400**; a body of 1 001 characters → **400**.
- [ ] A random `parent_id` → **404**.
- [ ] Editing your own comment → **200** with the new body; deleting it → **204**.
- [ ] Someone else's comment → **403** on both PUT and DELETE.
- [ ] A comment on someone's answer notifies *the person who answered* (`comment_created`). Deleting that comment notifies *the asker* (`content_deleted`).
- [ ] Create an orphan in psql: `INSERT INTO comments (id, author_id, parent_type, parent_id, body) VALUES (gen_random_uuid(), '<your user id>', 'answer', gen_random_uuid(), 'orphan');`. Editing it → **200**, with no crash and no notification.
