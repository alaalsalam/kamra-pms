import { Badge } from "../components/ui/badge"
import { Avatar } from "../components/ui/avatar"
import { cur, moneyLocale, dateLocale } from "../lib/money"
import { cn } from "../lib/utils"
import {
  CheckCircle2,
  LogIn,
  LogOut,
  XCircle,
  Ban,
  Clock,
  CreditCard,
  HelpCircle,
} from "lucide-react"

// Composite cell renderers for the Oasis reservations table. Kept in a .tsx
// file so configs.ts stays plain data; each reads the whole row.
type Row = Record<string, unknown>
const s = (v: unknown) => (v == null ? "" : String(v))
const money = (v: unknown) =>
  Number(v ?? 0).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })
const shortDate = (iso: string) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString(dateLocale(), {
        day: "numeric",
        month: "short",
      })
    : "—"

export function guestCell(row: Row) {
  const guest = s(row.guest_name) || s(row.name)
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={guest} />
      <div className="min-w-0">
        <div className="truncate font-semibold text-zinc-900">{guest}</div>
        <div className="truncate text-[11px] text-zinc-400">
          <bdi dir="ltr">{s(row.name)}</bdi> · {s(row.source) || "—"}
        </div>
      </div>
    </div>
  )
}

export function stayCell(row: Row) {
  const ci = s(row.check_in_date)
  const co = s(row.check_out_date)
  const nights =
    ci && co
      ? Math.max(
          0,
          Math.round(
            (new Date(co + "T00:00:00").getTime() -
              new Date(ci + "T00:00:00").getTime()) /
              86_400_000,
          ),
        )
      : 0
  return (
    <span className="whitespace-nowrap text-zinc-700">
      <bdi dir="ltr" className="font-semibold tabular-nums">
        {shortDate(ci)} → {shortDate(co)}
      </bdi>{" "}
      <span className="text-zinc-400 tabular-nums">· {nights}n</span>
    </span>
  )
}

export function roomCell(row: Row) {
  if (!row.room) return <Badge tone="amber">No room</Badge>
  return (
    <bdi dir="ltr" className="font-semibold tabular-nums text-zinc-800">
      {s(row.room).split("-").pop()}
    </bdi>
  )
}

export function balanceCell(row: Row) {
  const bal = Math.max(
    0,
    Number(row.amount_after_tax ?? 0) - Number(row.advance_paid ?? 0),
  )
  return (
    <span
      className={
        "tabular-nums font-semibold " +
        (bal > 0 ? "text-gold-700" : "text-zinc-400")
      }
    >
      {cur()}
      {money(bal)}
    </span>
  )
}

// Reservation lifecycle status — semantic colour + icon + text (never colour
// alone). Status text stays observer-translated via existing ar.ts keys.
const RES_STATUS: Record<string, { icon: typeof CheckCircle2; cls: string }> = {
  Confirmed: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  "Checked In": { icon: LogIn, cls: "bg-brand-50 text-brand-700 ring-brand-200" },
  "Checked Out": { icon: LogOut, cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  "Pending Payment": { icon: CreditCard, cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  Waitlist: { icon: Clock, cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  Tentative: { icon: HelpCircle, cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  Cancelled: { icon: XCircle, cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  "No Show": { icon: Ban, cls: "bg-rose-50 text-rose-700 ring-rose-200" },
}

export function reservationStatusCell(row: Row) {
  const st = s(row.status)
  const m = RES_STATUS[st] ?? { icon: HelpCircle, cls: "bg-zinc-100 text-zinc-600 ring-zinc-200" }
  const Icon = m.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        m.cls,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {st}
    </span>
  )
}
