import { Link, Navigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'

export default function LandingPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null
  if (user) return <Navigate to="/home" replace />

  return (
    <div className="overflow-x-hidden">
      <section className="mx-auto max-w-[960px] px-4 pt-10 text-center lg:px-10 lg:pt-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-2.5 pr-3.5 text-[13px] font-semibold text-ink-muted">
          <span className="h-2 w-2 rounded-full bg-ai" aria-hidden="true" />
          Streaming AI assistant, built in
        </div>
        <h1 className="mx-auto text-balance font-display text-[40px] font-bold leading-[1.04] tracking-[-0.035em] text-ink-strong sm:text-[52px] lg:text-[64px]">
          Ask better questions. Get answers worth keeping.
        </h1>
        <p className="mx-auto mt-5 max-w-[600px] text-pretty text-[17px] leading-relaxed text-ink-muted lg:mt-6 lg:text-[19px]">
          A community Q&amp;A platform where you post questions, vote on answers, message
          other members, and get help from an AI assistant that knows the thread.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/register" className="ah-btn-primary ah-btn-lg">
            Start asking — it&apos;s free
          </Link>
          <Link to="/login" className="ah-btn-secondary ah-btn-lg">
            Browse questions
          </Link>
        </div>
      </section>

      {/* Static product preview */}
      <section className="px-4 pt-12 lg:px-10 lg:pt-16" aria-hidden="true">
        <div className="mx-auto max-w-[880px] rounded-[18px] border border-line bg-canvas-main p-4 shadow-pop sm:p-7">
          <p className="font-display text-[22px] font-bold tracking-[-0.03em] text-ink sm:text-[28px]">What are you stuck on?</p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-accent bg-surface text-left">
            <p className="px-4 pb-2 pt-4 text-[15px] text-ink sm:px-5 sm:text-base">
              Why does my SSE stream stall behind nginx?
              <span className="ml-0.5 inline-block h-[1.1em] w-px translate-y-[3px] bg-accent" />
            </p>
            <div className="flex justify-end px-4 pb-3.5 sm:px-5">
              <span className="ah-btn-primary ah-btn-sm pointer-events-none">Continue to post</span>
            </div>
            <div className="border-t border-line bg-surface-raised px-4 py-3.5 sm:px-5">
              <p className="ah-overline mb-2">Similar questions</p>
              {[
                { t: 'SSE events arrive all at once behind a reverse proxy', s: '✓ 3 answers', c: 'ah-status-accepted' },
                { t: 'nginx buffers my streaming response', s: '2 answers', c: '' },
                { t: 'EventSource reconnects every 60 seconds', s: 'Unanswered', c: 'ah-status-warn' },
              ].map((row) => (
                <div key={row.t} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate text-body font-medium text-ink">{row.t}</span>
                  <span className={`ah-status ${row.c}`}>{row.s}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 rounded-card border border-accent bg-accent-wash p-4 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body-sm font-semibold text-ink-soft">dev.ali</span>
              <span className="text-meta text-ink-faint">· 2h ago</span>
              <span className="ah-badge-accepted ml-auto">✓ Accepted</span>
            </div>
            <p className="mt-2 text-body leading-relaxed text-ink-soft">
              Turn off <code className="rounded-tag bg-tag px-1 py-0.5 font-mono text-[0.85em]">proxy_buffering</code> for
              the stream location so nginx flushes each event as it arrives.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1160px] grid-cols-1 gap-4 px-4 py-14 md:grid-cols-3 lg:px-10 lg:py-20">
        <Feature
          color="bg-accent"
          title="Vote answers up"
          body="The best answers rise. Question authors mark one accepted, so the resolution is always one glance away."
        />
        <Feature
          color="bg-ai"
          title="AI that reads the thread"
          body="Stuck mid-answer? The assistant streams a reply with full question context — then drop it straight into your draft."
        />
        <Feature
          color="bg-accent"
          title="Friends & messages"
          body="Follow the people whose answers you trust, see who's online, and take the conversation to a direct message."
        />
      </section>
    </div>
  )
}

function Feature({ color, title, body }: { color: string; title: string; body: string }) {
  return (
    <div className="ah-card p-6">
      <span className={`mb-4 block h-2.5 w-2.5 rounded-[3px] ${color}`} aria-hidden="true" />
      <h2 className="ah-h3 mb-1.5">{title}</h2>
      <p className="text-body-md leading-relaxed text-ink-muted">{body}</p>
    </div>
  )
}
