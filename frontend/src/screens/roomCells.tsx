import type { ReactNode } from "react"
import {
  Sparkles,
  Brush,
  BadgeCheck,
  DoorOpen,
  DoorClosed,
  Wrench,
  BedDouble,
} from "lucide-react"
import { cn } from "../lib/utils"

type Row = Record<string, unknown>

const pill = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1"

// Housekeeping readiness — semantic colour + icon + text (never colour alone).
const HK: Record<string, { icon: typeof Sparkles; cls: string }> = {
  Ready: { icon: DoorOpen, cls: "bg-brand-50 text-brand-700 ring-brand-200" },
  Clean: { icon: Sparkles, cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  Inspected: { icon: BadgeCheck, cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  Dirty: { icon: Brush, cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  "Out of Order": { icon: Wrench, cls: "bg-rose-50 text-rose-700 ring-rose-200" },
}

export function roomHkStatusCell(row: Row): ReactNode {
  const s = String(row.housekeeping_status ?? "")
  const m = HK[s] ?? { icon: DoorClosed, cls: "bg-zinc-100 text-zinc-600 ring-zinc-200" }
  const Icon = m.icon
  return (
    <span className={cn(pill, m.cls)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {s}
    </span>
  )
}

const OCC: Record<string, { icon: typeof BedDouble; cls: string }> = {
  Occupied: { icon: BedDouble, cls: "bg-brand-600/10 text-brand-700 ring-brand-200" },
  Vacant: { icon: DoorClosed, cls: "bg-zinc-100 text-zinc-500 ring-zinc-200" },
}

export function roomOccupancyCell(row: Row): ReactNode {
  const s = String(row.occupancy_status ?? "")
  const m = OCC[s] ?? OCC.Vacant
  const Icon = m.icon
  return (
    <span className={cn(pill, m.cls)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {s}
    </span>
  )
}
