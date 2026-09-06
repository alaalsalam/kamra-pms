import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Ban,
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Gauge,
  LayoutGrid,
  LogIn,
  LogOut,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react"
import { getCalendar, getSnapshot, type CalendarData, type Snapshot } from "../lib/api"
import { serverError } from "../lib/resource"
import { primaryLabel } from "../lib/dir"
import { useAuth } from "../lib/auth"
import { useEnabledModules } from "../lib/modules"
import { canAccessPath } from "../lib/apps"
import { Button } from "./ui/button"
import { cn } from "../lib/utils"
import { cur, moneyLocale, dateLocale } from "../lib/money"
import { Bilingual } from "./Bilingual"
import { Legend } from "./Legend"
import { BoardNav } from "./BoardNav"
import { ScreenHeader, type HeaderStat } from "./ScreenHeader"
import { OnboardingEmptyState } from "./OnboardingEmptyState"

const inr = (n: number) =>
  n.toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

function cellTone(available: number, total: number) {
  if (available === 0) return "bg-rose-50 text-rose-700"
  if (available <= Math.max(1, Math.floor(total * 0.25)))
    return "bg-amber-50 text-amber-800"
  return "bg-white text-zinc-700"
}

/** Same thresholds as cellTone, but the "available" state gets a visible teal
 * fill so it reads as a badge on the white mobile cards. */
function badgeTone(available: number, total: number) {
  if (available === 0) return "bg-rose-50 text-rose-700"
  if (available <= Math.max(1, Math.floor(total * 0.25)))
    return "bg-amber-50 text-amber-800"
  return "bg-brand-50 text-brand-700"
}

const DAYS = 14

const iso = (d: Date) => d.toISOString().slice(0, 10)

function shift(startIso: string, byDays: number) {
  const d = new Date(startIso + "T00:00:00")
  d.setDate(d.getDate() + byDays)
  return iso(d)
}

function rangeLabel(dates: string[]) {
  if (!dates.length) return ""
  const f = new Date(dates[0]),
    l = new Date(dates[dates.length - 1])
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString(dateLocale(), {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    })
  return `${fmt(f, f.getFullYear() !== l.getFullYear())} – ${fmt(l, true)}`
}

function dateLabel(isoStr: string) {
  return new Date(isoStr).toLocaleDateString(dateLocale(), {
    day: "numeric",
    month: "short",
  })
}

