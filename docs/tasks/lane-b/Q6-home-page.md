# Q6 · The home page shows a browsable feed

- **Track:** Q "Asking"
- **Depends on:** Q3
- **Size:** M

## Goal

`/home` lists questions with Newest / Votes / Unanswered tabs and page buttons, and the URL remembers which view you're on.

## Can you already…?

- Write a function that returns HTML-like JSX?
- Explain `async` / `await`?
- Say what the `?sort=votes&page=2` part of a URL is?

## Concepts to learn

- **Single-page app (SPA)** — the browser downloads the app once. From then on, React swaps what's on screen and talks to `/api` with `fetch`.
  - Learn: [react.dev — Quick Start](https://react.dev/learn)
  - Used in: all steps
- **Components, props and state** — a component is a function that returns UI. *Props* are its read-only inputs. *State* is its memory, and changing state redraws the component.
  - Learn: [Your First Component](https://react.dev/learn/your-first-component), [Passing Props](https://react.dev/learn/passing-props-to-a-component), [State: A Component's Memory](https://react.dev/learn/state-a-components-memory)
  - Used in: steps 1–3
- **Effects and async fetching** — `useEffect` runs code after a render (here: fetch the page). The request takes time, so the screen has to show something while it waits.
  - Learn: [MDN — How to use promises](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Promises), [react.dev — Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
  - Used in: step 2
- **The UI as a state machine** — at any moment the page is in exactly one of four states: loading, error, empty or data. Draw them before you code.
  - Learn: [react.dev — Reacting to Input with State](https://react.dev/learn/reacting-to-input-with-state)
  - Used in: step 5
- **List keys** — every item in a rendered list needs a stable `key` (the question's id), so React can tell the items apart.
  - Learn: [react.dev — Rendering Lists](https://react.dev/learn/rendering-lists)
  - Used in: step 2
- **The URL as state** — keep `sort` and `page` in the query string rather than only in memory, so that reloading, the back button and shared links all work.
  - Learn: [MDN — URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams), and in the [React Router docs](https://reactrouter.com/), pick v6, then Hooks → `useSearchParams`
  - Used in: step 4
- **Types as a contract** — `Paginated<QuestionListItem>` in `lib/types.ts` describes exactly what Q3 returns, so TypeScript catches a misspelled field when you build.
  - Learn: [TypeScript — Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) (object types)
  - Used in: step 2

## To do

- [ ] **1. The card** — `frontend/src/components/QuestionCard.tsx` takes one `QuestionListItem` and shows:
  - the title, linking to `/questions/:id`;
  - the excerpt and the tags;
  - the author with `Avatar` and their name;
  - votes, answers and views, with answers highlighted when `has_accepted_answer` is true;
  - the age from `relativeTime(created_at)` in `lib/format.ts`.
  - Lane A's profile page will reuse this card.
- [ ] **2. The list** — in `frontend/src/pages/HomePage.tsx`, fetch `GET /questions?sort=…&page=…&limit=20` with `api.get` from `lib/api.ts` and render the cards. `pages/NotificationsPage.tsx` (Lane C) is a working example of a paginated list.
- [ ] **3. Tabs** — add three buttons. Clicking one sets `sort` and resets `page` to 1.
- [ ] **4. URL state** — keep `sort` and `page` in the URL with `useSearchParams`. Unknown values fall back to `newest` and `1`.
- [ ] **5. The four states** —
  - loading: "Loading…";
  - error: the message plus a Retry button;
  - empty: a friendly message plus a link to `/ask`;
  - data: the list plus Previous / Next buttons, disabled at either end.
- [ ] **6. Call to action** — an "Ask a question" link to `/ask` at the top.

## Done when

- [ ] `docker-compose up -d --build frontend` succeeds; it runs the TypeScript check.
- [ ] `/home` shows the questions, newest first, and each card links to its question.
- [ ] Clicking "Votes" changes the order **and** the URL. Reloading keeps the same view, and the browser's Back button returns to the previous one.
- [ ] Moving to page 2 keeps the chosen sort.
- [ ] With no questions → the empty message, not a blank page.
- [ ] After `docker-compose stop backend` → the error message; after `docker-compose start backend`, Retry works.
- [ ] The browser console shows no errors or warnings.
