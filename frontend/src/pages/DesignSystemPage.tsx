import { useState, type ReactNode } from "react";

import Avatar from "../components/Avatar";
import BackButton from "../components/BackButton";
import MarkdownBody from "../components/MarkdownBody";
import Modal from "../components/Modal";
import ModerationBanner from "../components/ModerationBanner";
import NavIcon, { ICON_NAMES } from "../components/NavIcon";
import Pager from "../components/Pager";
import PostMeta from "../components/PostMeta";
import {
  EmptyState,
  ErrorState,
  SkeletonRows,
} from "../components/StateBlocks";
import { useToast } from "../contexts/ToastContext";

const COLORS: {
  group: string;
  swatches: [name: string, className: string][];
}[] = [
  {
    group: "Ink (text)",
    swatches: [
      ["ink", "bg-ink"],
      ["ink-soft", "bg-ink-soft"],
      ["ink-muted", "bg-ink-muted"],
      ["ink-faint", "bg-ink-faint"],
      ["ink-ghost", "bg-ink-ghost"],
    ],
  },
  {
    group: "Surfaces and lines",
    swatches: [
      ["canvas", "bg-canvas"],
      ["surface", "bg-surface"],
      ["fill-subtle", "bg-fill-subtle"],
      ["line", "bg-line"],
      ["line3", "bg-line3"],
      ["sidebar", "bg-sidebar"],
    ],
  },
  {
    group: "Accent (brand, actions)",
    swatches: [
      ["accent", "bg-accent"],
      ["accent-dark", "bg-accent-dark"],
      ["accent-line", "bg-accent-line"],
      ["accent-tint", "bg-accent-tint"],
      ["accent-wash", "bg-accent-wash"],
    ],
  },
  {
    group: "AI (assistant features)",
    swatches: [
      ["ai", "bg-ai"],
      ["ai-line", "bg-ai-line"],
      ["ai-tint", "bg-ai-tint"],
      ["ai-wash", "bg-ai-wash"],
    ],
  },
  {
    group: "Status",
    swatches: [
      ["warn", "bg-warn"],
      ["warn-tint", "bg-warn-tint"],
      ["danger", "bg-danger"],
      ["danger-tint", "bg-danger-tint"],
      ["online", "bg-online"],
      ["offline", "bg-offline"],
    ],
  },
];

const TYPE_SCALE: [name: string, className: string, sample: string][] = [
  ["display", "font-display text-display font-bold", "What are you stuck on?"],
  ["heading", "font-display text-heading font-bold", "Ask a question"],
  ["title", "font-display text-title font-semibold", "Recent questions"],
  [
    "title-sm",
    "text-title-sm font-semibold",
    "How do I debounce a search input?",
  ],
  [
    "body-lg",
    "text-body-lg",
    "Question and answer bodies are set in this size.",
  ],
  ["body", "text-body", "Default interface text: buttons, inputs, lists."],
  ["body-sm", "text-body-sm", "Secondary text and compact controls."],
  ["meta", "text-meta text-ink-faint", "asked 2h ago · 40 views"],
  [
    "tag (mono)",
    "font-mono text-tag text-tag-ink",
    "typescript · react · postgresql",
  ],
];

const DEMO_USER = {
  id: "demo",
  username: "ada_lovelace",
  avatar_url: null,
  is_anonymized: false,
};

function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-title font-semibold text-ink">
          {title}
        </h2>
        <p className="ah-lead mt-1">{intro}</p>
      </div>
      {children}
    </section>
  );
}

