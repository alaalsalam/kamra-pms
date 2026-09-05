import type { ComponentType, ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight } from "lucide-react"
import { cn } from "../lib/utils"

/**
 * Oasis "needs your attention now" queue card. Two shapes:
 *  - Link card: pass `to` (+ optional `action` label) — the whole card links.
 *  - Action card: pass `children` (buttons) — rendered in a footer row.
 * Tone drives only the leading icon chip; the card body stays calm (one lead
 * colour per card). amber = money/attention, danger = overdue/error, teal = default.
 */
export function QueueCard({
  icon: Icon,
  title,
  detail,
  tone = "teal",
  to,
  action,
  onClick,
  children,
}: {
  icon: ComponentType<{ className?: string }>
  title: ReactNode
  detail: ReactNode
  tone?: "teal" | "amber" | "danger"
  to?: string
  action?: string
  onClick?: () => void
  children?: ReactNode
}) {
  const chip =
    tone === "amber"
      ? "bg-gold-100 text-gold-700"
      : tone === "danger"
        ? "bg-rose-50 text-rose-700"
        : "bg-brand-50 text-brand-700"

  const head = (
    <>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", chip)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-zinc-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{detail}</span>
      </span>
    </>
  )

  // Action-footer variant (buttons wire real actions like check-in)
  if (children) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">{head}</div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    )
  }

  // Whole-card link variant
  const cls =
    "group flex min-h-24 items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
  const tail = to && (
    <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-700">
      {action}
      <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
    </span>
  )
  if (to) return <Link to={to} className={cls}>{head}{tail}</Link>
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {head}
      </button>
    )
  return <div className={cls}>{head}</div>
}
