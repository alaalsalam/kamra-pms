import { useCallback, useEffect, useMemo, useState } from "react"
import { useOutletContext, useSearchParams } from "react-router-dom"
import type { ShellContext } from "../AppShell"
import {
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gauge,
  LogIn,
  LogOut,
  Sparkles,
  Star,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react"
import { call, getCurrentProperty, isAuthError } from "../lib/api"
import { listResource, serverError } from "../lib/resource"
import { useAuth } from "../lib/auth"
import { useEnabledModules } from "../lib/modules"
import { canAccessPath } from "../lib/apps"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Sheet } from "../components/ui/sheet"
import { cn } from "../lib/utils"
import { cur, moneyLocale, dateLocale } from "../lib/money"
import { primaryLabel } from "../lib/dir"
import { qty } from "../lib/i18n"
import { Bilingual } from "../components/Bilingual"
import { Legend } from "../components/Legend"
import { BoardNav } from "../components/BoardNav"
import { ScreenHeader, type HeaderStat } from "../components/ScreenHeader"
import { OnboardingEmptyState } from "../components/OnboardingEmptyState"

/** The tape chart: rooms × dates, bookings as bars. Click a bar to act. */

interface TapeBooking {
  name: string
  room: string
  guest_name: string
  status: "Confirmed" | "Checked In"
  check_in_date: string
  check_out_date: string
  is_day_use: 0 | 1
  vip?: 0 | 1
  source?: string
  booking_type?: string
  company?: string | null
  travel_agent?: string | null
  group_booking?: string | null
  planned_check_in_time?: string | null
  planned_check_out_time?: string | null
}

/** "14:30:00" → "14:30" for display. */
const hhmm = (t?: string | null) => (t ? String(t).slice(0, 5) : "")

interface TapeBlock {
  name: string
  reason: string
  from_date: string
  to_date: string
  note?: string | null
}

interface TapeRoom {
  name: string
  room_number: string
  room_type: string
  room_type_name?: string
  floor?: string | null
  housekeeping_status: string
  bookings: TapeBooking[]
  blocks?: TapeBlock[]
}

/** Who is coming - a visible marker on the bar + a label for the tooltip. */
function segment(b: TapeBooking): { label: string; dot: string; vip: boolean } {
  if (b.vip) return { label: "VIP", dot: "bg-gold-300", vip: true }
  if (b.booking_type === "Group" || b.group_booking)
    return { label: "Group", dot: "bg-sky-300", vip: false }
  if (b.booking_type === "Corporate" || b.company)
    return { label: "Corporate", dot: "bg-violet-300", vip: false }
  if (b.travel_agent)
    return { label: "Travel agent", dot: "bg-teal-300", vip: false }
  if (b.source === "OTA")
    return { label: "OTA", dot: "bg-orange-300", vip: false }
  if (b.source === "Walk-in")
    return { label: "Walk-in", dot: "bg-zinc-300", vip: false }
  return { label: b.source || "Direct", dot: "bg-zinc-300", vip: false }
}

interface PositionCell {
  date: string
  sold: number
  capacity: number
  occupancy: number
  limit: number
  overbooked: boolean
  premium_pct: number
  min_rate: number
}
interface Changeover {
  room: string
  room_number: string
  date: string
  out_res: string
  out_guest: string
  etd: string
  in_res: string
  in_guest: string
  eta: string
}
interface TapeData {
  start: string
  dates: string[]
  rooms: TapeRoom[]
  position: PositionCell[]
  conflicts: Changeover[]
}

interface HourlyBooking extends TapeBooking {
  overnight: 0 | 1
  from_hour?: string
  to_hour?: string
}
interface HourlyRoom {
  name: string
  room_number: string
  room_type: string
  room_type_name?: string
  housekeeping_status: string
  bookings: HourlyBooking[]
}
interface HourlyData {
  date: string
  start_hour: number
  end_hour: number
  rooms: HourlyRoom[]
}
const hhmmToNum = (t?: string) => {
  if (!t) return 0
  const [h, m] = t.split(":").map(Number)
  return h + (m || 0) / 60
}

interface AllocProposal {
  reservation: string
  guest_name: string
  vip: 0 | 1
  room_type_name: string
  suggested_room: string
  room_number: string
  why: string
  needs_review: 0 | 1
}
interface AllocData {
  date: string
  proposals: AllocProposal[]
  unfittable: { reservation: string; guest_name: string; reason: string }[]
}

const DAYS = 14
const CELL_W = 64 // px per day column
const LABEL_W = 148 // px for the pinned room column
const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm " +
  "focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"

