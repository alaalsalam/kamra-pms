import { useId, type ReactNode } from "react"
import { Link } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import { cn } from "../../lib/utils"

/**
 * Small, dependency-free chart primitives for the analytics dashboard. Every
 * mark is drawn from REAL payload numbers - there are no synthetic trends. The
 * colour vocabulary is the Oasis token set (brand = teal, gold = amber, plus
 * the semantic emerald/sky/rose statuses), so light and dark inherit together.
 * State never rides on colour alone: bars carry visible labels + values, the
 * stacked composition bar is decorative (aria-hidden) with the real figures on
 * adjacent 44px list rows, and the pace line is a labelled role="img" figure.
 */

// ---------------------------------------------------------------------------
// PaceChart - a forward occupancy line. SVG does not mirror under dir="rtl", so
// the index->x mapping is flipped for Arabic (design-system 4: time advances
// right->left). Percentages render LTR; day labels arrive pre-localised.
// ---------------------------------------------------------------------------
export interface PacePoint {
  key: string
  /** Already-localised short weekday. */
  label: string
  /** Occupancy 0..100. */
  pct: number
  /** Accessible per-point description surfaced as a native <title>. */
  caption: string
  today?: boolean
}

export function PaceChart({
  points,
  rtl,
  ariaLabel,
}: {
  points: PacePoint[]
  rtl: boolean
  ariaLabel: string
}) {
  const gid = useId()
  const W = 340
  const H = 152
  const padX = 16
  const padTop = 24
  const padBottom = 30
  const plotW = W - padX * 2
  const plotH = H - padTop - padBottom
  const n = points.length
  const baseline = padTop + plotH
  const xAt = (i: number) => {
    if (n <= 1) return padX + plotW / 2
    const frac = i / (n - 1)
    return padX + plotW * (rtl ? 1 - frac : frac)
  }
  const yAt = (pct: number) =>
    padTop + plotH * (1 - Math.max(0, Math.min(100, pct)) / 100)
  const coords = points.map((p, i) => [xAt(i), yAt(p.pct)] as const)
  const line = coords
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ")
  const area = `${coords[0][0].toFixed(1)},${baseline} ${line} ${coords[
    n - 1
  ][0].toFixed(1)},${baseline}`
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 50, 100].map((g) => {
        const y = yAt(g)
        return (
          <line
            key={g}
            x1={padX}
            x2={W - padX}
            y1={y}
            y2={y}
            className="stroke-zinc-200"
            strokeWidth="1"
            strokeDasharray={g === 0 ? undefined : "3 4"}
          />
        )
      })}
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline
        points={line}
        fill="none"
        stroke="var(--color-brand-600)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => {
        const [x, y] = coords[i]
        return (
          <g key={p.key}>
            <circle
              cx={x}
              cy={y}
              r={p.today ? 4 : 3}
              fill="var(--color-brand-600)"
              stroke="var(--color-card, #fff)"
              strokeWidth="1.5"
            >
              <title>{p.caption}</title>
            </circle>
            <text
              x={x}
              y={y - 9}
              textAnchor="middle"
              style={{ direction: "ltr" }}
              className={cn(
                "text-[9px] font-semibold",
                p.today ? "fill-brand-700" : "fill-zinc-500",
              )}
            >
              {p.pct}%
            </text>
            <text
              x={x}
              y={baseline + 14}
              textAnchor="middle"
              className={cn(
                "text-[9px]",
                p.today ? "fill-brand-700 font-semibold" : "fill-zinc-400",
              )}
            >
              {p.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// CompositionBar - a 100% stacked bar (parts of a whole). Decorative: the real
// counts live on the list rows beside it, so a 2%-wide segment never has to be
// a hit target. Flex divs inherit RTL for free; 2px gaps read as the surface.
// ---------------------------------------------------------------------------
export interface CompositionSegment {
  key: string
  label: string
  value: number
  /** bg-* fill class matching the state's swatch. */
  className: string
}

export function CompositionBar({ segments }: { segments: CompositionSegment[] }) {
  const shown = segments.filter((s) => s.value > 0)
  return (
    <div
      className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full bg-zinc-100"
      aria-hidden
    >
      {shown.map((s) => (
        <span
          key={s.key}
          className={cn("h-full", s.className)}
          style={{ flexGrow: s.value, flexBasis: 0 }}
          title={`${s.label}: ${s.value}`}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// BarList - ranked horizontal bars as a real list. Each row is a >=44px gated
// link / action carrying its own label + value, so magnitude reads at a glance
// and every segment that maps to a screen is reachable by keyboard and touch.
// ---------------------------------------------------------------------------
export interface BarItem {
  key: string
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  /** Fill width 0..100. */
  pct: number
  /** bg-* fill class; defaults to brand (teal). */
  barClassName?: string
  icon?: LucideIcon
  iconClassName?: string
  to?: string
  onClick?: () => void
}

export function BarList({ items }: { items: BarItem[] }) {
  return (
    <ul className="space-y-0.5">
      {items.map((it) => {
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-zinc-700">
                {it.icon && (
                  <it.icon
                    className={cn("size-3.5 shrink-0", it.iconClassName)}
                    aria-hidden
                  />
                )}
                <span className="truncate">{it.label}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900">
                {it.value}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    it.barClassName ?? "bg-brand-500",
                  )}
                  style={{ width: `${Math.max(2, Math.min(100, it.pct))}%` }}
                />
              </span>
              {it.sub && (
                <span className="shrink-0 text-[11px] text-zinc-400">{it.sub}</span>
              )}
            </div>
          </>
        )
        const base = "-mx-2 block min-h-11 rounded-xl px-2 py-2"
        const interactive =
          "group transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
        if (it.to)
          return (
            <li key={it.key}>
              <Link to={it.to} className={cn(base, interactive)}>
                {inner}
              </Link>
            </li>
          )
        if (it.onClick)
          return (
            <li key={it.key}>
              <button
                type="button"
                onClick={it.onClick}
                className={cn(base, "w-full text-start", interactive)}
              >
                {inner}
              </button>
            </li>
          )
        return (
          <li key={it.key}>
            <div className={base}>{inner}</div>
          </li>
        )
      })}
    </ul>
  )
}
