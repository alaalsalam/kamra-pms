import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import {
  AlertTriangle,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  Loader2,
  MapPin,
  RotateCw,
  Search,
  Users,
  Wallet,
  X,
} from "lucide-react"
import { call, isAuthError, myProperties, type PropertyRow } from "../lib/api"
import { serverError } from "../lib/resource"
import type { ShellContext } from "../AppShell"
import { useT, qty, fill } from "../lib/i18n"
import { cur, moneyLocale, dateLocale } from "../lib/money"
import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import { Sheet } from "../components/ui/sheet"
import { ScreenHeader, type HeaderStat } from "../components/ScreenHeader"
import { OnboardingEmptyState } from "../components/OnboardingEmptyState"

const inr = (n: unknown) =>
  Number(n ?? 0).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

const inputCls =
  "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm " +
  "focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"

interface RoomTypeAvail {
  room_type: string
  room_type_name: string
  available: number
  adults_capacity: number
  children_capacity: number
  total: number
  per_night: number
}
interface PropAvail {
  property: string
  property_name: string
  city: string
  available_rooms: number
  from_rate: number
  room_types: RoomTypeAvail[]
}
interface Results {
  check_in_date: string
  check_out_date: string
  nights: number
  adults: number
  children: number
  properties: PropAvail[]
}

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function plusDays(iso: string, n: number) {
  // all-UTC arithmetic: a local parse + UTC serialize would shift the day in
  // any UTC+ timezone and collapse a 1-night stay to check-out == check-in.
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(dateLocale(), {
    day: "numeric",
    month: "short",
  })
}

/** Availability vocabulary, matched to BookingDialog's room cards: emerald
 * "available" vs amber "low stock". crs_search never returns a sold-out type
 * (the backend filters those out), so there is no rose/sold-out state here. */
function availMeta(available: number) {
  if (available <= 2)
    return {
      chip: "bg-amber-50 text-amber-700",
      Icon: AlertTriangle,
      label: `${available} left`,
    }
  return {
    chip: "bg-emerald-50 text-emerald-700",
    Icon: Check,
    label: "Available for your dates",
  }
}

