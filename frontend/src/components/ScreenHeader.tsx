import { type ReactNode, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import { myProperties, getCurrentProperty, type PropertyRow } from "../lib/api"
import { cn } from "../lib/utils"

/**
 * A single summary indicator in the screen header (occupancy, arrivals, …).
 * `to` makes the tile a real link — the caller is responsible for only passing
 * a destination the current role can actually open (canAccessPath), so a tile
 * never dead-ends on a permission wall.
 */
export interface HeaderStat {
  key: string
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
  tone?: "brand" | "gold" | "rose" | "sky" | "zinc"
  /** 0–100 progress meter under the value (occupancy). */
  meter?: number
  to?: string
}

const toneText: Record<NonNullable<HeaderStat["tone"]>, string> = {
  brand: "text-brand-600",
  gold: "text-gold-600",
  rose: "text-rose-600",
  sky: "text-sky-700",
  zinc: "text-zinc-400",
}

// myProperties is stable per session; cache the promise so every screen header
// doesn't re-hit the endpoint. Failure degrades to no hotel name, never throws.
let propertiesOnce: Promise<PropertyRow[]> | null = null
const loadProperties = () =>
  (propertiesOnce ??= myProperties().catch(() => []))

/** The current property's display name, or "" until it resolves / on failure. */
function usePropertyName(): string {
  const [name, setName] = useState("")
  useEffect(() => {
    let alive = true
    loadProperties().then((props) => {
      if (!alive) return
      const current = getCurrentProperty()
      setName(props.find((p) => p.name === current)?.property_name ?? "")
    })
    return () => {
      alive = false
    }
  }, [])
  return name
}

function StatTile({ stat }: { stat: HeaderStat }) {
  const Icon = stat.icon
  const tone = stat.tone ?? "brand"
  const inner = (
    <>
      <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-500">
        {Icon && <Icon className={cn("size-3.5", toneText[tone])} aria-hidden />}
        {stat.label}
      </span>
      <span className="mt-1 block text-2xl font-bold leading-none tracking-tight text-zinc-900 tabular-nums">
        {stat.value}
      </span>
      {stat.hint && (
        <span className="mt-1 block text-[11px] font-medium text-zinc-400">
          {stat.hint}
        </span>
      )}
      {typeof stat.meter === "number" && (
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-zinc-200" aria-hidden>
          <span
            className="block h-full rounded-full bg-brand-500"
            style={{ width: `${Math.max(0, Math.min(100, stat.meter))}%` }}
          />
        </span>
      )}
    </>
  )
  const base =
    "flex min-h-[4.75rem] flex-col justify-center rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-start shadow-sm transition"
  if (stat.to)
    return (
      <Link
        to={stat.to}
        className={cn(
          base,
          "hover:border-brand-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        )}
      >
        {inner}
      </Link>
    )
  return <div className={base}>{inner}</div>
}

/**
 * The unified strong header shared by the board screens (Calendar, Tape Chart).
 * Renders the title + hotel/date-range context, an optional date/view control
 * cluster, exactly one primary action, and a responsive row of summary tiles.
 */
export function ScreenHeader({
  title,
  context,
  stats,
  primaryAction,
  nav,
}: {
  title: ReactNode
  /** Extra context beside the hotel name (usually the visible date range). */
  context?: ReactNode
  stats?: HeaderStat[]
  /** Exactly one primary action (omit entirely when the role can't act). */
  primaryAction?: ReactNode
  /** Date navigation / view toggle cluster, shown in the header action area. */
  nav?: ReactNode
}) {
  const hotel = usePropertyName()
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
            {title}
          </h1>
          {(hotel || context) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-zinc-500">
              {hotel && <span className="font-semibold text-zinc-700">{hotel}</span>}
              {hotel && context && <span aria-hidden className="text-zinc-300">·</span>}
              {context}
            </p>
          )}
        </div>
        {(nav || primaryAction) && (
          <div className="flex flex-wrap items-center gap-2">
            {nav}
            {primaryAction}
          </div>
        )}
      </div>
      {stats && stats.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <StatTile key={s.key} stat={s} />
          ))}
        </div>
      )}
    </section>
  )
}
