import type { ReactNode } from "react"
import {
  Clock,
  CircleDashed,
  CheckCircle2,
  BadgeCheck,
  AlertTriangle,
  ChevronsUp,
  Equal,
  ChevronDown,
} from "lucide-react"
import { cn } from "../lib/utils"

type Row = Record<string, unknown>

const pill =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1"

// Housekeeping task lifecycle — semantic colour + icon + text (never colour
// alone). Text stays raw so the DOM translator localises it via ar.ts.
const TASK_STATUS: Record<string, { icon: typeof Clock; cls: string }> = {
  Pending: { icon: Clock, cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  "In Progress": { icon: CircleDashed, cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  Done: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  Verified: { icon: BadgeCheck, cls: "bg-brand-50 text-brand-700 ring-brand-200" },
}

export function hkStatusCell(row: Row): ReactNode {
  const s = String(row.status ?? "")
  const m = TASK_STATUS[s] ?? {
    icon: Clock,
    cls: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  }
  const Icon = m.icon
  return (
    <span className={cn(pill, m.cls)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {s}
    </span>
  )
}

const PRIORITY: Record<string, { icon: typeof Clock; cls: string }> = {
  Urgent: { icon: AlertTriangle, cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  High: { icon: ChevronsUp, cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  Medium: { icon: Equal, cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  Low: { icon: ChevronDown, cls: "bg-zinc-100 text-zinc-500 ring-zinc-200" },
}

export function hkPriorityCell(row: Row): ReactNode {
  const s = String(row.priority ?? "")
  if (!s) return <span className="text-zinc-300">—</span>
  const m = PRIORITY[s] ?? {
    icon: Equal,
    cls: "bg-zinc-100 text-zinc-500 ring-zinc-200",
  }
  const Icon = m.icon
  return (
    <span className={cn(pill, m.cls)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {s}
    </span>
  )
}
