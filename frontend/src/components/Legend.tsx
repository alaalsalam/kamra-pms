import type { LucideIcon } from "lucide-react"
import { cn } from "../lib/utils"

export interface LegendItem {
  /** Tailwind bg-* class matching the state's cell/bar fill. */
  swatch?: string
  /** Optional glyph shown with the swatch so state never rides on colour alone. */
  icon?: LucideIcon
  iconClassName?: string
  label: string
}

/**
 * A compact colour key. `swatch` is a Tailwind bg-* class matching the state's
 * cell/bar fill; `icon` adds a shape so the state reads without colour vision.
 * Labels are English source strings the live translator localises.
 */
export function Legend({
  items,
  className = "",
}: {
  items: LegendItem[]
  className?: string
}) {
  return (
    <ul
      className={"flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500 " + className}
      aria-label="Colour key"
    >
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          {it.swatch && (
            <span
              className={"size-3 shrink-0 rounded-sm ring-1 ring-inset ring-zinc-300 " + it.swatch}
              aria-hidden
            />
          )}
          {it.icon && (
            <it.icon className={cn("size-3.5 shrink-0", it.iconClassName)} aria-hidden />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  )
}
