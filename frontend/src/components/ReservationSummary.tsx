import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { X, LogIn, LogOut, FileText, PanelRightOpen, Wallet } from "lucide-react"
import { checkOut, call } from "../lib/api"
import { serverError } from "../lib/resource"
import { cur, moneyLocale } from "../lib/money"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Avatar } from "./ui/avatar"
import CheckInDialog from "./CheckInDialog"

type Row = Record<string, unknown>
const s = (v: unknown) => (v == null ? "" : String(v))
const n = (v: unknown) => Number(v ?? 0)
const money = (v: unknown) =>
  n(v).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

// Modes the Folio Payment doctype actually accepts (Mada isn't in its Select
// options yet — it 417s server-side, so it's left out until the backend adds it).
const PAY_MODES = ["Cash", "Card", "Bank Transfer", "Payment Link"]
const payInputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm " +
  "focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"

const STATUS_TONE: Record<string, "green" | "brand" | "amber" | "sky" | "zinc" | "rose"> = {
  Confirmed: "brand",
  "Checked In": "green",
  "Checked Out": "zinc",
  Cancelled: "rose",
  Waitlist: "amber",
  "No Show": "rose",
}

function nightsBetween(a: string, b: string) {
  if (!a || !b) return 0
  return Math.max(
    0,
    Math.round(
      (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) /
        86_400_000,
    ),
  )
}

const MoneySkel = () => (
  <span className="inline-block h-4 w-14 animate-pulse rounded bg-zinc-200 align-middle" />
)

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="min-w-0 text-end font-semibold text-zinc-900">{value}</span>
    </div>
  )
}

/**
 * The reservation glance panel — reads the list row (no extra fetch), shows the
 * scannable stay/payment/status and the primary next action. "Full details"
 * opens the existing rich editing panel unchanged.
 */
