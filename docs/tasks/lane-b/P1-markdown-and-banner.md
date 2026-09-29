# P1 · Post bodies render as formatted, safe text

- **Track:** P "Participating"
- **Depends on:** 00
- **Unblocks:** Q7
- **Size:** M

## Goal

Two small shared components:

- `<MarkdownBody markdown>` turns stored Markdown into safe HTML.
- `<ModerationBanner status note>` tells an author that their post is held for review or was rejected.

## Can you already…?

- Write `**bold**` and a link in Markdown?
- Say what a `<script>` tag inside a web page does?
- Write a React component that takes props?

## Concepts to learn

- **Markdown → tree → HTML** — a parser turns the text into a tree of nodes (heading, paragraph, link…) called an *AST*, and a renderer turns that tree into HTML. Filtering out anything unsafe happens on the tree.
  - Learn: [CommonMark — Markdown help](https://commonmark.org/help/), [Wikipedia — Abstract syntax tree](https://en.wikipedia.org/wiki/Abstract_syntax_tree) (intro)
  - Used in: step 1
- **XSS (cross-site scripting)** — if a post's text were inserted as raw HTML, `<img src=x onerror="…">` would run its script in *every reader's* browser, logged in as that reader.
  - Learn: [OWASP — Cross Site Scripting (XSS)](https://owasp.org/www-community/attacks/xss/)
  - Used in: steps 1 and 4
- **Sanitizing with an allow-list** — keep only the tags and attributes you know are safe, and drop everything else. An allow-list beats a block-list because tricks nobody thought of are blocked by default. Links count too: a `javascript:` link runs code when clicked.
  - Used in: steps 1 and 2
- **Props and conditional rendering** — a component shows different things depending on its props, or nothing at all (`return null`).
  - Learn: [react.dev — Passing Props](https://react.dev/learn/passing-props-to-a-component), [react.dev — Conditional Rendering](https://react.dev/learn/conditional-rendering)
  - Used in: step 3
- **Testing in isolation** — build a throwaway page that renders the component with hostile inputs, look at the result, then delete the page.
  - Used in: step 4

## To do

- [ ] **1. MarkdownBody** — in `frontend/src/components/MarkdownBody.tsx`, render the `markdown` prop with `ReactMarkdown` and `rehypePlugins={[rehypeSanitize]}`. Both libraries are already in `package.json`.
  - Never use `dangerouslySetInnerHTML`.
- [ ] **2. Safe links, images, spacing** — pass custom renderers for two elements:
  - `a`: links starting with `http(s)://` open in a new tab with `rel="noopener noreferrer nofollow"`;
  - `img`: loads lazily and never grows wider than its container.
  - Give lists, code blocks and quotes readable spacing with Tailwind classes.
- [ ] **3. ModerationBanner** — in `frontend/src/components/ModerationBanner.tsx`, take the props `status`, `note`, `kind` (`question`, `answer` or `comment`) and `compact`.
  - Render nothing unless the status is `pending` or `rejected`.
  - Pending: amber, "Your {kind} is held for review. Only you can see it."
  - Rejected: red, "Your {kind} was rejected by a moderator."
  - If there's a `note`, show "Reason: {note}" on its own line.
- [ ] **4. Scratch test** — `frontend/src/pages/QuestionDetailPage.tsx` is still a placeholder, and it's your file for P6. Temporarily render both components there, giving `MarkdownBody` a string that contains:
  - a heading, a list, a fenced code block and `**bold**`;
  - `[ok](https://example.com)` and `[bad](javascript:alert(1))`;
  - `<img src=x onerror="alert('xss')">` and `<script>alert(1)</script>`;
  - `![img](/api/files/abc)`.
  - Open `/questions/anything` to see it. Undo the page with `git checkout frontend/src/pages/QuestionDetailPage.tsx` before you commit.

## Done when

- [ ] `docker-compose up -d --build frontend` succeeds.
- [ ] **XSS check.** This must pass before the ticket is done:
  - no alert pops up;
  - in the browser devtools → Elements, there is no `<script>` and no `img[src=x]`;
  - the `bad` link has no `href`.
- [ ] The heading, list, code block, bold text and safe link all render properly.
- [ ] The banner appears for `pending` and `rejected` (with the reason), and nothing appears for `approved`.
- [ ] You've told your partner once this is merged, because Q7 is waiting on it.