/** Housekeeping readiness → a coloured dot + text tone on the pinned room. */
const HK_DOT: Record<string, string> = {
  Clean: "bg-emerald-500",
  Dirty: "bg-gold-500",
  Inspected: "bg-sky-500",
  "Out of Order": "bg-rose-500",
}
function hkTextTone(status: string) {
  if (status === "Dirty") return "text-gold-700"
  if (status === "Out of Order") return "text-rose-600"
  if (status === "Inspected") return "text-sky-700"
  return "text-zinc-400"
}
function occTone(occ: number, overbooked?: boolean) {
  if (overbooked) return "text-rose-600"
  if (occ >= 85) return "text-gold-600"
  if (occ >= 60) return "text-brand-600"
  return "text-zinc-400"
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

function shiftDate(isoStr: string, days: number) {
  const d = new Date(isoStr)
  d.setDate(d.getDate() + days)
  return iso(d)
}

function dateLabel(isoStr: string) {
  return new Date(isoStr).toLocaleDateString(dateLocale(), {
    day: "numeric",
    month: "short",
  })
}

function rangeLabel(dates: string[]) {
  if (!dates.length) return ""
  const f = new Date(dates[0])
  const l = new Date(dates[dates.length - 1])
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString(dateLocale(), {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    })
  return `${fmt(f, f.getFullYear() !== l.getFullYear())} – ${fmt(l, true)}`
}

function TapeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading tape chart">
      <div className="mb-3 h-8 w-64 animate-pulse rounded-lg bg-zinc-100" />
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex border-b border-zinc-200 bg-zinc-50 px-3 py-2.5">
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-zinc-100 px-3 py-4">
            <div className="h-4 w-16 shrink-0 animate-pulse rounded bg-zinc-100" />
            <div className="h-9 flex-1 animate-pulse rounded-md bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  )
}