export function CalendarView(props: {
  onPick?: (roomType: string, date: string) => void
  onNewBooking?: () => void
  refreshKey: number
}) {
  const [data, setData] = useState<CalendarData | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [start, setStart] = useState(() => iso(new Date()))
  // On phones the 14-column grid is unreadable, so we show one day at a time.
  const [mobileDay, setMobileDay] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const { roles } = useAuth()
  const modules = useEnabledModules()
  const linkTo = (to: string) => (canAccessPath(to, roles, modules) ? to : undefined)
  // the room-type filter lives in the URL so it survives a reload and can be
  // deep-linked / shared, like the list screens.
  const [searchParams, setSearchParams] = useSearchParams()
  const rtFilter = searchParams.get("rt") || ""
  const setRtFilter = (v: string) =>
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (v) next.set("rt", v)
        else next.delete("rt")
        return next
      },
      { replace: true },
    )

  useEffect(() => {
    setLoading(true)
    setError(null)
    // Both calls fire in parallel (no waterfall). The snapshot is today-scoped
    // front-desk data; roles without it just don't get those tiles.
    getCalendar(DAYS, start)
      .then(setData)
      .catch((e) => setError(serverError(e)))
      .finally(() => setLoading(false))
    getSnapshot()
      .then(setSnapshot)
      .catch(() => setSnapshot(null))
  }, [props.refreshKey, start, reloadKey])

  const todayIso = iso(new Date())

  // per-day house occupancy + the reference night for the "rooms free" tile,
  // all derived from the availability payload — no per-cell calls.
  const derived = useMemo(() => {
    if (!data) return null
    const cap = data.room_types.reduce((s, rt) => s + rt.total_rooms, 0)
    const refIdx = Math.max(0, data.dates.indexOf(todayIso))
    const dayOcc = data.dates.map((_, i) => {
      const sold = data.room_types.reduce(
        (s, rt) => s + (rt.total_rooms - (rt.cells[i]?.available ?? rt.total_rooms)),
        0,
      )
      return cap > 0 ? Math.round((sold / cap) * 100) : 0
    })
    const freeRef = data.room_types.reduce(
      (s, rt) => s + (rt.cells[refIdx]?.available ?? 0),
      0,
    )
    return { cap, refIdx, dayOcc, freeRef }
  }, [data, todayIso])

  const stats = useMemo<HeaderStat[]>(() => {
    if (!data || !derived) return []
    const out: HeaderStat[] = []
    // occupancy: prefer the true occupied/total from the live snapshot; fall
    // back to the availability-derived figure for the reference night.
    const occPct = snapshot?.rooms.length
      ? Math.round(
          (snapshot.rooms.filter((r) => r.occupancy_status === "Occupied").length /
            snapshot.rooms.length) *
            100,
        )
      : derived.dayOcc[derived.refIdx] ?? 0
    out.push({
      key: "occ",
      label: "Occupancy",
      value: `${occPct}%`,
      meter: occPct,
      icon: Gauge,
      tone: "brand",
      to: linkTo("/tape"),
    })
    out.push({
      key: "free",
      label: "Rooms free",
      value: derived.freeRef,
      hint: dateLabel(data.dates[derived.refIdx] ?? data.dates[0]),
      icon: BedDouble,
      tone: "brand",
      to: linkTo("/tape"),
    })
    if (snapshot) {
      out.push({
        key: "arr",
        label: "Arrivals today",
        value: snapshot.arrivals.length,
        icon: LogIn,
        tone: "sky",
        to: linkTo("/reservations"),
      })
      out.push({
        key: "dep",
        label: "Departures today",
        value: snapshot.departures.length,
        icon: LogOut,
        tone: "gold",
        to: linkTo("/reservations"),
      })
      out.push({
        key: "clean",
        label: "To clean",
        value: snapshot.rooms.filter((r) => r.housekeeping_status === "Dirty").length,
        icon: Sparkles,
        tone: "gold",
        to: linkTo("/rooms"),
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, derived, snapshot, roles, modules])

  const shownTypes = (data?.room_types ?? []).filter(
    (rt) => !rtFilter || (rt.room_type_name || rt.room_type) === rtFilter,
  )

  const nav = data ? (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        className="min-h-11 px-3"
        aria-label="Previous 14 days"
        onClick={() => setStart((s) => shift(s, -DAYS))}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <Button
        variant="outline"
        className="min-h-11"
        disabled={start === todayIso}
        onClick={() => setStart(todayIso)}
      >
        <CalendarDays className="size-4" aria-hidden /> Today
      </Button>
      <input
        type="date"
        aria-label="Jump to date"
        className="min-h-11 rounded-xl border border-zinc-300 bg-white px-2.5 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
        value={start}
        onChange={(e) => e.target.value && setStart(e.target.value)}
      />
      <Button
        variant="outline"
        className="min-h-11 px-3"
        aria-label="Next 14 days"
        onClick={() => setStart((s) => shift(s, DAYS))}
      >
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  ) : null

  const primaryAction =
    props.onNewBooking && props.onPick ? (
      <Button variant="primary" className="min-h-11" onClick={props.onNewBooking}>
        <CalendarDays className="size-4" aria-hidden /> New booking
      </Button>
    ) : undefined

  const header = (
    <ScreenHeader
      title="Availability"
      context={data ? rangeLabel(data.dates) : "Loading…"}
      stats={stats}
      nav={nav}
      primaryAction={primaryAction}
    />
  )

  // First paint / hard error before any data resolves.
  if (!data) {
    return (
      <div className="space-y-3">
        <BoardNav />
        {header}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          {error ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-rose-700">{error}</p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => setReloadKey((k) => k + 1)}
              >
                Try again
              </Button>
            </div>
          ) : (
            <div className="space-y-2" aria-busy="true" aria-label="Loading availability">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-11 animate-pulse rounded-md bg-zinc-100" />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <BoardNav />
      {header}
      <div
        className={cn(
          "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5",
          loading && "opacity-60 transition-opacity",
        )}
      >
        {error && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <span>{error}</span>
            <button
              className="shrink-0 font-semibold underline"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Retry
            </button>
          </div>
        )}

        {/* Filter bar: room-type select + removable chip + Clear */}
        {data.room_types.length > 1 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-sm">
              <span className="text-zinc-500">Room type</span>
              <select
                value={rtFilter}
                onChange={(e) => setRtFilter(e.target.value)}
                aria-label="Filter by room type"
                className="min-h-9 border-0 bg-transparent pe-1 text-sm font-semibold text-zinc-800 focus:outline-none"
              >
                <option value="">All room types</option>
                {data.room_types.map((rt) => (
                  <option key={rt.room_type} value={rt.room_type_name || rt.room_type}>
                    {primaryLabel(rt.room_type_name || rt.room_type)}
                  </option>
                ))}
              </select>
            </label>
            {rtFilter && (
              <>
                <button
                  onClick={() => setRtFilter("")}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-800 transition hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
                >
                  {primaryLabel(rtFilter)}
                  <X className="size-3.5" aria-hidden />
                </button>
                <button
                  onClick={() => setRtFilter("")}
                  className="min-h-11 text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        )}

        {data.room_types.length === 0 ? (
          <OnboardingEmptyState
            icon={LayoutGrid}
            title="Set up room types to see availability"
            message="The calendar shows how many rooms are free each night. Add your room types, then your rooms, to bring it to life."
            cta={{ label: "Create room types", to: "/room-types" }}
            secondary={{ label: "Add rooms", to: "/rooms" }}
            gatedNote="Ask a hotel administrator to add room types and rooms."
          />
        ) : data.room_types.every((rt) => rt.total_rooms === 0) ? (
          <OnboardingEmptyState
            icon={BedDouble}
            title="No rooms added yet"
            message="Your room types are ready, but there are no rooms yet — availability stays at zero until rooms exist."
            cta={{ label: "Add rooms", to: "/rooms" }}
            gatedNote="Ask a hotel administrator to add rooms."
          />
        ) : (
          <>
            {/* Desktop: the full 14-day grid with a per-day occupancy strip */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky start-0 z-10 bg-white pe-3 text-start align-bottom text-xs font-medium text-zinc-500">
                      Room type
                    </th>
                    {data.dates.map((d, i) => {
                      const dl = new Date(d)
                      const weekend = dl.getDay() === 0 || dl.getDay() === 6
                      const isToday = d === todayIso
                      const occ = derived?.dayOcc[i] ?? 0
                      return (
                        <th
                          key={d}
                          className={cn(
                            "min-w-14 px-1 pb-1.5 pt-1 text-center text-xs font-medium",
                            weekend ? "text-brand-700" : "text-zinc-500",
                            isToday && "rounded-t-md bg-brand-50",
                          )}
                        >
                          <div>{dl.toLocaleDateString(dateLocale(), { weekday: "short" })}</div>
                          <div className="text-sm font-semibold text-zinc-800">{dl.getDate()}</div>
                          <div
                            className={cn(
                              "mt-0.5 text-[10px] font-semibold tabular-nums",
                              occ >= 85
                                ? "text-gold-600"
                                : occ >= 60
                                  ? "text-brand-600"
                                  : "text-zinc-400",
                            )}
                            title={`${occ}% occupied`}
                          >
                            {occ}%
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {shownTypes.map((rt) => (
                    <tr key={rt.room_type}>
                      <td className="sticky start-0 z-10 whitespace-nowrap bg-white py-1 pe-3 font-medium">
                        <Bilingual as="span" value={rt.room_type_name} primaryOnly />
                        <span className="ms-1 text-xs font-normal text-zinc-400">
                          ×{rt.total_rooms}
                        </span>
                      </td>
                      {rt.cells.map((c) => (
                        <td
                          key={c.date}
                          className={cn("p-0.5", c.date === todayIso && "bg-brand-50/60")}
                        >
                          <button
                            onClick={() => props.onPick?.(rt.room_type, c.date)}
                            disabled={c.available === 0 || !props.onPick}
                            title={`${rt.room_type_name} · ${c.date} · ${c.available} left · ${cur()}${inr(c.rate)}`}
                            className={cn(
                              "flex min-h-11 w-full flex-col items-center justify-center rounded-md border border-zinc-200 px-1 text-center transition-colors",
                              "hover:border-brand-600 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-brand-600",
                              "disabled:cursor-not-allowed",
                              cellTone(c.available, rt.total_rooms),
                            )}
                          >
                            <span className="text-sm font-semibold leading-none">
                              {c.available}
                            </span>
                            {c.available === 0 ? (
                              <Ban className="mt-1 size-3 opacity-70" aria-hidden />
                            ) : (
                              <span className="mt-0.5 text-[10px] leading-none opacity-70">
                                <bdi dir="ltr">
                                  {cur()}
                                  {inr(c.rate)}
                                </bdi>
                              </span>
                            )}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: one day at a time — a tappable room-type list, not a crushed grid */}
            <div className="lg:hidden">
              <div
                className="mb-3 flex gap-1.5 overflow-x-auto pb-1"
                role="tablist"
                aria-label="Pick a date"
              >
                {data.dates.map((d, i) => {
                  const dl = new Date(d)
                  const sel = i === Math.min(mobileDay, data.dates.length - 1)
                  const occ = derived?.dayOcc[i] ?? 0
                  return (
                    <button
                      key={d}
                      role="tab"
                      aria-selected={sel}
                      onClick={() => setMobileDay(i)}
                      className={cn(
                        "flex min-h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-xl border px-2.5 py-1 text-xs tabular-nums transition-colors",
                        sel
                          ? "border-brand-600 bg-brand-50 text-brand-800"
                          : "border-zinc-200 text-zinc-500 hover:border-zinc-300",
                      )}
                    >
                      <span>{dl.toLocaleDateString(dateLocale(), { weekday: "short" })}</span>
                      <span className="text-sm font-semibold">{dl.getDate()}</span>
                      <span className="text-[9px] font-semibold text-zinc-400">{occ}%</span>
                    </button>
                  )
                })}
              </div>
              <ul className="space-y-2">
                {shownTypes.map((rt) => {
                  const c = rt.cells[Math.min(mobileDay, rt.cells.length - 1)]
                  if (!c) return null
                  return (
                    <li key={rt.room_type}>
                      <button
                        onClick={() => props.onPick?.(rt.room_type, c.date)}
                        disabled={c.available === 0 || !props.onPick}
                        className={cn(
                          "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-start transition-colors",
                          "hover:border-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600",
                          "disabled:cursor-not-allowed disabled:opacity-70",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-zinc-800">
                            <Bilingual as="span" value={rt.room_type_name} primaryOnly />
                            <span className="ms-1 text-xs font-normal text-zinc-400">
                              ×{rt.total_rooms}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-400">
                            <bdi dir="ltr" className="tabular-nums">
                              {cur()}
                              {inr(c.rate)}
                            </bdi>{" "}
                            · per night
                          </div>
                        </div>
                        <span
                          className={cn(
                            "flex min-w-12 shrink-0 flex-col items-center rounded-lg px-2.5 py-1.5 tabular-nums",
                            badgeTone(c.available, rt.total_rooms),
                          )}
                        >
                          <span className="text-base font-semibold leading-none">
                            {c.available}
                          </span>
                          <span className="mt-0.5 text-[10px] font-medium leading-none opacity-70">
                            {c.available === 0 ? "Sold out" : "available"}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Legend
            items={[
              { swatch: "bg-white", label: "Available" },
              { swatch: "bg-amber-400", icon: TriangleAlert, iconClassName: "text-amber-500", label: "Limited" },
              { swatch: "bg-rose-500", icon: Ban, iconClassName: "text-rose-500", label: "Sold out" },
            ]}
          />
          <p className="text-xs text-zinc-400">
            Number = rooms available · price = 2-adult nightly rate, taxes and seasons applied.
          </p>
        </div>
      </div>
    </div>
  )
}
