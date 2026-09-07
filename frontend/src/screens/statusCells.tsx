import type { ReactNode } from "react"
import {
  CheckCircle2,
  CheckCheck,
  CircleDot,
  Unlock,
  PackageCheck,
  DoorOpen,
  Lock,
  HelpCircle,
  Mail,
  Archive,
  XCircle,
  Ban,
  Trash2,
  Clock,
  PackageSearch,
  Wrench,
} from "lucide-react"
import { cn } from "../lib/utils"

type Row = Record<string, unknown>

const pill =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1"

const OK = "bg-emerald-50 text-emerald-700 ring-emerald-200"
const BRAND = "bg-brand-50 text-brand-700 ring-brand-200"
const SKY = "bg-sky-50 text-sky-700 ring-sky-200"
const WARN = "bg-amber-50 text-amber-700 ring-amber-200"
const BAD = "bg-rose-50 text-rose-700 ring-rose-200"
const MUTE = "bg-zinc-100 text-zinc-500 ring-zinc-200"

// Cross-doctype lifecycle vocabulary — semantic colour + icon + text (never
// colour alone). Covers Group Booking, Room Block, Lost & Found, Shift
// Handover and Venue Booking statuses; unknown values fall back to a neutral
// pill (never worse than the plain badge it replaces). Text stays raw so the
// DOM translator localises it via existing ar.ts keys.
const STATUS_MAP: Record<string, { icon: typeof CheckCircle2; cls: string }> = {
  Confirmed: { icon: CheckCircle2, cls: OK },
  Completed: { icon: CheckCheck, cls: OK },
  Returned: { icon: PackageCheck, cls: OK },
  Found: { icon: PackageCheck, cls: OK },
  Active: { icon: CircleDot, cls: BRAND },
  Released: { icon: Unlock, cls: SKY },
  Open: { icon: DoorOpen, cls: SKY },
  Tentative: { icon: HelpCircle, cls: SKY },
  Enquiry: { icon: Mail, cls: SKY },
  "In Storage": { icon: Archive, cls: WARN },
  Pending: { icon: Clock, cls: WARN },
  Missing: { icon: PackageSearch, cls: WARN },
  Damaged: { icon: Wrench, cls: WARN },
  Closed: { icon: Lock, cls: MUTE },
  Cancelled: { icon: XCircle, cls: BAD },
  Lost: { icon: Ban, cls: BAD },
  Disposed: { icon: Trash2, cls: BAD },
}

// Factory: returns a render function reading the given field. Lets one cell
// serve columns keyed on `status` or `block_status`.
export function statusCellFor(field: string) {
  return function StatusCell(row: Row): ReactNode {
    const s = String(row[field] ?? "")
    if (!s) return <span className="text-zinc-300">—</span>
    const m = STATUS_MAP[s] ?? { icon: CircleDot, cls: MUTE }
    const Icon = m.icon
    return (
      <span className={cn(pill, m.cls)}>
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {s}
      </span>
    )
  }
}
