import { CheckCircle2, FolderOpen, HelpCircle, type LucideIcon } from "lucide-react"
import { cn } from "../lib/utils"

// Folio lifecycle status — semantic colour + icon + text (never colour alone),
// same vocabulary as reservationCells.tsx. Rendered as a folio-scoped English
// phrase ("Folio open" / …) so the live DOM translator (lib/i18n) localises it
// through distinct ar.ts keys: the shared "Open" key reads «فتح» (a verb),
// wrong for a folio, and can't change without affecting every other screen.
// Reused by FolioView and Billing so both read «مفتوحة».
const FOLIO_STATUS: Record<
  string,
  { icon: LucideIcon; cls: string; label: string }
> = {
  Open: {
    icon: FolderOpen,
    cls: "bg-amber-50 text-amber-700 ring-amber-200",
    label: "Folio open",
  },
  Settled: {
    icon: CheckCircle2,
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    label: "Folio settled",
  },
  Closed: {
    icon: CheckCircle2,
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    label: "Folio closed",
  },
}

/** Semantic folio-status pill: coloured background + ring, lucide icon and a
 *  folio-scoped label. Its visible text is the accessible name. */
export function folioStatusCell(status: unknown) {
  const st = String(status ?? "")
  const m = FOLIO_STATUS[st] ?? {
    icon: HelpCircle,
    cls: "bg-zinc-100 text-zinc-600 ring-zinc-200",
    label: st,
  }
  const Icon = m.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        m.cls,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {m.label}
    </span>
  )
}
