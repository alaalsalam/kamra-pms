import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Printer } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { call } from "../lib/api"
import { Button } from "../components/ui/button"
import { cur, moneyLocale } from "../lib/money"
import { useT, fill, qty } from "../lib/i18n"

/** Printable cancellation confirmation - the guest's proof, with the
 * cancellation number front and center. Bilingual + print-safe (AR/EN). */

interface Letter {
  property: {
    property_name: string
    logo_url: string | null
    address: string
    phone: string | null
    email: string | null
  }
  guest: { full_name: string; phone: string | null; email: string | null }
  reservation: {
    name: string
    room_type: string
    check_in_date: string
    check_out_date: string
    nights: number
    amount_after_tax: number
    cancellation_number: string
    cancellation_reason: string | null
    cancellation_fee: number
    cancelled_on: string
    advance_paid: number
  }
}

const inr = (n: number) =>
  Number(n).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

export default function CancellationLetter() {
  const { name } = useParams()
  const { t } = useT()
  const [d, setD] = useState<Letter | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!name) return
    setError(null)
    call<Letter>("hotelpms.api.cancellation_letter", { reservation: name })
      .then(setD)
      .catch(() => setError("Could not load this cancellation."))
  }, [name])

  useEffect(load, [load])

  if (error)
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {t(error)}
          <button
            className="ms-3 font-medium underline hover:no-underline"
            onClick={load}
          >
            {t("Try again")}
          </button>
        </div>
      </div>
    )
  if (!d) return <p className="py-10 text-center text-zinc-400">{t("Loading…")}</p>

  const r = d.reservation
  const refundDue = Math.max(0, r.advance_paid - r.cancellation_fee)
  const money = (n: number) => `${cur()}${inr(n)}`

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          to="/reservations"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />{" "}
          {t("Reservations")}
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> {t("Print letter")}
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-8 print:border-0">
        <div className="mb-6 flex items-start justify-between border-b border-zinc-300 pb-4">
          <div>
            <h1 className="text-lg font-bold">{d.property.property_name}</h1>
            <p className="text-xs text-zinc-500">{d.property.address}</p>
            <p className="text-xs text-zinc-500">
              <bdi dir="ltr">{d.property.phone}</bdi>
              {d.property.email && (
                <>
                  {" · "}
                  <bdi dir="ltr">{d.property.email}</bdi>
                </>
              )}
            </p>
          </div>
          <div className="text-end">
            <p className="text-sm font-semibold">
              {t("CANCELLATION CONFIRMATION")}
            </p>
            <p className="text-lg font-bold text-brand-700">
              <bdi dir="ltr">{r.cancellation_number}</bdi>
            </p>
            <p className="text-xs text-zinc-500">
              <bdi dir="ltr">{r.cancelled_on.slice(0, 16)}</bdi>
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed">
          {fill(t("Dear {guest},"), { guest: <bdi>{d.guest.full_name}</bdi> })}
          <br />
          <br />
          {fill(
            t(
              "This confirms that your reservation {ref} — {roomType}, {ci} to {co} ({nights}) — has been cancelled.",
            ),
            {
              ref: <bdi dir="ltr" className="font-medium">{r.name}</bdi>,
              roomType: <bdi>{r.room_type}</bdi>,
              ci: r.check_in_date,
              co: r.check_out_date,
              nights: qty(r.nights, "night"),
            },
          )}
          {r.cancellation_reason && (
            <> (<bdi>{r.cancellation_reason.toLowerCase()}</bdi>)</>
          )}
        </p>

        <div className="mt-5 space-y-1.5 rounded-lg bg-zinc-50 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">{t("Stay value")}</span>
            <bdi dir="ltr" className="tabular-nums">
              {money(r.amount_after_tax)}
            </bdi>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">{t("Cancellation fee")}</span>
            <bdi dir="ltr" className="tabular-nums">
              {r.cancellation_fee > 0 ? money(r.cancellation_fee) : t("None")}
            </bdi>
          </div>
          {r.advance_paid > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-zinc-500">{t("Advance paid")}</span>
                <bdi dir="ltr" className="tabular-nums">
                  {money(r.advance_paid)}
                </bdi>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-1.5 font-semibold">
                <span>{t("Refund due")}</span>
                <bdi
                  dir="ltr"
                  className={
                    "tabular-nums " + (refundDue > 0 ? "text-gold-700" : "")
                  }
                >
                  {money(refundDue)}
                </bdi>
              </div>
            </>
          )}
        </div>

        <p className="mt-5 text-sm leading-relaxed text-zinc-600">
          {fill(
            t("Please keep the cancellation number {num} for your records."),
            {
              num: (
                <bdi dir="ltr" className="font-medium text-zinc-900">
                  {r.cancellation_number}
                </bdi>
              ),
            },
          )}{" "}
          {d.property.phone
            ? fill(
                t(
                  "We would love to host you again — call {phone} and we will find you a room.",
                ),
                { phone: d.property.phone },
              )
            : t(
                "We would love to host you again — reach out any time and we will find you a room.",
              )}
        </p>

        <p className="mt-8 text-sm text-zinc-500">
          {t("Warm regards,")}
          <br />
          <span className="font-medium text-zinc-900">
            {d.property.property_name}
          </span>
        </p>
      </div>
    </div>
  )
}
