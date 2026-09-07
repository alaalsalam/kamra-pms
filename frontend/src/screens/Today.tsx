import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useNavigate, useOutletContext } from "react-router-dom"
import {
  BadgeCheck,
  BedDouble,
  Brush,
  CalendarDays,
  CircleAlert,
  DoorClosed,
  DoorOpen,
  Gauge,
  Link2,
  LogIn,
  LogOut,
  Sparkles,
  Users,
  Wallet,
  Wrench,
} from "lucide-react"
import { qty, useT } from "../lib/i18n"
import {
  call,
  checkOut,
  getCurrentProperty,
  getSnapshot,
  isAuthError,
  setHousekeepingStatus,
  type ReservationRow,
  type Snapshot,
} from "../lib/api"
import { serverError } from "../lib/resource"
import { cur, moneyLocale, dateLocale } from "../lib/money"
import { cn } from "../lib/utils"
import { useAuth } from "../lib/auth"
import { useEnabledModules } from "../lib/modules"
import { canAccessPath } from "../lib/apps"
import type { ShellContext } from "../AppShell"
import { ScreenHeader, type HeaderStat } from "../components/ScreenHeader"
import { QueueCard } from "../components/QueueCard"
import { OnboardingEmptyState } from "../components/OnboardingEmptyState"
import { Legend } from "../components/Legend"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Avatar } from "../components/ui/avatar"
import CheckInDialog from "../components/CheckInDialog"

/** Dashboard payload — only the fields Today reads; the endpoint returns more. */
interface DashboardKpi {
  revenue_today?: number
  statistics?: { revpar?: number }
  housekeeping?: {
    open_tasks?: number
    overdue_tasks?: number
    room_status?: Record<string, number>
  }
}

// Tap-to-advance order. "Ready" (a room cleaned, inspected and released for
// sale) sits after Inspected. Keyed as string[] because the locked api.ts
// RoomRow union is stale and omits "Ready".
const HK_CYCLE: string[] = [
  "Dirty",
  "Clean",
  "Inspected",
  "Ready",
  "Out of Order",
]

// Housekeeping readiness — same semantic vocabulary as screens/roomCells.tsx
// (package-0): colour + icon + text, never colour alone. Record<string> +
// fallback so a status outside the stale api.ts union (e.g. "Ready") can never
// crash the cockpit.
type HkMeta = { icon: typeof Sparkles; chip: string; swatch: string; ink: string }
const HK_META: Record<string, HkMeta> = {
  Ready: { icon: DoorOpen, chip: "border-brand-200 bg-brand-50 text-brand-800", swatch: "bg-brand-500", ink: "text-brand-600" },
  Clean: { icon: Sparkles, chip: "border-emerald-200 bg-emerald-50 text-emerald-800", swatch: "bg-emerald-500", ink: "text-emerald-600" },
  Inspected: { icon: BadgeCheck, chip: "border-sky-200 bg-sky-50 text-sky-800", swatch: "bg-sky-500", ink: "text-sky-600" },
  Dirty: { icon: Brush, chip: "border-amber-200 bg-amber-50 text-amber-800", swatch: "bg-amber-500", ink: "text-amber-600" },
  "Out of Order": { icon: Wrench, chip: "border-rose-200 bg-rose-50 text-rose-800", swatch: "bg-rose-500", ink: "text-rose-600" },
}
const HK_FALLBACK: HkMeta = { icon: DoorClosed, chip: "border-zinc-200 bg-zinc-50 text-zinc-700", swatch: "bg-zinc-400", ink: "text-zinc-500" }

const inr0 = (n: number) =>
  Number(n).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

const roomNo = (room: string) => room.split("-").pop() ?? room
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name

/** Paid / due / unpaid at a glance — the folio is the source of truth, this
 * chip just saves the trip to Billing. Words are observer-translated; the
 * amount is bidi-isolated so it reads correctly inside RTL. */
function paymentChip(row: ReservationRow) {
  const paid = Number(row.paid_total ?? 0)
  const due = Number(row.balance_due ?? 0)
  if (due <= 0 && paid > 0) return <Badge tone="green">Paid</Badge>
  if (paid > 0)
    return (
      <Badge tone="amber">
        <bdi dir="ltr">{cur()}{inr0(due)}</bdi> due
      </Badge>
    )
  if (due > 0) return <Badge tone="zinc">Unpaid</Badge>
  return null
}

