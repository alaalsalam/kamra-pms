/**
 * A compact colour key. `swatch` is a Tailwind bg-* class matching the state's
 * cell/bar fill; labels are English source strings the live translator localises.
 */
export function Legend({
  items,
  className = "",
}: {
  items: { swatch: string; label: string }[]
  className?: string
}) {
  return (
    <ul
      className={"flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500 " + className}
      aria-label="Colour key"
    >
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          <span
            className={"size-3 shrink-0 rounded-sm ring-1 ring-inset ring-zinc-300 " + it.swatch}
            aria-hidden
          />
          {it.label}
        </li>
      ))}
    </ul>
  )
}
