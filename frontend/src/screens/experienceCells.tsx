import { Badge } from "../components/ui/badge"
import { fmtMoney } from "../lib/money"

// Composite cell renderers for the Experiences list. Kept in a .tsx file so
// configs.ts stays plain data; each reads the whole row.
type Row = Record<string, unknown>

export function experiencePriceCell(row: Row) {
  const price = Number(row.price ?? 0)
  if (!price) return <span className="text-zinc-400">On request</span>
  return (
    <bdi dir="ltr" className="tabular-nums">
      {fmtMoney(price)}
    </bdi>
  )
}

export function bookingPageCell(row: Row) {
  return Number(row.show_on_booking_page) ? (
    <Badge tone="green">On booking page</Badge>
  ) : (
    <span className="text-zinc-400">Hidden</span>
  )
}

export function experienceStatusCell(row: Row) {
  return Number(row.disabled) ? (
    <Badge tone="zinc">Disabled</Badge>
  ) : (
    <Badge tone="green">Active</Badge>
  )
}