function sourceBadge(row: ReservationRow) {
  if (row.source === "AI Agent") return <Badge tone="brand">AI Agent</Badge>
  if (row.source === "OTA")
    return <Badge tone="indigo">{row.channel || "OTA"}</Badge>
  return <Badge tone="zinc">{row.source}</Badge>
}

function relDay(dateStr: string, today?: string) {
  const base = today ? new Date(today + "T00:00:00") : new Date()
  const d = Math.round(
    (new Date(dateStr + "T00:00:00").getTime() - base.getTime()) / 86_400_000,
  )
  if (d <= 0) return "Today"
  if (d === 1) return "Tomorrow"
  return `In ${d} days`
}

/** Meta line under a guest name — each token is its own text node so the live
 * translator localises counts (UNIT map) and labels independently. */
function MetaLine({ items }: { items: ReactNode[] }) {
  const parts = items.filter(Boolean)
  if (!parts.length) return null
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-500">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className="text-zinc-300">·</span>}
          {p}
        </span>
      ))}
    </div>
  )
}

/** The tappable identity block (avatar + name + status badges + meta), wrapped
 * in a real <Link> to the guest's registration card — keyboard-operable and
 * right-clickable, unlike a row onClick. Action buttons live as siblings, never
 * nested inside the anchor. */
function GuestLink({ row, meta }: { row: ReservationRow; meta: ReactNode[] }) {
  return (
    <Link
      to={`/grc/${row.name}`}
      className="group -mx-2 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <Avatar name={row.guest_name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-zinc-800">
            {row.guest_name}
          </span>
          {sourceBadge(row)}
          {paymentChip(row)}
          {row.precheckin_status === "Submitted" && (
            <Badge tone="green">Pre-checked-in</Badge>
          )}
        </div>
        <MetaLine items={meta} />
      </div>
    </Link>
  )
}

function roomMeta(row: ReservationRow) {
  return row.room ? (
    <span>
      Room <bdi dir="ltr">{roomNo(row.room)}</bdi>
    </span>
  ) : (
    <span className="font-medium text-amber-700">Unassigned</span>
  )
}

function TodaySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading today">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100" />
    </div>
  )
}