// One labelled example inside the Components section.
function Example({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="ah-card space-y-3 p-4">
      <h3 className="ah-overline">{name}</h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export default function DesignSystemPage() {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(2);
  const [segment, setSegment] = useState("Newest");

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-12 px-4 py-8 lg:px-10">
      <header>
        <h1 className="font-display text-heading font-bold text-ink">
          Design system
        </h1>
        <p className="ah-lead mt-2">
          The colors, type, icons and components every Knowly page is built
          from.
        </p>
      </header>

      <Section
        title="Colors"
        intro="Named tokens, never raw hex values in components."
      >
        {COLORS.map(({ group, swatches }) => (
          <div key={group}>
            <h3 className="ah-overline mb-2">{group}</h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {swatches.map(([name, className]) => (
                <li key={name}>
                  <div
                    className={`h-14 rounded-btn border border-line ${className}`}
                  />
                  <code className="mt-1 block font-mono text-meta text-ink-muted">
                    {name}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section
        title="Typography"
        intro="Bricolage Grotesque for headings, Inter for text, JetBrains Mono for code and tags."
      >
        <ul className="ah-card divide-y divide-line4">
          {TYPE_SCALE.map(([name, className, sample]) => (
            <li
              key={name}
              className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:gap-6"
            >
              <code className="w-28 shrink-0 font-mono text-meta text-ink-muted">
                {name}
              </code>
              <span className={`min-w-0 break-words text-ink ${className}`}>
                {sample}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Icons"
        intro="One stroke-based set drawn on a 24px grid, used through the NavIcon component."
      >
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {ICON_NAMES.map((name) => (
            <li
              key={name}
              className="ah-card flex flex-col items-center gap-2 p-3 text-ink-soft"
            >
              <NavIcon name={name} size={22} />
              <code className="font-mono text-meta text-ink-muted">{name}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Components" intro="Reusable building blocks, shown live.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Example name="Button">
            <button type="button" className="ah-btn-primary">
              Primary
            </button>
            <button type="button" className="ah-btn-secondary">
              Secondary
            </button>
            <button type="button" className="ah-btn-ghost">
              Ghost
            </button>
            <button type="button" className="ah-btn-ai">
              AI
            </button>
            <button type="button" className="ah-btn-danger">
              Danger
            </button>
            <button type="button" className="ah-btn-primary ah-btn-sm">
              Small
            </button>
            <button type="button" className="ah-btn-primary" disabled>
              Disabled
            </button>
          </Example>

          <Example name="Form field">
            <div className="w-full">
              <label htmlFor="ds-ok" className="ah-label">
                Username
              </label>
              <input
                id="ds-ok"
                className="ah-input"
                placeholder="3–30 letters, numbers, _ or -"
              />
              <p className="ah-help">Shown on your public profile.</p>
            </div>
            <div className="w-full">
              <label htmlFor="ds-bad" className="ah-label">
                Email
              </label>
              <input
                id="ds-bad"
                className="ah-input"
                defaultValue="not-an-email"
                aria-invalid="true"
              />
              <p className="ah-error">Enter a valid email address</p>
            </div>
          </Example>

          <Example name="Tag, pill, badge">
            <span className="ah-tag">typescript</span>
            <span className="ah-pill">Unanswered</span>
            <span className="ah-pill ah-pill-active">Newest</span>
            <span className="ah-status ah-status-accepted">4 answers</span>
            <span className="ah-status ah-status-warn">Pending</span>
            <span className="ah-count">3</span>
            <span className="ah-badge-accepted">Accepted</span>
            <span className="ah-badge-ai">AI</span>
          </Example>

          <Example name="Segmented control">
            <div className="ah-seg" role="group" aria-label="Sort order">
              {["Newest", "Top", "Unanswered"].map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={segment === item}
                  className={`ah-seg-item ${
                    segment === item ? "ah-seg-item-active" : ""
                  }`}
                  onClick={() => setSegment(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </Example>

          <Example name="Avatar">
            <Avatar user={DEMO_USER} size={24} />
            <Avatar user={DEMO_USER} size={40} online />
            <Avatar
              user={{ ...DEMO_USER, username: "grace_hopper" }}
              size={56}
              online={false}
            />
          </Example>

          <Example name="PostMeta">
            <PostMeta
              author={DEMO_USER}
              createdAt="2026-11-01T10:00:00Z"
              updatedAt="2026-11-01T10:00:00Z"
              verb="asked"
            />
          </Example>

          <Example name="Alert and moderation banner">
            <p role="alert" className="ah-alert w-full">
              Invalid email or password
            </p>
            <div className="w-full">
              <ModerationBanner status="pending" kind="question" />
            </div>
          </Example>

          <Example name="Modal and toast">
            <button
              type="button"
              className="ah-btn-secondary"
              onClick={() => setModalOpen(true)}
            >
              Open modal
            </button>
            <button
              type="button"
              className="ah-btn-secondary"
              onClick={() => showToast("Saved")}
            >
              Show toast
            </button>
            <button
              type="button"
              className="ah-btn-secondary"
              onClick={() => showToast("Could not save", "error")}
            >
              Show error toast
            </button>
            <Modal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              title="Delete this answer?"
            >
              <p className="text-body text-ink-soft">This cannot be undone.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="ah-btn-ghost"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ah-btn-danger"
                  onClick={() => setModalOpen(false)}
                >
                  Delete
                </button>
              </div>
            </Modal>
          </Example>

          <Example name="Pager and back button">
            <Pager page={page} totalPages={5} onChange={setPage} />
            <BackButton to="/" label="Back to home" />
          </Example>

          <Example name="Empty and error states">
            <div className="w-full">
              <EmptyState title="No questions yet">
                Be the first to ask one.
              </EmptyState>
            </div>
            <div className="w-full">
              <ErrorState
                message="The server did not respond."
                onRetry={() => showToast("Retried")}
              />
            </div>
          </Example>

          <Example name="Loading skeleton">
            <div className="w-full">
              <SkeletonRows count={2} />
            </div>
          </Example>

          <Example name="Markdown body">
            <div className="w-full">
              <MarkdownBody
                compact
                markdown={
                  "Use **flexbox** and `margin: auto`:\n\n```css\n.parent { display: flex; }\n```"
                }
              />
            </div>
          </Example>
        </div>
      </Section>
    </div>
  );
}
