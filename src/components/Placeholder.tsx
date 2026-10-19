interface Props {
  title: string
  day: string
  lines: string[]
}

/** Section stub shown until that section ships. */
export default function Placeholder({ title, day, lines }: Props) {
  return (
    <div className="flex h-full items-start justify-center overflow-y-auto p-6 md:items-center">
      <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{day}</div>
        <h1 className="mb-3 text-xl font-semibold">{title}</h1>
        <ul className="space-y-1.5 text-sm text-[var(--muted)]">
          {lines.map((l) => (
            <li key={l} className="flex gap-2">
              <span className="text-[var(--accent)]">—</span>
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