export default function Today() {
  const { t } = useT()
  const { refreshKey, openBooking, canCreateBooking } =
    useOutletContext<ShellContext>()
  const navigate = useNavigate()
  const { roles } = useAuth()
  const modules = useEnabledModules()
  // A tile/link points to its screen only when the role + enabled modules allow
  // it; otherwise the caller passes `undefined` and it renders non-clickable.
  const linkTo = (path: string, query = "") =>
    canAccessPath(path, roles, modules) ? path + query : undefined
  const scrollTo = (id: string) => () =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })

  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [kpi, setKpi] = useState<DashboardKpi | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [checkingIn, setCheckingIn] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [s, k] = await Promise.all([
        getSnapshot(),
        call<DashboardKpi>("hotelpms.dashboards.property_dashboard", {
          property: getCurrentProperty(),
        }).catch(() => null),
      ])
      setSnap(s)
      setKpi(k)
      setError(null)
      setDenied(false)
    } catch (e) {
      if (isAuthError(e)) setDenied(true)
      else setError(serverError(e))
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [refresh, refreshKey])

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key)
    try {
      await fn()
      await refresh()
    } catch (e) {
      setError(serverError(e))
    } finally {
      setBusy(null)
    }
  }

  const arrivals = snap?.arrivals ?? []
  const departures = snap?.departures ?? []
  const inHouse = snap?.in_house ?? []
  const rooms = snap?.rooms ?? []
  const occupied = rooms.filter((r) => r.occupancy_status === "Occupied").length
  const roomsN = rooms.length
  const occupancyPct = roomsN ? Math.round((occupied / roomsN) * 100) : 0
  const dirtyN = rooms.filter((r) => r.housekeeping_status === "Dirty").length
  const overdueN = Number(kpi?.housekeeping?.overdue_tasks ?? 0)

  const stats: HeaderStat[] = [
    { key: "arr", label: "Arrivals", value: arrivals.length, icon: LogIn, tone: "sky", to: linkTo("/reservations") },
    { key: "dep", label: "Departures", value: departures.length, icon: LogOut, tone: "gold", to: linkTo("/reservations") },
    { key: "inh", label: "In-house", value: inHouse.length, icon: Users, tone: "brand", to: linkTo("/reservations") },
    { key: "occ", label: "Occupancy", value: `${occupancyPct}%`, meter: occupancyPct, hint: `${occupied} of ${roomsN} rooms`, icon: Gauge, tone: "brand", to: linkTo("/tape") },
    { key: "clean", label: "To clean", value: dirtyN, icon: Sparkles, tone: "gold", to: linkTo("/housekeeping") },
  ]

  // "Needs your attention now" — real, permission-aware, most urgent first.
  const departuresDue = departures.filter((r) => Number(r.balance_due ?? 0) > 0)
  const dueTotal = departuresDue.reduce((s, r) => s + Number(r.balance_due ?? 0), 0)
  const unassignedArrivals = arrivals.filter((r) => !r.room)

  type Q = {
    key: string
    icon: typeof LogIn
    tone: "teal" | "amber" | "danger"
    title: ReactNode
    detail: ReactNode
    to?: string
    action?: string
    onClick?: () => void
  }
  const queue: Q[] = []
  if (departuresDue.length)
    queue.push({
      key: "due",
      icon: Wallet,
      tone: "amber",
      title: <><bdi dir="ltr">{departuresDue.length}</bdi> {t("departures with a balance")}</>,
      detail: <><bdi dir="ltr">{cur()}{inr0(dueTotal)}</bdi> {t("to collect before checkout")}</>,
      onClick: scrollTo("today-departures"),
    })
  if (overdueN)
    queue.push({
      key: "overdue",
      icon: CircleAlert,
      tone: "danger",
      title: <><bdi dir="ltr">{overdueN}</bdi> {t("overdue tasks")}</>,
      detail: t("Rooms are past their cleaning SLA"),
      to: linkTo("/housekeeping", "?status=Pending"),
      action: t("Open board"),
    })
  if (dirtyN)
    queue.push({
      key: "dirty",
      icon: Brush,
      tone: "amber",
      title: <><bdi dir="ltr">{dirtyN}</bdi> {t("rooms to clean")}</>,
      detail: t("Ready them for today's arrivals"),
      to: linkTo("/housekeeping"),
      action: t("Open board"),
    })
  if (unassignedArrivals.length)
    queue.push({
      key: "unassigned",
      icon: BedDouble,
      tone: "teal",
      title: <><bdi dir="ltr">{unassignedArrivals.length}</bdi> {t("arrivals need a room")}</>,
      detail: t("Assign a room before check-in"),
      onClick: scrollTo("today-arrivals"),
    })
  if (arrivals.length)
    queue.push({
      key: "arrivals",
      icon: LogIn,
      tone: "teal",
      title: <><bdi dir="ltr">{arrivals.length}</bdi> {t("arrivals expected today")}</>,
      detail: t("Prepare the next check-ins"),
      onClick: scrollTo("today-arrivals"),
    })
  const queueShown = queue.slice(0, 3)

  const prettyDate = snap?.date
    ? new Date(snap.date + "T00:00:00").toLocaleDateString(dateLocale(), {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : ""

  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true })),
    [rooms],
  )

  const header = (
    <ScreenHeader
      title={t("Today")}
      context={prettyDate || undefined}
      stats={snap ? stats : undefined}
      primaryAction={
        canCreateBooking ? (
          <Button variant="primary" className="min-h-11" onClick={() => openBooking({})}>
            <CalendarDays className="size-4" aria-hidden /> New booking
          </Button>
        ) : undefined
      }
    />
  )

  // First paint before any data resolves (or a hard failure / permission wall).
  if (!snap) {
    return (
      <div className="space-y-4">
        {header}
        {denied ? (
          <OnboardingEmptyState
            variant="denied"
            title={t("You don't have access to the front desk")}
            message={t("This home is for reception and management. Ask a hotel administrator if you need access.")}
          />
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm font-medium text-rose-700">{error}</p>
              <Button variant="outline" className="mt-3 min-h-11" onClick={() => refresh()}>
                {t("Try again")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <TodaySkeleton />
        )}
      </div>
    )
  }

  // A fresh property with no rooms configured — guide setup instead of an empty
  // board. The CTA is gated: front desk sees guidance, an admin sees the button.
  if (roomsN === 0 && !arrivals.length && !departures.length && !inHouse.length) {
    return (
      <div className="space-y-4">
        {header}
        <OnboardingEmptyState
          icon={BedDouble}
          title={t("No rooms added yet")}
          message={t("Add rooms to start managing arrivals, departures and housekeeping.")}
          cta={{ label: t("Add rooms"), to: "/rooms" }}
          gatedNote={t("Ask a hotel administrator to add rooms.")}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {header}

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          <span>{error}</span>
          <button className="min-h-11 shrink-0 font-semibold underline" onClick={() => refresh()}>
            {t("Retry")}
          </button>
        </div>
      )}

      {/* Needs attention — the "what do I do now" band, priority order. */}
      <section aria-labelledby="attn-title">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="attn-title" className="text-[13px] font-bold text-zinc-900">
            {t("Needs your attention now")}
          </h2>
          {queueShown.length > 0 && (
            <span className="rounded-lg bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-500">
              {t("Priority order")}
            </span>
          )}
        </div>
        {queueShown.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {queueShown.map((q) => (
              <QueueCard
                key={q.key}
                icon={q.icon}
                tone={q.tone}
                title={q.title}
                detail={q.detail}
                to={q.to}
                action={q.action}
                onClick={q.onClick}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <Sparkles className="size-4 shrink-0" aria-hidden />
            {t("You're all caught up — nothing urgent right now")}
          </div>
        )}
      </section>

      {/* Two core front-desk tasks, side by side. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="today-arrivals" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Arrivals to check in</CardTitle>
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <LogIn className="size-4" aria-hidden />
              <bdi dir="ltr">{arrivals.length}</bdi>
            </span>
          </CardHeader>
          <CardContent className="pt-1">
            {arrivals.length ? (
              <ul className="divide-y divide-zinc-100">
                {arrivals.map((row) => {
                  const canCopy =
                    row.status === "Confirmed" &&
                    row.precheckin_status !== "Submitted" &&
                    row.precheckin_token
                  return (
                    <li key={row.name} className="flex items-center gap-2 py-1">
                      <GuestLink
                        row={row}
                        meta={[
                          roomMeta(row),
                          qty(row.nights, "night"),
                          qty(row.adults, "adult"),
                          row.children > 0 && qty(row.children, "child"),
                          row.eta && <span>ETA <bdi dir="ltr">{row.eta}</bdi></span>,
                          row.booked_by_name && (
                            <span
                              title={
                                (row.booked_by_phone ? `${row.booked_by_phone} · ` : "") +
                                `send links & updates to: ${row.contact_preference ?? "Booker"}`
                              }
                            >
                              via {row.booked_by_name}
                              {row.booker_relation ? ` (${row.booker_relation})` : ""}
                            </span>
                          ),
                        ]}
                      />
                      {canCopy && (
                        <button
                          className="grid size-11 shrink-0 place-items-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                          title={t("copy check-in link")}
                          aria-label={t("copy check-in link")}
                          onClick={() =>
                            navigator.clipboard.writeText(
                              `${window.location.origin}/checkin/${row.precheckin_token}`,
                            )
                          }
                        >
                          <Link2 className="size-4" aria-hidden />
                        </button>
                      )}
                      {canCreateBooking && (
                        <Button
                          className="min-h-11 shrink-0"
                          disabled={busy === row.name}
                          onClick={() => setCheckingIn(row.name)}
                        >
                          Check in
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-1 py-6 text-center text-sm text-zinc-400">
                No arrivals expected today.
              </p>
            )}
          </CardContent>
        </Card>

        <Card id="today-departures" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Departures to check out</CardTitle>
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <LogOut className="size-4" aria-hidden />
              <bdi dir="ltr">{departures.length}</bdi>
            </span>
          </CardHeader>
          <CardContent className="pt-1">
            {departures.length ? (
              <ul className="divide-y divide-zinc-100">
                {departures.map((row) => (
                  <li key={row.name} className="flex items-center gap-2 py-1">
                    <GuestLink
                      row={row}
                      meta={[roomMeta(row), qty(row.nights, "night")]}
                    />
                    {canCreateBooking && (
                      <Button
                        variant="outline"
                        className="min-h-11 shrink-0"
                        disabled={busy === row.name}
                        onClick={() => act(row.name, () => checkOut(row.name))}
                      >
                        Check out
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 py-6 text-center text-sm text-zinc-400">
                No departures due today.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* House right now — who is staying + live room readiness. */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card id="today-inhouse" className="scroll-mt-20 lg:col-span-2">
          <CardHeader>
            <CardTitle>In-house guests</CardTitle>
            <span className="text-xs text-zinc-400">{qty(inHouse.length, "guest")}</span>
          </CardHeader>
          <CardContent className="pt-1">
            {inHouse.length ? (
              <ul className="divide-y divide-zinc-100">
                {inHouse.map((row) => (
                  <li key={row.name} className="flex items-center gap-2 py-1">
                    <GuestLink
                      row={row}
                      meta={[
                        roomMeta(row),
                        <span>
                          Check-out <bdi dir="ltr">{row.check_out_date}</bdi>
                        </span>,
                        relDay(row.check_out_date, snap.date),
                      ]}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 py-6 text-center text-sm text-zinc-400">
                Nobody is checked in right now.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Room status</CardTitle>
            <span className="text-xs text-zinc-400">
              {t("Click a room for a quick action")}
            </span>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sortedRooms.map((room) => {
                const stay =
                  room.occupancy_status === "Occupied"
                    ? inHouse.find((r) => r.room === room.name)
                    : undefined
                if (stay) {
                  return (
                    <button
                      key={room.name}
                      onClick={() => navigate(`/grc/${stay.name}`)}
                      title={`${stay.guest_name} · ${t("Occupied")}`}
                      aria-label={`Room ${room.room_number} — ${stay.guest_name}, open registration`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-700 bg-brand-700 px-3 py-1.5 text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                    >
                      <BedDouble className="size-4 shrink-0" aria-hidden />
                      <bdi dir="ltr" className="text-sm font-semibold">{room.room_number}</bdi>
                      <span className="max-w-24 truncate text-xs text-brand-100">
                        {firstName(stay.guest_name)}
                      </span>
                    </button>
                  )
                }
                const meta = HK_META[room.housekeeping_status] ?? HK_FALLBACK
                const Icon = meta.icon
                const cur = HK_CYCLE.indexOf(room.housekeeping_status)
                const next = HK_CYCLE[(cur < 0 ? 0 : cur + 1) % HK_CYCLE.length]
                return (
                  <button
                    key={room.name}
                    disabled={busy === room.name}
                    onClick={() => act(room.name, () => setHousekeepingStatus(room.name, next))}
                    title={`${room.housekeeping_status} → ${next}`}
                    aria-label={`Room ${room.room_number} — ${room.housekeeping_status}, advance housekeeping`}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-1.5 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50",
                      meta.chip,
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <bdi dir="ltr" className="text-sm font-semibold">{room.room_number}</bdi>
                    <span className="text-xs opacity-80">{room.housekeeping_status}</span>
                  </button>
                )
              })}
            </div>
            <Legend
              className="mt-4"
              items={[
                { swatch: "bg-brand-700", icon: BedDouble, iconClassName: "text-brand-700", label: "Occupied" },
                { swatch: HK_META.Ready.swatch, icon: HK_META.Ready.icon, iconClassName: HK_META.Ready.ink, label: "Ready" },
                { swatch: HK_META.Clean.swatch, icon: HK_META.Clean.icon, iconClassName: HK_META.Clean.ink, label: "Clean" },
                { swatch: HK_META.Inspected.swatch, icon: HK_META.Inspected.icon, iconClassName: HK_META.Inspected.ink, label: "Inspected" },
                { swatch: HK_META.Dirty.swatch, icon: HK_META.Dirty.icon, iconClassName: HK_META.Dirty.ink, label: "Dirty" },
                { swatch: HK_META["Out of Order"].swatch, icon: HK_META["Out of Order"].icon, iconClassName: HK_META["Out of Order"].ink, label: "Out of Order" },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {checkingIn && (
        <CheckInDialog
          reservation={checkingIn}
          onClose={() => setCheckingIn(null)}
          onDone={() => {
            setCheckingIn(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}