function BoardError({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-10 text-center">
      <p className="text-sm font-medium text-rose-700">{msg}</p>
      <Button variant="outline" className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

function InlineRetry({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      <span>{msg}</span>
      <button className="shrink-0 font-semibold underline" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

function BoardEmpty({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  if (filtered)
    return (
      <div className="rounded-xl border border-zinc-200 bg-white px-4 py-12 text-center shadow-sm">
        <p className="text-sm font-medium text-zinc-600">No rooms match these filters</p>
        <Button variant="outline" className="mt-3" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    )
  return (
    <OnboardingEmptyState
      icon={BedDouble}
      title="No rooms to show yet"
      message="The tape chart maps every room against the days ahead. Add your room types and rooms, then reservations show up as bars you can open and move."
      cta={{ label: "Create room types", to: "/room-types" }}
      secondary={{ label: "Add rooms", to: "/rooms" }}
      gatedNote="Ask a hotel administrator to add room types and rooms."
    />
  )
}

/** Compact labelled dropdown used in the filter bar (keyboard-accessible). */
function FilterSelect({
  label,
  ariaLabel,
  value,
  onChange,
  allLabel,
  children,
}: {
  label: string
  ariaLabel: string
  value: string
  onChange: (v: string) => void
  allLabel: string
  children: React.ReactNode
}) {
  return (
    <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-sm">
      <span className="text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="min-h-9 border-0 bg-transparent pe-1 text-sm font-semibold text-zinc-800 focus:outline-none"
      >
        <option value="">{allLabel}</option>
        {children}
      </select>
    </label>
  )
}

export default function TapeChart() {
  const [start, setStart] = useState(() => iso(new Date()))
  const [data, setData] = useState<TapeData | null>(null)
  const [sel, setSel] = useState<TapeBooking | null>(null)
  const [freeRooms, setFreeRooms] = useState<string[]>([])
  const [draft, setDraft] = useState({
    room: "", check_in: "", check_out: "", from_time: "", to_time: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  // On phones we swap the 14-day grid for a one-day room list.
  const [mobileDay, setMobileDay] = useState(0)
  // filters live in the URL so they survive a reload and can be shared/deep-linked
  const [searchParams, setSearchParams] = useSearchParams()
  const setParam = (key: string, v: string) =>
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (v) next.set(key, v)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  const rtFilter = searchParams.get("rt") || ""
  const floorFilter = searchParams.get("floor") || ""
  const hkFilter = searchParams.get("hk") || ""
  const setRtFilter = (v: string) => setParam("rt", v)
  const setFloorFilter = (v: string) => setParam("floor", v)
  const setHkFilter = (v: string) => setParam("hk", v)
  const [mode, setMode] = useState<"day" | "hour">("day")
  const [hourly, setHourly] = useState<HourlyData | null>(null)
  const [alloc, setAlloc] = useState<AllocData | null>(null)
  const [allocBusy, setAllocBusy] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("hotelpms:tape-collapsed") || "[]"))
    } catch {
      return new Set()
    }
  })
  const toggleGroup = (name: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      localStorage.setItem("hotelpms:tape-collapsed", JSON.stringify([...next]))
      return next
    })

  const { refreshKey, openBooking: openNewBooking, canCreateBooking } =
    useOutletContext<ShellContext>()
  const { roles } = useAuth()
  const modules = useEnabledModules()
  const linkTo = (to: string) => (canAccessPath(to, roles, modules) ? to : undefined)

  const todayIso = iso(new Date())

  // rooms grouped by room type, honoring the filters (rooms arrive ordered)
  const groups = useMemo(() => {
    const out: { key: string; label: string; rooms: TapeRoom[] }[] = []
    for (const r of data?.rooms ?? []) {
      const label = r.room_type_name || r.room_type
      if (rtFilter && label !== rtFilter) continue
      if (floorFilter && String(r.floor ?? "") !== floorFilter) continue
      if (hkFilter && r.housekeeping_status !== hkFilter) continue
      let g = out.find((x) => x.label === label)
      if (!g) {
        g = { key: r.room_type, label, rooms: [] }
        out.push(g)
      }
      g.rooms.push(r)
    }
    return out
  }, [data, rtFilter, floorFilter, hkFilter])

  const roomTypeNames = useMemo(
    () =>
      Array.from(
        new Set((data?.rooms ?? []).map((r) => r.room_type_name || r.room_type)),
      ),
    [data],
  )
  const floorNames = useMemo(
    () =>
      Array.from(
        new Set((data?.rooms ?? []).map((r) => r.floor).filter(Boolean) as string[]),
      ),
    [data],
  )

  const posByDate = useMemo(
    () => new Map((data?.position ?? []).map((p) => [p.date, p] as const)),
    [data],
  )
  // A reference day for the header tiles: today when it's in view, else the
  // first shown day so the numbers always describe something on screen.
  const refDate = data
    ? data.dates.includes(todayIso)
      ? todayIso
      : data.dates[0]
    : todayIso

  const stats = useMemo<HeaderStat[]>(() => {
    if (mode !== "day" || !data) return []
    const p = posByDate.get(refDate)
    const occ = p?.occupancy ?? 0
    const free = p ? Math.max(0, p.capacity - p.sold) : 0
    let arrivals = 0
    let departures = 0
    for (const r of data.rooms) {
      for (const b of r.bookings) {
        if (b.check_in_date === refDate) arrivals++
        if (b.check_out_date === refDate) departures++
      }
    }
    const oos = data.rooms.filter((r) => r.housekeeping_status === "Out of Order").length
    const hint = dateLabel(refDate)
    return [
      { key: "occ", label: "Occupancy", value: `${occ}%`, meter: occ, icon: Gauge, tone: occ >= 85 ? "gold" : "brand", hint },
      { key: "free", label: "Rooms free", value: free, icon: BedDouble, tone: "brand", hint },
      { key: "arr", label: "Arrivals", value: arrivals, icon: LogIn, tone: "sky", hint, to: linkTo("/reservations") },
      { key: "dep", label: "Departures", value: departures, icon: LogOut, tone: "gold", hint, to: linkTo("/reservations") },
      { key: "oos", label: "Out of service", value: oos, icon: Wrench, tone: oos > 0 ? "rose" : "zinc", to: linkTo("/rooms") },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, data, posByDate, refDate, roles, modules])

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    setDenied(false)
    const p =
      mode === "day"
        ? call<TapeData>("hotelpms.api.tape_chart", {
            property: getCurrentProperty(), start_date: start, days: DAYS,
          }).then(setData)
        : call<HourlyData>("hotelpms.api.tape_chart_hourly", {
            property: getCurrentProperty(), date: start,
          }).then(setHourly)
    p.catch((e) => {
      setDenied(isAuthError(e))
      setLoadError(serverError(e))
    }).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, refreshKey, mode])

  useEffect(load, [load])
  // keep the mobile day picker anchored to the visible range's first day
  useEffect(() => setMobileDay(0), [start])

  function openBooking(b: TapeBooking) {
    setSel(b)
    setError(null)
    const hb = b as HourlyBooking
    setDraft({
      room: b.room, check_in: b.check_in_date, check_out: b.check_out_date,
      from_time: hhmm(b.planned_check_in_time) || hb.from_hour || "",
      to_time: hhmm(b.planned_check_out_time) || hb.to_hour || "",
    })
    listResource("Room", {
      fields: ["name"],
      filters: [["property", "=", getCurrentProperty()]],
      orderBy: "room_number asc",
    }).then((r) => setFreeRooms(r.map((x) => x.name)))
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setSel(null)
      load()
    } catch (e) {
      setError(serverError(e))
    } finally {
      setBusy(false)
    }
  }

  async function suggestAlloc() {
    setAllocBusy(true)
    try {
      const d = await call<AllocData>("hotelpms.allocation.suggest_allocation", {
        property: getCurrentProperty(), date: start,
      })
      setAlloc(d)
    } catch (e) {
      setError(serverError(e))
    } finally {
      setAllocBusy(false)
    }
  }

  async function applyAlloc() {
    if (!alloc) return
    setAllocBusy(true)
    try {
      await call("hotelpms.allocation.apply_allocation", {
        property: getCurrentProperty(),
        assignments: JSON.stringify(alloc.proposals),
      })
      setAlloc(null)
      load()
    } catch (e) {
      setError(serverError(e))
    } finally {
      setAllocBusy(false)
    }
  }

  // active filter chips: one removable chip per set filter + a clear-all
  const activeFilters = [
    rtFilter && { key: "rt", node: primaryLabel(rtFilter), clear: () => setRtFilter("") },
    floorFilter && { key: "floor", node: <bdi dir="ltr">{floorFilter}</bdi>, clear: () => setFloorFilter("") },
    hkFilter && { key: "hk", node: hkFilter, clear: () => setHkFilter("") },
  ].filter(Boolean) as { key: string; node: React.ReactNode; clear: () => void }[]
  const anyFilter = activeFilters.length > 0
  const clearAll = () => {
    setRtFilter("")
    setFloorFilter("")
    setHkFilter("")
  }

  const nav = (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="inline-flex rounded-xl border border-zinc-200 bg-white p-0.5"
        role="group"
        aria-label="View"
      >
        {(["day", "hour"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "min-h-10 rounded-lg px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600",
              mode === m ? "bg-brand-50 text-brand-700" : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            {m === "day" ? "Days" : "Hourly"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="outline"
          className="min-h-10 px-3"
          aria-label="Previous"
          onClick={() => setStart((s) => shiftDate(s, mode === "day" ? -7 : -1))}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Button
          variant="outline"
          className="min-h-10"
          disabled={start === todayIso}
          onClick={() => setStart(todayIso)}
        >
          <CalendarDays className="size-4" aria-hidden /> Today
        </Button>
        <input
          type="date"
          aria-label="Jump to date"
          value={start}
          onChange={(e) => e.target.value && setStart(e.target.value)}
          className="min-h-10 w-[9.5rem] max-w-full rounded-xl border border-zinc-300 bg-white px-2.5 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
        />
        <Button
          variant="outline"
          className="min-h-10 px-3"
          aria-label="Next"
          onClick={() => setStart((s) => shiftDate(s, mode === "day" ? 7 : 1))}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  )

  const primaryAction =
    mode === "day" && canCreateBooking ? (
      <Button variant="primary" className="min-h-10" disabled={allocBusy} onClick={suggestAlloc}>
        <Sparkles className="size-4" aria-hidden />
        {allocBusy ? "Thinking..." : "Auto-assign arrivals"}
      </Button>
    ) : undefined

  const header = (
    <ScreenHeader
      title="Tape chart"
      context={
        mode === "day"
          ? data
            ? rangeLabel(data.dates)
            : "Loading…"
          : hourly
            ? dateLabel(hourly.date)
            : "Loading…"
      }
      stats={stats}
      nav={nav}
      primaryAction={primaryAction}
    />
  )

  const statusLegend = (
    <Legend
      items={[
        { swatch: "bg-brand-800", icon: BedDouble, iconClassName: "text-brand-800", label: "Occupied" },
        { swatch: "bg-brand-100", icon: Check, iconClassName: "text-brand-700", label: "Confirmed" },
        { swatch: "bg-gold-500", icon: Sparkles, iconClassName: "text-gold-600", label: "Needs cleaning" },
        { swatch: "bg-rose-500", icon: Wrench, iconClassName: "text-rose-600", label: "Out of service" },
      ]}
    />
  )

  const markerLegend = (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">
      <li className="inline-flex items-center gap-1.5">
        <Star className="size-3.5 fill-gold-400 text-gold-400" aria-hidden /> VIP
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-violet-400" aria-hidden /> Corporate
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-sky-300" aria-hidden /> Group
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-orange-300" aria-hidden /> OTA
      </li>
    </ul>
  )

  // shared bit: which booking / block sits on a given day (mobile list)
  const bookingOnDate = (room: TapeRoom, dateIso: string) =>
    room.bookings.find((b) =>
      b.is_day_use
        ? b.check_in_date === dateIso
        : b.check_in_date <= dateIso && dateIso < b.check_out_date,
    )
  const blockOnDate = (room: TapeRoom, dateIso: string) =>
    (room.blocks ?? []).find((k) => k.from_date <= dateIso && dateIso <= k.to_date)

  const filterBar =
    mode === "day" && data && data.rooms.length > 0 ? (
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {roomTypeNames.length > 1 && (
          <FilterSelect
            label="Room type"
            ariaLabel="Filter by room type"
            value={rtFilter}
            onChange={setRtFilter}
            allLabel="All room types"
          >
            {roomTypeNames.map((n) => (
              <option key={n} value={n}>
                {primaryLabel(n)}
              </option>
            ))}
          </FilterSelect>
        )}
        {floorNames.length > 0 && (
          <FilterSelect
            label="Floor"
            ariaLabel="Filter by floor"
            value={floorFilter}
            onChange={setFloorFilter}
            allLabel="All floors"
          >
            {floorNames.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </FilterSelect>
        )}
        <FilterSelect
          label="Status"
          ariaLabel="Filter by status"
          value={hkFilter}
          onChange={setHkFilter}
          allLabel="All statuses"
        >
          {["Clean", "Dirty", "Inspected", "Out of Order"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </FilterSelect>

        {activeFilters.map((f) => (
          <button
            key={f.key}
            onClick={f.clear}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-800 transition hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
          >
            {f.node}
            <X className="size-3.5" aria-hidden />
          </button>
        ))}
        {anyFilter && (
          <button
            onClick={clearAll}
            className="min-h-11 text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    ) : null

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
        {mode === "day" ? (
          !data ? (
            denied ? (
              <OnboardingEmptyState
                variant="denied"
                title="You don't have access to the tape chart"
                message="Your role can't open the room board. Ask a hotel administrator if you need it."
              />
            ) : loadError ? (
              <BoardError msg={loadError} onRetry={load} />
            ) : (
              <TapeSkeleton />
            )
          ) : (
            <>
              {loadError && <InlineRetry msg={loadError} onRetry={load} />}
              {filterBar}

              {/* back-to-back conflicts: an arrival lands before the room frees */}
              {(data.conflicts?.length ?? 0) > 0 && (
                <div className="mb-3 rounded-xl border border-gold-200 bg-gold-50 px-3 py-2.5 text-gold-800">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <TriangleAlert className="size-4 shrink-0" aria-hidden />
                    Changeover conflicts
                    <Badge tone="amber">{data.conflicts.length}</Badge>
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-gold-700">
                    {data.conflicts.slice(0, 4).map((c) => (
                      <li key={c.in_res}>
                        Room <bdi dir="ltr">{c.room_number}</bdi> ·{" "}
                        <bdi dir="ltr">{dateLabel(c.date)}</bdi> — out{" "}
                        <bdi dir="ltr">{c.etd}</bdi> ({c.out_guest}) / in{" "}
                        <bdi dir="ltr">{c.eta}</bdi> ({c.in_guest})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                {statusLegend}
                {markerLegend}
              </div>

              {groups.length === 0 ? (
                <BoardEmpty filtered={anyFilter} onClear={clearAll} />
              ) : (
                <>
                  {/* Desktop / tablet: the frozen-header + frozen-column grid */}
                  <div
                    className="hidden overflow-auto rounded-xl border border-zinc-200 bg-white shadow-sm lg:block"
                    style={{ maxHeight: "calc(100dvh - 17rem)" }}
                  >
                    <div className="relative" style={{ minWidth: LABEL_W + DAYS * CELL_W }}>
                      {/* sticky date header */}
                      <div className="sticky top-0 z-30">
                        <div className="flex border-b border-zinc-200 bg-zinc-50">
                          <div
                            style={{ width: LABEL_W }}
                            className="sticky start-0 z-10 flex shrink-0 items-end border-e border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500"
                          >
                            Room
                          </div>
                          {data.dates.map((d) => {
                            const day = new Date(d)
                            const weekend = day.getDay() === 0 || day.getDay() === 6
                            const isToday = d === todayIso
                            const p = posByDate.get(d)
                            const occ = p?.occupancy ?? 0
                            return (
                              <div
                                key={d}
                                style={{ width: CELL_W }}
                                className={cn(
                                  "shrink-0 border-s border-zinc-100 px-1 py-1.5 text-center",
                                  weekend && "bg-brand-50/40",
                                  isToday && "bg-brand-50 ring-1 ring-inset ring-brand-200",
                                )}
                              >
                                <div className={cn("text-[11px]", weekend ? "text-brand-700" : "text-zinc-500")}>
                                  {day.toLocaleDateString(dateLocale(), { weekday: "short" })}
                                </div>
                                <div className="text-sm font-bold tabular-nums text-zinc-800">
                                  {day.getDate()}
                                </div>
                                <div
                                  className={cn("mt-0.5 text-[10px] font-semibold tabular-nums", occTone(occ, p?.overbooked))}
                                  title={
                                    p
                                      ? `${p.sold}/${p.capacity} (${p.occupancy}%)` +
                                        (p.overbooked ? " · overbooked" : "") +
                                        (p.premium_pct ? ` · +${p.premium_pct}%` : "") +
                                        (p.min_rate ? ` · ${cur()}${p.min_rate.toLocaleString(moneyLocale())}` : "")
                                      : undefined
                                  }
                                >
                                  {occ}%
                                  {p?.premium_pct ? <span className="ms-0.5 text-emerald-600">▲</span> : null}
                                  {p?.overbooked ? <span className="ms-0.5 text-rose-600">OB</span> : null}
                                </div>
                                {isToday && (
                                  <div className="mt-0.5 inline-block rounded-full bg-brand-600 px-1.5 text-[9px] font-bold text-white">
                                    Today
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {groups.map((g) => {
                        const isCollapsed = collapsed.has(g.label)
                        const booked = g.rooms.filter((r) => r.bookings.length > 0).length
                        return (
                          <div key={g.key}>
                            <button
                              onClick={() => toggleGroup(g.label)}
                              style={{ minWidth: LABEL_W + DAYS * CELL_W }}
                              className="flex w-full items-center border-b border-zinc-200 bg-zinc-50/80 text-start hover:bg-zinc-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
                            >
                              <span className="sticky start-0 flex items-center gap-2 bg-zinc-50/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                                <ChevronDown
                                  className={cn("size-3.5 transition-transform", isCollapsed && "-rotate-90")}
                                  aria-hidden
                                />
                                <Bilingual value={g.label} primaryOnly />
                                <span className="font-normal normal-case tracking-normal text-zinc-400">
                                  {qty(g.rooms.length, "room")} · {booked} in use
                                </span>
                              </span>
                            </button>
                            {!isCollapsed &&
                              g.rooms.map((room) => (
                                <div key={room.name} className="relative flex min-h-14 border-b border-zinc-100">
                                  <div
                                    style={{ width: LABEL_W }}
                                    className="sticky start-0 z-20 flex shrink-0 items-center gap-2 border-e border-zinc-200 bg-white px-3"
                                  >
                                    <span
                                      className={cn("size-2 shrink-0 rounded-full", HK_DOT[room.housekeeping_status] || "bg-zinc-300")}
                                      aria-hidden
                                    />
                                    <span className="text-sm font-bold tabular-nums">
                                      <bdi dir="ltr">{room.room_number}</bdi>
                                    </span>
                                    <span className={cn("truncate text-[10px] font-medium uppercase", hkTextTone(room.housekeeping_status))}>
                                      {room.housekeeping_status}
                                    </span>
                                  </div>
                                  {data.dates.map((d) => {
                                    const isToday = d === todayIso
                                    return canCreateBooking ? (
                                      <button
                                        key={d}
                                        type="button"
                                        style={{ width: CELL_W }}
                                        onClick={() => openNewBooking({ room_type: room.room_type, date: d })}
                                        title="New booking"
                                        aria-label={`New booking · room ${room.room_number} · ${d}`}
                                        className={cn(
                                          "shrink-0 border-s border-zinc-100 transition hover:bg-brand-50 focus-visible:relative focus-visible:z-[5] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600",
                                          isToday && "bg-brand-50/40",
                                        )}
                                      />
                                    ) : (
                                      <div
                                        key={d}
                                        style={{ width: CELL_W }}
                                        className={cn("shrink-0 border-s border-zinc-100", isToday && "bg-brand-50/40")}
                                      />
                                    )
                                  })}
                                  {/* held-out-of-sale bands (house use, VIP, maintenance) */}
                                  {(room.blocks ?? []).map((k) => {
                                    const s = Math.max(0,
                                      (new Date(k.from_date).getTime() - new Date(data.start).getTime()) / 86_400_000)
                                    const e = Math.min(DAYS,
                                      (new Date(k.to_date).getTime() - new Date(data.start).getTime()) / 86_400_000)
                                    if (e <= 0 || s >= DAYS) return null
                                    return (
                                      <div
                                        key={k.name}
                                        style={{
                                          insetInlineStart: LABEL_W + s * CELL_W + 3,
                                          width: (e - s) * CELL_W - 6,
                                          backgroundImage:
                                            "repeating-linear-gradient(45deg, #FBECEA 0 6px, #F5D9D5 6px 12px)",
                                        }}
                                        className="absolute inset-y-1.5 z-10 flex items-center gap-1 truncate rounded-lg border border-rose-200 px-2 text-start text-[11px] font-semibold text-rose-700"
                                        title={`${k.reason}${k.note ? ` · ${k.note}` : ""} · ${k.from_date} → ${k.to_date}`}
                                      >
                                        <Wrench className="size-3 shrink-0" aria-hidden />
                                        <span className="truncate">{k.reason}</span>
                                      </div>
                                    )
                                  })}
                                  {/* booking bars */}
                                  {room.bookings.map((b) => {
                                    const s = Math.max(0,
                                      (new Date(b.check_in_date).getTime() - new Date(data.start).getTime()) / 86_400_000)
                                    const rawEnd = (new Date(b.check_out_date).getTime() - new Date(data.start).getTime()) / 86_400_000
                                    const e = Math.min(DAYS, b.is_day_use ? s + 1 : rawEnd)
                                    if (e <= 0 || s >= DAYS) return null
                                    const occupied = b.status === "Checked In"
                                    const seg = segment(b)
                                    const eta = hhmm(b.planned_check_in_time)
                                    const etd = hhmm(b.planned_check_out_time)
                                    const inConflict = data.conflicts?.some(
                                      (c) => c.in_res === b.name || c.out_res === b.name)
                                    const Icon = occupied ? BedDouble : Check
                                    return (
                                      <button
                                        key={b.name}
                                        onClick={() => openBooking(b)}
                                        style={{ insetInlineStart: LABEL_W + s * CELL_W + 3, width: (e - s) * CELL_W - 6 }}
                                        className={cn(
                                          "absolute inset-y-1.5 z-10 flex items-center gap-1 truncate rounded-lg px-2 text-start text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600",
                                          occupied
                                            ? "bg-brand-800 text-white hover:bg-brand-900"
                                            : "bg-brand-100 text-brand-900 ring-1 ring-inset ring-brand-200 hover:bg-brand-200",
                                          inConflict && "ring-2 ring-rose-500",
                                        )}
                                        title={`${b.guest_name} · ${seg.label} · ${b.check_in_date}${eta ? ` ${eta}` : ""} → ${b.check_out_date}${etd ? ` ${etd}` : ""}` +
                                          (inConflict ? " · changeover conflict" : "")}
                                      >
                                        <Icon className="size-3.5 shrink-0" aria-hidden />
                                        {b.vip ? (
                                          <Star className="size-3 shrink-0 fill-gold-400 text-gold-400" aria-hidden />
                                        ) : (
                                          <span className={cn("size-1.5 shrink-0 rounded-full", seg.dot)} aria-hidden />
                                        )}
                                        <span className="truncate" dir="auto">
                                          {eta && <span className="me-1 font-normal opacity-75">{eta}</span>}
                                          {b.guest_name}
                                        </span>
                                        {etd && e - s >= 2 && (
                                          <span className="ms-auto shrink-0 font-normal opacity-75">{etd}</span>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Mobile: pick a day, read the rooms as a list */}
                  <div className="lg:hidden">
                    <div
                      className="mb-3 flex gap-1.5 overflow-x-auto pb-1"
                      role="tablist"
                      aria-label="Pick a date"
                    >
                      {data.dates.map((d, i) => {
                        const day = new Date(d)
                        const active = i === Math.min(mobileDay, data.dates.length - 1)
                        const occ = posByDate.get(d)?.occupancy ?? 0
                        return (
                          <button
                            key={d}
                            role="tab"
                            aria-selected={active}
                            onClick={() => setMobileDay(i)}
                            className={cn(
                              "flex min-h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-xl border px-2.5 py-1 text-xs tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600",
                              active
                                ? "border-brand-600 bg-brand-50 text-brand-800"
                                : "border-zinc-200 text-zinc-500 hover:border-zinc-300",
                            )}
                          >
                            <span>{day.toLocaleDateString(dateLocale(), { weekday: "short" })}</span>
                            <span className="text-sm font-semibold">{day.getDate()}</span>
                            <span className="text-[9px] font-semibold text-zinc-400">{occ}%</span>
                          </button>
                        )
                      })}
                    </div>

                    {(() => {
                      const selDate = data.dates[Math.min(mobileDay, data.dates.length - 1)]
                      return (
                        <div className="space-y-4">
                          {groups.map((g) => (
                            <div key={g.key}>
                              <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                <Bilingual value={g.label} primaryOnly />
                                <span className="font-normal normal-case tracking-normal text-zinc-400">
                                  {qty(g.rooms.length, "room")}
                                </span>
                              </h3>
                              <ul className="space-y-2">
                                {g.rooms.map((room) => {
                                  const b = bookingOnDate(room, selDate)
                                  const blk = !b && blockOnDate(room, selDate)
                                  const occupied = b?.status === "Checked In"
                                  const onClick = b
                                    ? () => openBooking(b)
                                    : !blk && canCreateBooking
                                      ? () => openNewBooking({ room_type: room.room_type, date: selDate })
                                      : undefined
                                  const Tag = onClick ? "button" : "div"
                                  return (
                                    <li key={room.name}>
                                      <Tag
                                        {...(onClick ? { type: "button" as const, onClick } : {})}
                                        className={cn(
                                          "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-start",
                                          onClick &&
                                            "transition-colors hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600",
                                        )}
                                      >
                                        <span className="flex min-w-0 items-center gap-2.5">
                                          <span
                                            className={cn("size-2.5 shrink-0 rounded-full", HK_DOT[room.housekeeping_status] || "bg-zinc-300")}
                                            aria-hidden
                                          />
                                          <span className="min-w-0">
                                            <span className="block text-sm font-bold tabular-nums">
                                              <bdi dir="ltr">{room.room_number}</bdi>
                                            </span>
                                            <span className={cn("block text-[11px] font-medium uppercase", hkTextTone(room.housekeeping_status))}>
                                              {room.housekeeping_status}
                                            </span>
                                          </span>
                                        </span>
                                        {b ? (
                                          <span className="flex min-w-0 items-center gap-2">
                                            {b.vip === 1 && (
                                              <Star className="size-3.5 shrink-0 fill-gold-400 text-gold-400" aria-hidden />
                                            )}
                                            <span className="truncate text-sm font-medium" dir="auto">
                                              {b.guest_name}
                                            </span>
                                            <Badge tone={occupied ? "brand" : "sky"}>
                                              {occupied ? "Occupied" : "Confirmed"}
                                            </Badge>
                                          </span>
                                        ) : blk ? (
                                          <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                                            <Wrench className="size-3.5" aria-hidden />
                                            Out of service
                                          </span>
                                        ) : (
                                          <span className="text-xs font-medium text-zinc-400">Vacant</span>
                                        )}
                                      </Tag>
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </>
              )}

              <p className="mt-3 text-xs text-zinc-400">
                Click a bar to move rooms or change dates.
              </p>
            </>
          )
        ) : /* hour mode */ !hourly ? (
          denied ? (
            <OnboardingEmptyState
              variant="denied"
              title="You don't have access to the tape chart"
              message="Your role can't open the room board. Ask a hotel administrator if you need it."
            />
          ) : loadError ? (
            <BoardError msg={loadError} onRetry={load} />
          ) : (
            <TapeSkeleton />
          )
        ) : (
          <>
            {loadError && <InlineRetry msg={loadError} onRetry={load} />}
            <div className="mb-3">{statusLegend}</div>
            <TapeHourly data={hourly} onOpen={openBooking} />
          </>
        )}
      </div>

      {alloc && (
        <Sheet
          title="Auto-assign arrivals"
          description={`Suggested room plan for ${alloc.date}`}
          onClose={() => setAlloc(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAlloc(null)}>Close</Button>
              {alloc.proposals.length > 0 && (
                <Button disabled={allocBusy} onClick={applyAlloc}>
                  {allocBusy ? "Assigning..." : `Assign ${alloc.proposals.length} room${alloc.proposals.length === 1 ? "" : "s"}`}
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-3">
            {alloc.proposals.length === 0 && alloc.unfittable.length === 0 && (
              <p className="text-sm text-zinc-500">
                Every arrival for this day already has a room.
              </p>
            )}
            {alloc.proposals.map((p) => (
              <div key={p.reservation}
                className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    {p.vip === 1 && (
                      <Star className="size-3.5 fill-gold-400 text-gold-400" />
                    )}
                    {p.guest_name}
                    <span className="text-xs font-normal text-zinc-400">
                      · {p.room_type_name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">{p.why}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">Room {p.room_number}</div>
                  {p.needs_review === 1 && (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-gold-600">
                      Review
                    </span>
                  )}
                </div>
              </div>
            ))}
            {alloc.unfittable.map((u) => (
              <div key={u.reservation}
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {u.guest_name} - {u.reason}
              </div>
            ))}
            <p className="text-xs text-zinc-400">
              Rooms are matched to each guest's type and preferences. Assigning
              places them now; "Review" flags a choice worth a second look.
            </p>
          </div>
        </Sheet>
      )}

      {sel && (
        <Sheet
          title={sel.guest_name}
          description={`${sel.name} · ${sel.status}`}
          onClose={() => setSel(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSel(null)}>Close</Button>
              {draft.room !== sel.room && (
                <Button disabled={busy}
                  onClick={() => act(() => call("hotelpms.api.move_reservation",
                    { reservation: sel.name, new_room: draft.room }))}>
                  Move room
                </Button>
              )}
              {(draft.check_in !== sel.check_in_date ||
                draft.check_out !== sel.check_out_date) && (
                <Button disabled={busy}
                  onClick={() => act(() => call("hotelpms.api.amend_stay",
                    { reservation: sel.name, check_in_date: draft.check_in,
                      check_out_date: draft.check_out }))}>
                  Update stay
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-600">Room</span>
              <select className={inputCls} value={draft.room}
                onChange={(e) => setDraft({ ...draft, room: e.target.value })}>
                {freeRooms.map((r) => (
                  <option key={r} value={r}>Room {r.split("-").pop()}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-zinc-600">Check-in</span>
                <input type="date" className={inputCls} value={draft.check_in}
                  onChange={(e) => setDraft({ ...draft, check_in: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-zinc-600">Check-out</span>
                <input type="date" className={inputCls} value={draft.check_out}
                  onChange={(e) => setDraft({ ...draft, check_out: e.target.value })} />
              </label>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <span className="mb-2 block text-sm font-medium text-zinc-600">
                {sel.is_day_use === 1 ? "Day-use hours" : "Arrival / departure times (ETA · ETD)"}
              </span>
              <div className="flex items-end gap-2">
                <input type="time" className={inputCls} value={draft.from_time}
                  onChange={(e) => setDraft({ ...draft, from_time: e.target.value })} />
                <span className="pb-2 text-zinc-400">to</span>
                <input type="time" className={inputCls} value={draft.to_time}
                  onChange={(e) => setDraft({ ...draft, to_time: e.target.value })} />
                <Button variant="outline" disabled={busy}
                  onClick={() => act(() => call("hotelpms.api.set_stay_times", {
                    reservation: sel.name, eta: draft.from_time,
                    etd: draft.to_time }))}>
                  Set
                </Button>
              </div>
              {sel.is_day_use !== 1 && (
                <p className="mt-1.5 text-xs text-zinc-400">
                  Times drive the house position: back-to-back rooms flag a
                  conflict when the arrival lands before the departure.
                </p>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              Date changes re-price automatically (unless the booking holds a
              manual amount) and the double-booking guard re-checks the room.
            </p>
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}
          </div>
        </Sheet>
      )}
    </div>
  )
}

/** Single-day, rooms x hours. Day-use bookings sit at their planned times;
 *  overnight stays crossing the day show as a full-width occupied band. */
function TapeHourly({
  data,
  onOpen,
}: {
  data: HourlyData
  onOpen: (b: TapeBooking) => void
}) {
  const hours: number[] = []
  for (let h = data.start_hour; h <= data.end_hour; h++) hours.push(h)
  const span = data.end_hour - data.start_hour || 1
  const hourW = 56
  const gridW = hours.length * hourW

  const left = (t?: string) =>
    ((hhmmToNum(t) - data.start_hour) / span) * gridW
  const width = (from?: string, to?: string) =>
    Math.max(hourW * 0.6, ((hhmmToNum(to) - hhmmToNum(from)) / span) * gridW)

  return (
    <div
      className="overflow-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
      style={{ maxHeight: "calc(100dvh - 17rem)" }}
    >
      <div className="relative" style={{ minWidth: LABEL_W + gridW }}>
        <div className="sticky top-0 z-30 flex border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500">
          <div
            style={{ width: LABEL_W }}
            className="sticky start-0 z-10 shrink-0 border-e border-zinc-200 bg-zinc-50 px-3 py-2"
          >
            Room
          </div>
          {hours.map((h) => (
            <div
              key={h}
              style={{ width: hourW }}
              className="shrink-0 border-s border-zinc-100 px-1 py-2 text-center tabular-nums"
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {data.rooms.map((room) => (
          <div key={room.name} className="relative flex min-h-14 border-b border-zinc-100">
            <div
              style={{ width: LABEL_W }}
              className="sticky start-0 z-20 flex shrink-0 items-center gap-2 border-e border-zinc-200 bg-white px-3"
            >
              <span
                className={cn("size-2 shrink-0 rounded-full", HK_DOT[room.housekeeping_status] || "bg-zinc-300")}
                aria-hidden
              />
              <span className="text-sm font-bold tabular-nums">
                <bdi dir="ltr">{room.room_number}</bdi>
              </span>
            </div>
            {hours.map((h) => (
              <div key={h} style={{ width: hourW }} className="shrink-0 border-s border-zinc-100" />
            ))}
            {room.bookings.map((b) => {
              const occupied = b.status === "Checked In"
              if (b.overnight) {
                return (
                  <button
                    key={b.name}
                    onClick={() => onOpen(b)}
                    style={{ insetInlineStart: LABEL_W, width: gridW }}
                    className="absolute inset-y-2 z-10 flex items-center gap-1 rounded-lg bg-zinc-100 px-2 text-start text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
                    title={`${b.guest_name} · staying over`}
                  >
                    {b.vip ? (
                      <Star className="size-3 shrink-0 fill-gold-400 text-gold-400" aria-hidden />
                    ) : (
                      <BedDouble className="size-3.5 shrink-0" aria-hidden />
                    )}
                    <span className="truncate" dir="auto">{b.guest_name} · staying over</span>
                  </button>
                )
              }
              return (
                <button
                  key={b.name}
                  onClick={() => onOpen(b)}
                  style={{ insetInlineStart: LABEL_W + left(b.from_hour) + 3, width: width(b.from_hour, b.to_hour) - 6 }}
                  className={cn(
                    "absolute inset-y-2 z-10 flex items-center gap-1 truncate rounded-lg px-2 text-start text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600",
                    occupied
                      ? "bg-brand-800 text-white hover:bg-brand-900"
                      : "bg-brand-100 text-brand-900 ring-1 ring-inset ring-brand-200 hover:bg-brand-200",
                  )}
                  title={`${b.guest_name} · ${b.from_hour}-${b.to_hour} · day use`}
                >
                  {b.vip ? (
                    <Star className="size-3 shrink-0 fill-gold-400 text-gold-400" aria-hidden />
                  ) : occupied ? (
                    <BedDouble className="size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <Check className="size-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="truncate" dir="auto">
                    {b.guest_name} · {b.from_hour}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