export default function ReservationSummary({
  row,
  reload,
  onClose,
  onOpenDetail,
}: {
  row: Row
  reload: () => void
  onClose: () => void
  onOpenDetail: () => void
}) {
  const [checkingIn, setCheckingIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const name = s(row.name)
  const guest = s(row.guest_name) || name
  const status = s(row.status)
  const source = s(row.source) || "—"
  const bookingType = s(row.booking_type)
  const ci = s(row.check_in_date)
  const co = s(row.check_out_date)
  const nights = nightsBetween(ci, co)
  const roomNo = row.room ? s(row.room).split("-").pop() : ""
  const rowTotal = n(row.amount_after_tax)
  const rowPaid = n(row.advance_paid)
  // Drive the figures from the guest folio (room + every charge + payments) once
  // it exists. The reservation's amount_after_tax is room-only, so it diverges the
  // moment extras are posted — which is why "paid" could read higher than "total".
  const [mv, setMv] = useState({
    total: rowTotal,
    paid: rowPaid,
    balance: rowTotal - rowPaid,
    hasFolio: false,
  })
  const due = Math.max(0, mv.balance)
  const credit = Math.max(0, -mv.balance)
  const [loadingMoney, setLoadingMoney] = useState(
    status !== "Cancelled" && status !== "No Show",
  )

  // collect payment on arrival (record_advance opens the folio + posts the money)
  const [payAmount, setPayAmount] = useState(due > 0 ? String(due) : "")
  const [payMode, setPayMode] = useState("Cash")
  const [payRef, setPayRef] = useState("")
  const [collecting, setCollecting] = useState(false)
  const [collectedNow, setCollectedNow] = useState<number | null>(null)
  // live preview: type a deposit (عربون) and see paid/remaining before collecting
  const payNum = Number(payAmount) || 0
  const paidAfter = mv.paid + payNum
  const remAfter = Math.max(0, due - payNum)
  const overpay = Math.max(0, payNum - due)

  const canCollect =
    !loadingMoney &&
    status !== "Cancelled" &&
    status !== "Checked Out" &&
    status !== "No Show" &&
    due > 0

  // pull the real folio balance/total/paid; keep the row-level fallback if none
  async function loadMoney() {
    try {
      const folios = await call<
        {
          folio_type: string
          grand_total: number
          payments_total: number
          balance: number
        }[]
      >("hotelpms.api.reservation_folios", { reservation: name })
      const f = folios.find((x) => x.folio_type === "Guest") ?? folios[0]
      if (f) {
        // the room charge only posts to the folio at check-in, so before then the
        // folio grand_total understates the stay — floor Total at the room total.
        const total = Math.max(rowTotal, n(f.grand_total))
        const paid = n(f.payments_total)
        setMv({ total, paid, balance: total - paid, hasFolio: true })
        const bal = Math.max(0, total - paid)
        setPayAmount(bal > 0 ? String(bal) : "")
      } else {
        // no folio yet (still Confirmed) — the reservation figures are the truth
        setMv({ total: rowTotal, paid: rowPaid, balance: rowTotal - rowPaid, hasFolio: false })
      }
    } catch {
      setMv({ total: rowTotal, paid: rowPaid, balance: rowTotal - rowPaid, hasFolio: false })
    } finally {
      setLoadingMoney(false)
    }
  }

  useEffect(() => {
    if (status !== "Cancelled" && status !== "No Show") loadMoney()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function collect() {
    const amt = Number(payAmount)
    if (!(amt > 0)) return
    setCollecting(true)
    setError(null)
    setCollectedNow(null)
    try {
      await call("hotelpms.api.record_advance", {
        reservation: name,
        amount: amt,
        mode: payMode,
        reference: payRef || undefined,
      })
      setPayRef("")
      setCollectedNow(amt)
      await loadMoney()
      reload()
    } catch (e) {
      setError(serverError(e))
    } finally {
      setCollecting(false)
    }
  }

  async function doCheckOut() {
    if (due > 0.005) {
      // a departing guest must clear their bill first — collect it above
      setError("Settle the outstanding balance before check-out.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await checkOut(name)
      reload()
      onClose()
    } catch (e) {
      setError(serverError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-zinc-100 bg-zinc-50 px-5 py-4">
        <Avatar name={guest} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-zinc-900">{guest}</h3>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            <bdi dir="ltr">{name}</bdi> · {source}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {status && <Badge tone={STATUS_TONE[status] ?? "zinc"}>{status}</Badge>}
            {!row.room && status !== "Checked Out" && status !== "Cancelled" && (
              <Badge tone="amber">No room</Badge>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <dl>
          <KV
            label="Stay"
            value={
              <bdi dir="ltr" className="tabular-nums">
                {ci} → {co} · {nights}n
              </bdi>
            }
          />
          <KV
            label="Room"
            value={
              row.room ? (
                <bdi dir="ltr" className="tabular-nums">{roomNo}</bdi>
              ) : (
                <span className="text-zinc-400">To be assigned</span>
              )
            }
          />
          <KV label="Source" value={source} />
          {bookingType && bookingType !== "Individual" && (
            <KV label="Type" value={bookingType} />
          )}
        </dl>

        <div className="rounded-xl border border-zinc-200 bg-white p-3.5">
          <div className="flex items-center justify-between py-0.5 text-sm">
            <span className="text-zinc-500">Total</span>
            <span className="font-semibold tabular-nums text-zinc-900">
              {loadingMoney ? <MoneySkel /> : <>{cur()}{money(mv.total)}</>}
            </span>
          </div>
          <div className="flex items-center justify-between py-0.5 text-sm">
            <span className="text-zinc-500">Paid</span>
            <span className="font-semibold tabular-nums text-emerald-700">
              {loadingMoney ? <MoneySkel /> : <>{cur()}{money(mv.paid)}</>}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-zinc-100 pt-2 text-sm">
            <span className="font-medium text-zinc-700">Remaining</span>
            <span
              className={
                "text-base font-bold tabular-nums " +
                (due > 0 ? "text-gold-700" : "text-emerald-700")
              }
            >
              {loadingMoney ? <MoneySkel /> : <>{cur()}{money(due)}</>}
            </span>
          </div>
          {!loadingMoney && credit > 0 && (
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="font-medium text-sky-700">Credit balance</span>
              <span className="font-semibold tabular-nums text-sky-700">
                {cur()}{money(credit)}
              </span>
            </div>
          )}
        </div>

        {canCollect && (
          <div className="space-y-2.5 rounded-xl border border-zinc-200 bg-white p-3.5">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
              <Wallet className="size-4 text-brand-600" aria-hidden />
              <span>Collect payment</span>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">
                Amount to collect
              </span>
              <input
                className={payInputCls}
                type="number"
                inputMode="decimal"
                dir="ltr"
                min="0"
                value={payAmount}
                placeholder={money(due)}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </label>
            {payNum > 0 && (
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs">
                <div className="mb-1 font-medium text-zinc-500">
                  After this payment
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-zinc-600">Paid</span>
                  <span className="font-semibold tabular-nums text-emerald-700">
                    {cur()}{money(paidAfter)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-zinc-600">Remaining</span>
                  <span
                    className={
                      "font-semibold tabular-nums " +
                      (remAfter > 0 ? "text-gold-700" : "text-emerald-700")
                    }
                  >
                    {cur()}{money(remAfter)}
                  </span>
                </div>
                {overpay > 0 && (
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-sky-700">Credit balance</span>
                    <span className="font-semibold tabular-nums text-sky-700">
                      {cur()}{money(overpay)}
                    </span>
                  </div>
                )}
              </div>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">
                Payment method
              </span>
              <select
                className={payInputCls}
                value={payMode}
                onChange={(e) => setPayMode(e.target.value)}
              >
                {PAY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">
                Reference
              </span>
              <input
                className={payInputCls}
                dir="ltr"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <Button
              variant="gold"
              className="w-full justify-center"
              disabled={collecting || !(Number(payAmount) > 0)}
              onClick={collect}
            >
              {collecting ? "Collecting…" : "Collect payment"}
            </Button>
          </div>
        )}

        {collectedNow != null && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800">
            <span>Payment recorded</span>
            <bdi dir="ltr" className="tabular-nums">
              {cur()}{money(collectedNow)}
            </bdi>
          </div>
        )}

        {!loadingMoney && due === 0 && mv.paid > 0 && status !== "Cancelled" && status !== "No Show" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800">
            Paid in full
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-zinc-100 bg-white px-5 py-4">
        {status === "Confirmed" && (
          <Button
            className="w-full justify-center"
            disabled={busy}
            onClick={() =>
              // require a booking deposit before check-in (Corporate/Group settle centrally)
              mv.paid <= 0.005 &&
              bookingType !== "Corporate" &&
              bookingType !== "Group"
                ? setError("Collect the booking deposit before check-in.")
                : setCheckingIn(true)
            }
          >
            <LogIn className="size-4" /> Check in
          </Button>
        )}
        {status === "Checked In" && (
          <Button className="w-full justify-center" disabled={busy} onClick={doCheckOut}>
            <LogOut className="size-4" /> Check out
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Link
            to={`/grc/${encodeURIComponent(name)}`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <FileText className="size-4" /> Registration card
          </Link>
          <button
            onClick={onOpenDetail}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <PanelRightOpen className="size-4" /> Full details
          </button>
        </div>
      </div>

      {checkingIn && (
        <CheckInDialog
          reservation={name}
          onClose={() => setCheckingIn(false)}
          onDone={() => {
            setCheckingIn(false)
            reload()
            onClose()
          }}
        />
      )}
    </div>
  )
}
