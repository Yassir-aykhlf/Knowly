import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'

export default function LandingPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null
  if (user) return <Navigate to="/home" replace />

  return (
    <div className="-mx-6 -my-10 md:-mx-10">
      <section className="px-6 pt-12 text-center md:px-10">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-2 pr-3.5 text-[13px] font-semibold text-ink-muted">
          Streaming AI assistant, built in
        </div>
        <h1 className="mx-auto max-w-[880px] text-balance font-display text-[clamp(2.5rem,6vw,4rem)] font-bold leading-[1.04] tracking-[-0.035em] text-ink-strong">
          Ask better questions. Get answers worth keeping.
        </h1>
        <p className="mx-auto mt-6 max-w-[600px] text-pretty text-[19px] leading-relaxed text-ink-muted">
          A community Q&amp;A platform where you post questions, vote on answers, message
          other members, and get help from an AI assistant that knows the thread.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/register" className="ah-btn-primary px-6 py-3.5 text-base">
            Start asking — it&apos;s free
          </Link>
          <Link to="/login" className="ah-btn-secondary px-6 py-3.5 text-base">
            Browse questions
          </Link>
        </div>
      </section>

      <section className="px-6 pt-14 md:px-10">
        <div className="mx-auto max-w-[920px] overflow-hidden rounded-[18px] border border-line bg-surface shadow-pop">
          <div className="flex items-center gap-2 border-b border-line2 px-4 py-3">
            <span className="h-[11px] w-[11px] rounded-full bg-[#e6635c]" />
            <span className="h-[11px] w-[11px] rounded-full bg-[#e8b65a]" />
            <span className="h-[11px] w-[11px] rounded-full bg-[#5fb87a]" />
          </div>
          <div className="flex">
            <div className="hidden w-[200px] shrink-0 flex-col gap-0.5 border-r border-line2 p-4 sm:flex">
              {[
                { l: 'Questions', c: 'bg-accent', active: true },
                { l: 'AI Assistant', c: 'bg-ai' },
                { l: 'Messages', c: 'bg-[#c2c9c5]' },
                { l: 'Friends', c: 'bg-[#c2c9c5]' },
              ].map((i) => (
                <div
                  key={i.l}
                  className={`flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] font-${
                    i.active ? 'semibold' : 'medium'
                  } ${i.active ? 'bg-accent-tint text-accent' : 'text-ink-muted'}`}
                >
                  <span className={`h-[7px] w-[7px] rounded-sm ${i.c}`} />
                  {i.l}
                </div>
              ))}
            </div>
            <div className="flex-1 p-5">
              <div className="mb-2.5 flex gap-3.5 rounded-[12px] border border-line2 p-4">
                <div className="flex flex-col items-center gap-0.5 text-accent">
                  <span className="text-[17px] font-bold">34</span>
                  <span className="text-[10.5px] uppercase tracking-wide text-ink-ghost">votes</span>
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-ink">
                    Why does my SSE stream stall behind nginx?
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <span className="ah-tag">nginx</span>
                    <span className="ah-tag">sse</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3.5 rounded-[12px] border border-line2 p-4 opacity-60">
                <div className="flex flex-col items-center gap-0.5 text-ink-faint">
                  <span className="text-[17px] font-bold">27</span>
                  <span className="text-[10.5px] uppercase tracking-wide text-ink-ghost">votes</span>
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-ink">
                    How do I cancel an in-flight fetch()?
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <span className="ah-tag">fetch</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 px-6 py-16 md:grid-cols-3 md:px-10">
        <Feature
          tint="bg-accent-tint"
          stroke="#0d9488"
          title="Vote answers up"
          body="The best answers rise. Question authors mark one accepted, so the resolution is always one glance away."
          icon={<><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /><path d="M5 21h14" /></>}
        />
        <Feature
          tint="bg-ai-tint"
          stroke="#5b5bd6"
          title="AI that reads the thread"
          body="Stuck mid-answer? The assistant streams a reply with full question context — then drop it straight into your draft."
          icon={<path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />}
        />
        <Feature
          tint="bg-accent-tint"
          stroke="#0d9488"
          title="Friends & messages"
          body="Follow the people whose answers you trust, see who's online, and take the conversation to a direct message."
          icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>}
        />
      </section>
    </div>
  )
}

function Feature({
  tint,
  stroke,
  title,
  body,
  icon,
}: {
  tint: string
  stroke: string
  title: string
  body: string
  icon: ReactNode
}) {
  return (
    <div className="ah-card p-6">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-[11px] ${tint}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {icon}
        </svg>
      </div>
      <h3 className="mb-1.5 font-display text-[19px] font-semibold tracking-[-0.02em]">{title}</h3>
      <p className="text-[14.5px] leading-relaxed text-ink-muted">{body}</p>
    </div>
  )
}