export default function CRS() {
  const { t } = useT()
  const { openBooking, canCreateBooking, refreshKey } =
    useOutletContext<ShellContext>()

  // search form (the hero). Editing it does NOT re-query until Search is
  // pressed, so results + chips keep reflecting the last query that actually ran.
  const [checkIn, setCheckIn] = useState(isoToday())
  const [nights, setNights] = useState(1)
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  // client-side scope: crs_search has no property argument, so we filter the
  // returned properties here. "" = every property the user can access.
  const [scope, setScope] = useState("")
  const [propList, setPropList] = useState<PropertyRow[]>([])

  const [data, setData] = useState<Results | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)

  const [booking, setBooking] = useState<{
    property: string
    property_name: string
    rt: RoomTypeAvail
  } | null>(null)
  const [guest, setGuest] = useState({ name: "", phone: "" })
  const [bookBusy, setBookBusy] = useState(false)
  const [bookError, setBookError] = useState<string | null>(null)
  const [done, setDone] = useState<{ ref: string; property: string } | null>(null)

  const checkOut = plusDays(checkIn, Math.max(1, nights))

  const search = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await call<Results>("hotelpms.crs.crs_search", {
        check_in_date: checkIn,
        check_out_date: plusDays(checkIn, Math.max(1, nights)),
        adults,
        children,
      })
      setData(r)
      setDenied(false)
    } catch (e) {
      if (isAuthError(e)) setDenied(true)
      else setError(serverError(e))
    } finally {
      setBusy(false)
    }
  }, [checkIn, nights, adults, children])

  // one property lookup for the scope selector; failure just leaves the picker
  // with the "all properties" option, never blocking search.
  useEffect(() => {
    myProperties()
      .then(setPropList)
      .catch(() => setPropList([]))
  }, [])

  // auto-run on mount and whenever a booking elsewhere (header dialog) bumps
  // refreshKey, so the counts here stay in step. Not tied to form edits.
  useEffect(() => {
    search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  async function book() {
    if (!booking) return
    setBookBusy(true)
    setBookError(null)
    try {
      const r = await call<{ reservation: string }>(
        "hotelpms.api.create_booking",
        {
          property: booking.property,
          room_type: booking.rt.room_type,
          check_in_date: checkIn,
          check_out_date: checkOut,
          guest_name: guest.name,
          phone: guest.phone || null,
          adults,
          children,
          source: "Manual",
        },
      )
      setDone({ ref: r.reservation, property: booking.property_name })
      setBooking(null)
      // reflect the room we just consumed in the availability counts
      search()
    } catch (e) {
      setBookError(serverError(e))
    } finally {
      setBookBusy(false)
    }
  }

  const shown = useMemo(() => {
    if (!data) return []
    return scope
      ? data.properties.filter((p) => p.property === scope)
      : data.properties
  }, [data, scope])

  const stats = useMemo<HeaderStat[]>(() => {
    if (!data || shown.length === 0) return []
    const rooms = shown.reduce((s, p) => s + p.available_rooms, 0)
    const from = Math.min(...shown.map((p) => p.from_rate))
    return [
      {
        key: "props",
        label: "Properties with space",
        value: shown.length,
        icon: Building2,
        tone: "brand",
      },
      {
        key: "rooms",
        label: "Rooms available",
        value: rooms,
        icon: BedDouble,
        tone: "brand",
      },
      {
        key: "from",
        label: "From",
        value: (
          <bdi dir="ltr">
            {cur()}
            {inr(from)}
          </bdi>
        ),
        hint: t("per night"),
        icon: Wallet,
        tone: "gold",
      },
      {
        key: "nights",
        label: "Nights",
        value: data.nights,
        icon: CalendarDays,
        tone: "brand",
      },
    ]
  }, [data, shown, t])

  const scopeName =
    propList.find((p) => p.name === scope)?.property_name ?? scope

  const header = (
    <ScreenHeader
      title={t("Central Reservations")}
      context={
        data
          ? `${fmtDate(data.check_in_date)} – ${fmtDate(data.check_out_date)}`
          : t("Search availability across your properties")
      }
      stats={stats}
      primaryAction={
        canCreateBooking ? (
          <Button
            variant="primary"
            className="min-h-11"
            onClick={() => openBooking({})}
          >
            <CalendarDays className="size-4" aria-hidden /> {t("New booking")}
          </Button>
        ) : undefined
      }
    />
  )

  // The search card — grouped and compact, always mounted so a re-query never
  // makes the controls disappear from under the user.
  const searchCard = (
    <form
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
      onSubmit={(e) => {
        e.preventDefault()
        search()
      }}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="col-span-2 block sm:col-span-1">
          <span className="mb-1 block text-xs font-medium text-zinc-500">
            {t("Property")}
          </span>
          <select
            className={inputCls}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="">{t("All properties")}</option>
            {propList.map((p) => (
              <option key={p.name} value={p.name}>
                {p.property_name}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 block sm:col-span-1">
          <span className="mb-1 block text-xs font-medium text-zinc-500">
            {t("Check-in")}
          </span>
          <input
            type="date"
            className={inputCls}
            value={checkIn}
            min={isoToday()}
            onChange={(e) => e.target.value && setCheckIn(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-500">
            {t("Nights")}
          </span>
          <input
            type="number"
            min={1}
            className={inputCls}
            value={nights}
            onChange={(e) => setNights(Math.max(1, Number(e.target.value)))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-500">
            {t("Adults")}
          </span>
          <input
            type="number"
            min={1}
            className={inputCls}
            value={adults}
            onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-500">
            {t("Children")}
          </span>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={children}
            onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))}
          />
        </label>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <Button
            type="submit"
            variant="primary"
            className="min-h-11 w-full justify-center"
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Search className="size-4" aria-hidden />
            )}
            {t("Search")}
          </Button>
        </div>
      </div>
    </form>
  )

  // active-query summary + the removable scope filter.
  const chips = data && (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-zinc-100 px-3 text-xs font-medium text-zinc-600">
        <CalendarDays className="size-3.5 text-zinc-400" aria-hidden />
        {fmtDate(data.check_in_date)} – {fmtDate(data.check_out_date)}
      </span>
      <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-zinc-100 px-3 text-xs font-medium text-zinc-600">
        <Users className="size-3.5 text-zinc-400" aria-hidden />
        {qty(data.adults, "adult")}
        {data.children > 0 && <>, {qty(data.children, "child", "children")}</>}
      </span>
      {scope && (
        <>
          <button
            type="button"
            aria-label={t("Clear property filter")}
            onClick={() => setScope("")}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-800 transition hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
          >
            <MapPin className="size-3.5" aria-hidden />
            <bdi>{scopeName}</bdi>
            <X className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setScope("")}
            className="min-h-11 text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
          >
            {t("Clear")}
          </button>
        </>
      )}
    </div>
  )

  function renderResults() {
    if (denied)
      return (
        <OnboardingEmptyState
          variant="denied"
          title={t("You don't have access to central reservations")}
          message={t(
            "Central reservations is for reception and revenue teams. Ask a hotel administrator if you need access.",
          )}
        />
      )

    if (!data && error)
      return (
        <div className="rounded-2xl border border-zinc-200 bg-white py-12 text-center shadow-sm">
          <p className="text-sm font-medium text-rose-700">{error}</p>
          <Button
            variant="outline"
            className="mt-3 min-h-11"
            onClick={() => search()}
          >
            <RotateCw className="size-4" aria-hidden /> {t("Try again")}
          </Button>
        </div>
      )

    if (!data)
      return (
        <div
          className="space-y-3"
          aria-busy="true"
          aria-label={t("Searching")}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100"
            />
          ))}
        </div>
      )

    return (
      <div className={cn("space-y-3", busy && "opacity-60 transition-opacity")}>
        {error && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            <span>{error}</span>
            <button
              className="min-h-11 shrink-0 font-semibold underline"
              onClick={() => search()}
            >
              {t("Retry")}
            </button>
          </div>
        )}

        {done && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span>
              {fill(t("Booked {ref} at {property}."), {
                ref: done.ref,
                property: <bdi>{done.property}</bdi>,
              })}
            </span>
            <Link
              to={`/grc/${done.ref}`}
              className="inline-flex min-h-11 shrink-0 items-center font-semibold underline underline-offset-2 hover:text-emerald-900"
            >
              {t("View reservation")}
            </Link>
          </div>
        )}

        {chips}

        {shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 py-14 text-center">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-400">
              <CalendarDays className="size-6" aria-hidden />
            </div>
            <h3 className="text-base font-semibold text-zinc-800">
              {scope
                ? t("No availability at this property for these dates")
                : t("No availability for these dates")}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
              {t("Try other dates, a shorter stay, or a smaller party.")}
            </p>
            {scope && (
              <Button
                variant="outline"
                className="mt-4 min-h-11"
                onClick={() => setScope("")}
              >
                {t("Search all properties")}
              </Button>
            )}
          </div>
        ) : (
          shown.map((p) => renderProperty(p, data.children))
        )}
      </div>
    )
  }

  function renderProperty(p: PropAvail, childrenN: number) {
    return (
      <section
        key={p.property}
        className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-900">
              <bdi>{p.property_name}</bdi>
            </h2>
            {p.city && (
              <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-zinc-400">
                <MapPin className="size-3.5" aria-hidden />
                <bdi>{p.city}</bdi>
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-zinc-500">
            {qty(p.available_rooms, "room")} · {t("from")}{" "}
            <bdi dir="ltr" className="tabular-nums">
              {cur()}
              {inr(p.from_rate)}
            </bdi>
            {t("/night")}
          </span>
        </div>

        <ul className="space-y-2">
          {p.room_types.map((rt) => (
            <li key={rt.room_type}>{renderRoomType(p, rt, childrenN)}</li>
          ))}
        </ul>
      </section>
    )
  }

  function renderRoomType(
    p: PropAvail,
    rt: RoomTypeAvail,
    childrenN: number,
  ) {
    const meta = availMeta(rt.available)
    const overChildren =
      rt.children_capacity > 0 && childrenN > rt.children_capacity
    const bookable = canCreateBooking && !overChildren

    const inner = (
      <>
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center self-start rounded-xl",
            bookable ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-400",
          )}
          aria-hidden
        >
          <BedDouble className="size-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-zinc-900">
              <bdi>{rt.room_type_name}</bdi>
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                meta.chip,
              )}
            >
              <meta.Icon className="size-3" aria-hidden />
              {meta.label}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            {t("Sleeps up to")} {qty(rt.adults_capacity, "adult")}
            {rt.children_capacity > 0 && (
              <>
                {" · "}
                {qty(rt.children_capacity, "child", "children")}
              </>
            )}
          </span>
          {overChildren && (
            <span className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              {fill(t("Room sleeps up to {n} children — reduce the party or split rooms."), {
                n: rt.children_capacity,
              })}
            </span>
          )}
        </span>

        <span className="flex shrink-0 flex-col items-end justify-center self-center text-end">
          <span className="text-[11px] text-zinc-400">{t("from")}</span>
          <span className="font-semibold tabular-nums text-zinc-900">
            <bdi dir="ltr">
              {cur()}
              {inr(rt.per_night)}
            </bdi>
          </span>
          <span className="text-[11px] text-zinc-400">
            <bdi dir="ltr" className="tabular-nums">
              {cur()}
              {inr(rt.total)}
            </bdi>{" "}
            {t("total, taxes in")}
          </span>
        </span>
      </>
    )

    if (!bookable) {
      return (
        <div className="flex items-stretch gap-3 rounded-xl border border-zinc-200 bg-white p-3">
          {inner}
        </div>
      )
    }

    return (
      <button
        type="button"
        onClick={() => {
          setBooking({ property: p.property, property_name: p.property_name, rt })
          setGuest({ name: "", phone: "" })
          setBookError(null)
        }}
        className={cn(
          "flex w-full items-stretch gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-start transition-colors",
          "hover:border-brand-300 hover:bg-brand-50/30 active:bg-brand-50/60",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        )}
      >
        {inner}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {header}
      {searchCard}
      {renderResults()}

      {booking && (
        <Sheet
          title={fill(t("Book {roomType}"), {
            roomType: <bdi>{booking.rt.room_type_name}</bdi>,
          })}
          description={
            <>
              <bdi>{booking.property_name}</bdi> ·{" "}
              <bdi dir="ltr" className="tabular-nums">
                {checkIn} → {checkOut}
              </bdi>{" "}
              ·{" "}
              <bdi dir="ltr" className="tabular-nums">
                {cur()}
                {inr(booking.rt.total)}
              </bdi>{" "}
              {t("total")}
            </>
          }
          onClose={() => setBooking(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="min-h-11" onClick={() => setBooking(null)}>
                {t("Cancel")}
              </Button>
              <Button
                variant="primary"
                className="min-h-11"
                disabled={bookBusy || !guest.name.trim()}
                onClick={() => book()}
              >
                {bookBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {t("Confirm booking")}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-600">
                {t("Guest name")}
                <span className="ms-0.5 text-rose-500" aria-hidden>
                  *
                </span>
              </span>
              <input
                className={inputCls}
                value={guest.name}
                autoFocus
                aria-required="true"
                onChange={(e) => setGuest({ ...guest, name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-600">
                {t("Phone")}
              </span>
              <input
                className={inputCls}
                type="tel"
                dir="ltr"
                value={guest.phone}
                placeholder="+966 5X XXX XXXX"
                onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
              />
            </label>

            {bookError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                <p>{bookError}</p>
                <button
                  type="button"
                  onClick={() => book()}
                  className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                >
                  <RotateCw className="size-3.5" aria-hidden /> {t("Retry")}
                </button>
              </div>
            )}
          </div>
        </Sheet>
      )}
    </div>
  )
}
