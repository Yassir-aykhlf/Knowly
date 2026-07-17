// A stand-in shown wherever a real page/component hasn't been built yet.
// Teammates replace these as they implement their lane.
export default function Placeholder({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        Knowly · Launch Pad
      </p>
      <h1 className="mt-2 text-xl font-semibold">{name}</h1>
      <p className="mt-2 text-sm text-slate-500">
        This screen isn&apos;t built yet — it&apos;s a placeholder from Phase 1.
      </p>
    </div>
  )
}
