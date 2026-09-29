# Q7 · A user can write and edit a question in a form

- **Track:** Q "Asking"
- **Depends on:** Q4, and **P1 merged**
- **Unblocks:** P6
- **Size:** L

## Goal

`/ask` posts a new question, and `/questions/:id/edit` loads your question and saves your changes. Both check your input as you type, and still show whatever the server rejects.

## Can you already…?

- Explain what `onChange` does on an input?
- Say why checking input in the browser isn't enough?

## Concepts to learn

- **Controlled input** — the input displays what's in state, and every keystroke updates that state, so state is the single source of truth.
  - Learn: [react.dev — `<input>`](https://react.dev/reference/react-dom/components/input), the section "Controlling an input with a state variable"
  - Used in: step 2
- **Keyboard events** — `onKeyDown` gives you `e.key` (`"Enter"`, `","`, `"Backspace"`). `e.preventDefault()` stops the browser's default action, which here would submit the form.
  - Learn: [MDN — KeyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key)
  - Used in: step 4
- **Defense in depth** — the browser checks input for instant feedback; the server checks it again because anyone can bypass the browser. Keeping the same limits in two places is a risk: if they drift apart, users get errors they can't make sense of.
  - Learn: [OWASP — Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) (intro)
  - Used in: steps 1 and 3
- **Route parameters: one component, two modes** — `/questions/:id/edit` provides `id` through `useParams`. With an id, the page is in edit mode (load the question, send a `PUT`); without one, it's in create mode (send a `POST`).
  - Learn: in the [React Router docs](https://reactrouter.com/), pick v6, then Hooks → `useParams` and `useNavigate`
  - Used in: step 5
- **Reuse** — the Markdown preview is P1's `MarkdownBody`, and the notice about held or rejected content is P1's `ModerationBanner`.
  - Used in: step 7

## To do

- [ ] **1. Validation helpers** — in `frontend/src/lib/validation.ts`, add constants for the limits (title 10–200, body 30–30 000, at most 5 tags of 2–30 characters) and `validateTitle`, `validateBody` and `validateTag`. Each returns an error message or `null`.
  - Add a comment saying these mirror `backend/app/services/questions.py`.
  - P6 imports `validateBody` and `BODY_MAX`.
- [ ] **2. Create mode** — in `frontend/src/pages/AskPage.tsx`, add controlled title and body inputs. On submit, call `api.post('/questions', {title, body, tags, attachment_ids})`, then `navigate` to the new question's page.
- [ ] **3. Errors** — show a field's client-side error once the user has left that field ("touched"). When the server answers 400, show `err.fields.<name>` under the matching input.
- [ ] **4. Tag chips** —
  - Enter or comma adds the typed tag, if it's valid and there are fewer than 5;
  - Backspace in the empty input removes the last chip, and × removes one chip;
  - the input is disabled once there are 5 tags.
- [ ] **5. Edit mode** —
  - in `App.tsx`, add `<Route path="questions/:id/edit" element={<AskPage />} />` next to the question route;
  - when there's an `id`, load the question, fill in the fields, and submit with `api.put`;
  - if the viewer isn't the author, show a short message instead of the form.
- [ ] **6. Attachments slot** — mount `<FileUpload onUploaded>` and `<AttachmentList>` from `components/`. Lane D will build them; for now they render nothing. Keep a list of attachments and send their ids, which means `[]` for now.
- [ ] **7. Preview and banner** — add a Write / Preview toggle that renders the body with `MarkdownBody`. In edit mode, show `ModerationBanner` with the question's status and note.

## Done when

- [ ] `docker-compose up -d --build frontend` succeeds.
- [ ] Posting a valid question from `/ask` takes you to its page.
- [ ] A 9-character title shows its error before you submit.
- [ ] A sixth tag is refused; Backspace removes a chip.
- [ ] In the browser devtools → Network tab, the request body contains `"attachment_ids": []`.
- [ ] If a body over 30 000 characters gets past the browser, the server's message appears under the body field. (Check what the server returns with `/api/docs`.)
- [ ] `/questions/<id>/edit` opens with the fields filled in, and saving takes you back to the question with your changes.
- [ ] In psql, set your question to `rejected` with a note, then open its edit page → a red banner shows the reason. Save → the question is `approved` again.
