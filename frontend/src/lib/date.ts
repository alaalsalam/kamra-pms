/** Local calendar helpers for forward-looking (booking / scheduling) date inputs.
 *  Values are `YYYY-MM-DD` in the user's LOCAL timezone — not UTC. `toISOString()`
 *  is UTC and would let Riyadh (+03) roll to "yesterday" before 03:00. */

const pad = (n: number) => String(n).padStart(2, "0")

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function plusDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00")
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** `min` for a forward date input: today, unless the field already holds an earlier
 *  value (an existing record) — then keep that value representable so an edit screen
 *  doesn't blank out a legitimately past date. */
export function dateMin(current?: string | null): string {
  const t = today()
  return current && current < t ? current : t
}

/** `min` for a checkout / end-after-start field: the day after check-in
 *  (no zero-night same-day booking); falls back to today when no start is set. */
export function checkoutMin(checkIn?: string | null): string {
  return checkIn ? plusDays(checkIn, 1) : today()
}

/** now as `YYYY-MM-DDTHH:mm` (local) — the min for a forward datetime-local input. */
export function nowLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** `min` for a forward datetime-local, keeping an already-earlier value representable. */
export function dateTimeMin(current?: string | null): string {
  const n = nowLocal()
  const c = current ? String(current).replace(" ", "T").slice(0, 16) : ""
  return c && c < n ? c : n
}
