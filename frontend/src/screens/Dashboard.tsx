import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useRealtime } from "../lib/realtime"
import {
  ArrowUpRight,
  BadgePercent,
  BarChart3,
  BedDouble,
  Brush,
  Building2,
  CalendarRange,
  CircleAlert,
  Gauge,
  LogIn,
  LogOut,
  SaudiRiyal,
  Sparkles,
  BadgeCheck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react"
import { call, getCurrentProperty, isAuthError } from "../lib/api"
import { serverError } from "../lib/resource"
import { useAuth } from "../lib/auth"
import { useEnabledModules } from "../lib/modules"
import { canAccessPath } from "../lib/apps"
import type { ShellContext } from "../AppShell"
import { Bilingual } from "../components/Bilingual"
import { ScreenHeader, type HeaderStat } from "../components/ScreenHeader"
import { OnboardingEmptyState } from "../components/OnboardingEmptyState"
import { Legend } from "../components/Legend"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import {
  PaceChart,
  CompositionBar,
  BarList,
  type PacePoint,
  type CompositionSegment,
  type BarItem,
} from "../components/ui/charts"
import { cur, moneyLocale, dateLocale } from "../lib/money"
import { qty, useT } from "../lib/i18n"

const inr = (n: unknown) =>
  Number(n ?? 0).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

/** Amount / percentage / count - bidi-isolated so it reads inside RTL. */
const Num = ({ children }: { children: ReactNode }) => (
  <bdi dir="ltr">{children}</bdi>
)

const money = (n: unknown) => (
  <Num>
    {cur()}
    {inr(n)}
  </Num>
)

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`
}

const shortDay = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString(dateLocale(), { weekday: "short" })

const longDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString(dateLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

interface PropDash {
  property: string
  property_name: string
  date: string
  total_rooms: number
  occupancy_pct: number
  arrivals: number
  departures: number
  in_house: number
  no_shows: number
  revenue_today: number
  collections_today: number
  statistics: {
    mtd_occupancy_pct: number
    mtd_revenue: number
    adr: number
    revpar: number
    rooms_sold_mtd: number
  }
  housekeeping: {
    room_status: Record<string, number>
    occupied: number
    vacant: number
    open_tasks: number
    overdue_tasks: number
  }
  finance: {
    collections_today: number
    collections_by_mode: { mode: string; txns: number; total: number }[]
    outstanding: number
    open_folios: number
  }
  outlook: { date: string; booked: number; occupancy_pct: number }[]
}

interface Portfolio {
  date: string
  totals: {
    properties: number
    total_rooms: number
    occupancy_pct: number
    arrivals: number
    departures: number
    in_house: number
    revenue_today: number
    collections_today: number
    outstanding: number
  }
  properties: {
    property: string
    property_name: string
    total_rooms: number
    occupancy_pct: number
    arrivals: number
    departures: number
    in_house: number
    revenue_today: number
    collections_today: number
    outstanding: number
  }[]
}

// Housekeeping readiness - the same colour + icon vocabulary as Today / roomCells.
const HK_META: Record<
  string,
  { icon: typeof Sparkles; bar: string; swatch: string; ink: string }
> = {
  Clean: { icon: Sparkles, bar: "bg-emerald-500", swatch: "bg-emerald-500", ink: "text-emerald-600" },
  Inspected: { icon: BadgeCheck, bar: "bg-sky-500", swatch: "bg-sky-500", ink: "text-sky-600" },
  Dirty: { icon: Brush, bar: "bg-gold-500", swatch: "bg-gold-500", ink: "text-gold-600" },
  "Out of Order": { icon: Wrench, bar: "bg-rose-500", swatch: "bg-rose-500", ink: "text-rose-600" },
}
const HK_ORDER = ["Clean", "Inspected", "Dirty", "Out of Order"] as const

function ChartCard({
  title,
  icon: Icon,
  link,
  children,
}: {
  title: string
  icon?: typeof Sparkles
  link?: { to: string; label: string }
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          {Icon && <Icon className="size-4 text-brand-600" aria-hidden />}
          {title}
        </CardTitle>
        {link && (
          <Link
            to={link.to}
            className="ms-auto inline-flex items-center gap-1 rounded text-xs font-semibold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
          >
            {link.label}
            <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
          </Link>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function KV({ label, value, tone, to }: { label: string; value: ReactNode; tone?: string; to?: string }) {
  const inner = (
    <>
      <span className="text-zinc-500 group-hover:text-zinc-700">{label}</span>
      <span className={`font-semibold tabular-nums ${tone ?? "text-zinc-800"}`}>{value}</span>
    </>
  )
  if (to)
    return (
      <Link
        to={to}
        className="group -mx-2 flex min-h-11 items-center justify-between rounded-md px-2 py-1.5 text-sm transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
      >
        {inner}
      </Link>
    )
  return <div className="flex min-h-11 items-center justify-between px-2 py-1.5 text-sm">{inner}</div>
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100" />
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { t, lang } = useT()
  const rtl = lang === "ar"
  const [scope, setScope] = useState<"property" | "portfolio">("property")
  const [multi, setMulti] = useState(false)
  const [date, setDate] = useState(todayISO)
  const [prop, setProp] = useState<PropDash | null>(null)
  const [port, setPort] = useState<Portfolio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const { roles } = useAuth()
  const { switchProperty } = useOutletContext<ShellContext>()
  const modules = useEnabledModules()
  // A KPI/segment links to its screen only when the user's role AND the
  // property's enabled modules allow it; otherwise it stays plain, never a
  // dead-end on a permission wall.
  const linkTo = (path: string, query = "") =>
    canAccessPath(path, roles, modules) ? path + query : undefined

  useEffect(() => {
    call<{ name: string }[]>("hotelpms.api.my_properties")
      .then((p) => setMulti((p?.length ?? 0) > 1))
      .catch(() => setMulti(false))
  }, [])

  const load = useCallback(() => {
    setError(null)
    setDenied(false)
    if (scope === "property") {
      call<PropDash>("hotelpms.dashboards.property_dashboard", {
        property: getCurrentProperty(),
        date,
      })
        .then((d) => {
          setProp(d)
          setPort(null)
        })
        .catch((e) => (isAuthError(e) ? setDenied(true) : setError(serverError(e))))
    } else {
      call<Portfolio>("hotelpms.dashboards.portfolio_dashboard", { date })
        .then((d) => {
          setPort(d)
          setProp(null)
        })
        .catch((e) => (isAuthError(e) ? setDenied(true) : setError(serverError(e))))
    }
  }, [scope, date])
  useEffect(load, [load])
  useRealtime(load)

  const activeDate = scope === "property" ? prop?.date : port?.date
  const loading =
    !error &&
    !denied &&
    ((scope === "property" && !prop) || (scope === "portfolio" && !port))

  // ---- headline KPI tiles ----
  const stats: HeaderStat[] = useMemo(() => {
    if (scope === "property" && prop) {
      const dayHint = prop.date === todayISO() ? t("today") : undefined
      return [
        {
          key: "occ",
          label: "Occupancy",
          value: <Num>{prop.occupancy_pct}%</Num>,
          hint: `${prop.housekeeping.occupied} of ${prop.total_rooms} rooms`,
          meter: prop.occupancy_pct,
          icon: Gauge,
          tone: "brand",
          to: linkTo("/tape"),
        },
        {
          key: "adr",
          label: "ADR",
          value: money(prop.statistics.adr),
          hint: t("month to date"),
          icon: BadgePercent,
          tone: "sky",
          to: linkTo("/revenue-reports"),
        },
        {
          key: "revpar",
          label: "RevPAR",
          value: money(prop.statistics.revpar),
          hint: t("month to date"),
          icon: BarChart3,
          tone: "sky",
          to: linkTo("/revenue-reports"),
        },
        {
          key: "rev",
          label: "Revenue",
          value: money(prop.revenue_today),
          hint: dayHint,
          icon: SaudiRiyal,
          tone: "gold",
          to: linkTo("/revenue-reports"),
        },
        {
          key: "coll",
          label: "Collections",
          value: money(prop.collections_today),
          hint: dayHint,
          icon: Wallet,
          tone: "brand",
          to: linkTo("/billing"),
        },
      ]
    }
    if (scope === "portfolio" && port) {
      const p = port.totals
      const dayHint = port.date === todayISO() ? t("today") : undefined
      return [
        {
          key: "props",
          label: "Properties",
          value: <Num>{p.properties}</Num>,
          hint: qty(p.total_rooms, "room"),
          icon: Building2,
          tone: "brand",
        },
        {
          key: "occ",
          label: "Occupancy",
          value: <Num>{p.occupancy_pct}%</Num>,
          meter: p.occupancy_pct,
          icon: Gauge,
          tone: "brand",
          to: linkTo("/tape"),
        },
        {
          key: "arr",
          label: "Arrivals",
          value: <Num>{p.arrivals}</Num>,
          hint: dayHint,
          icon: LogIn,
          tone: "sky",
        },
        {
          key: "inh",
          label: "In-house",
          value: <Num>{p.in_house}</Num>,
          hint: t("staying now"),
          icon: Users,
          tone: "brand",
        },
        {
          key: "rev",
          label: "Revenue",
          value: money(p.revenue_today),
          hint: dayHint,
          icon: SaudiRiyal,
          tone: "gold",
          to: linkTo("/revenue-reports"),
        },
      ]
    }
    return []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, prop, port, roles, modules, lang])

  const header = (
    <ScreenHeader
      title={t("Dashboard")}
      context={activeDate ? longDate(activeDate) : longDate(date)}
      stats={stats.length ? stats : undefined}
      nav={
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="dash-date" className="sr-only">
            {t("Business date")}
          </label>
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 shadow-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600">
            <CalendarRange className="size-4 text-zinc-400" aria-hidden />
            <input
              id="dash-date"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value || todayISO())}
              className="min-h-11 bg-transparent text-[13px] font-medium text-zinc-700 focus:outline-none"
            />
          </div>
          {multi && (
            <div className="flex rounded-xl border border-zinc-200 bg-white p-0.5 text-sm shadow-sm">
              {(["property", "portfolio"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  aria-pressed={scope === s}
                  className={
                    "min-h-11 rounded-lg px-3 py-1.5 font-medium transition " +
                    (scope === s ? "bg-brand-600 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-50")
                  }
                >
                  {s === "property" ? t("This property") : t("All properties")}
                </button>
              ))}
            </div>
          )}
        </div>
      }
      primaryAction={
        linkTo("/revenue-reports") ? (
          <Link
            to="/revenue-reports"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(14,122,108,.24)] transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <BarChart3 className="size-4" aria-hidden />
            {t("Revenue reports")}
          </Link>
        ) : undefined
      }
    />
  )

  return (
    <div className="space-y-5">
      {header}

      {denied && (
        <OnboardingEmptyState
          variant="denied"
          title={t("This view is for management")}
          message={t(
            "The performance dashboard is available to finance and management roles. Ask a hotel administrator if you need access.",
          )}
        />
      )}

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          <span>{error}</span>
          <button className="min-h-11 shrink-0 font-semibold underline" onClick={() => load()}>
            {t("Retry")}
          </button>
        </div>
      )}

      {loading && <DashboardSkeleton />}

      {scope === "property" && prop && <PropertyView prop={prop} rtl={rtl} linkTo={linkTo} t={t} />}

      {scope === "portfolio" && port && (
        <PortfolioView
          port={port}
          onOpenProperty={(name) => {
            switchProperty(name)
            setScope("property")
          }}
          t={t}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Property analytics - the single-hotel performance cockpit.
// ---------------------------------------------------------------------------
function PropertyView({
  prop,
  rtl,
  linkTo,
  t,
}: {
  prop: PropDash
  rtl: boolean
  linkTo: (path: string, query?: string) => string | undefined
  t: (s: string) => string
}) {
  // A fresh property with nothing configured yet - guide setup, not an empty grid.
  if (prop.total_rooms === 0) {
    return (
      <OnboardingEmptyState
        icon={BedDouble}
        title={t("No rooms added yet")}
        message={t("Add rooms to start tracking occupancy, revenue and performance.")}
        cta={{ label: t("Add rooms"), to: "/rooms" }}
        gatedNote={t("Ask a hotel administrator to add rooms.")}
      />
    )
  }

  // Occupancy pace: today, then the booked-on-the-books outlook for +1..+7.
  const isToday = prop.date === todayISO()
  const pace: PacePoint[] = [
    {
      key: "today",
      label: isToday ? t("Today") : shortDay(prop.date),
      pct: prop.occupancy_pct,
      caption: `${longDate(prop.date)} · ${prop.occupancy_pct}% · ${prop.housekeeping.occupied} of ${prop.total_rooms} rooms`,
      today: true,
    },
    ...(prop.outlook ?? []).map((o) => ({
      key: o.date,
      label: shortDay(o.date),
      pct: o.occupancy_pct,
      caption: `${longDate(o.date)} · ${o.occupancy_pct}% · ${o.booked} of ${prop.total_rooms} rooms`,
    })),
  ]
  const paceMin = Math.min(...pace.map((p) => p.pct))
  const paceMax = Math.max(...pace.map((p) => p.pct))
  const paceAria = `${t("Occupancy pace")} - ${t("next 7 days")}, ${paceMin}% to ${paceMax}%`

  // Room readiness composition (every room carries one housekeeping state).
  const readiness: CompositionSegment[] = HK_ORDER.map((k) => ({
    key: k,
    label: t(k),
    value: prop.housekeeping.room_status[k] ?? 0,
    className: HK_META[k].bar,
  }))

  // Collections by payment mode - the honest revenue-mix the payload exposes.
  const modes = prop.finance.collections_by_mode ?? []
  const modeMax = Math.max(1, ...modes.map((m) => m.total))
  const modeItems: BarItem[] = modes.map((m) => ({
    key: m.mode,
    label: m.mode,
    value: money(m.total),
    sub: qty(m.txns, "payment"),
    pct: (m.total / modeMax) * 100,
    to: linkTo("/billing"),
  }))

  // Movement today - arrivals vs departures vs in-house on one count axis.
  const moveMax = Math.max(1, prop.arrivals, prop.departures, prop.in_house)
  const movement: BarItem[] = [
    { key: "arr", label: t("Arrivals"), icon: LogIn, iconClassName: "text-sky-600", value: <Num>{prop.arrivals}</Num>, pct: (prop.arrivals / moveMax) * 100, barClassName: "bg-sky-500", to: linkTo("/reservations") },
    { key: "dep", label: t("Departures"), icon: LogOut, iconClassName: "text-gold-600", value: <Num>{prop.departures}</Num>, pct: (prop.departures / moveMax) * 100, barClassName: "bg-gold-500", to: linkTo("/reservations") },
    { key: "inh", label: t("In-house"), icon: Users, iconClassName: "text-brand-600", value: <Num>{prop.in_house}</Num>, pct: (prop.in_house / moveMax) * 100, barClassName: "bg-brand-500", to: linkTo("/reservations") },
  ]

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title={t("Occupancy pace")}
            icon={Gauge}
            link={linkTo("/tape") ? { to: "/tape", label: t("Tape chart") } : undefined}
          >
            <PaceChart points={pace} rtl={rtl} ariaLabel={paceAria} />
            <p className="mt-2 text-xs text-zinc-400">
              {t("Rooms on the books for the next 7 nights.")}
            </p>
          </ChartCard>
        </div>

        <ChartCard
          title={t("Month to date")}
          icon={BarChart3}
          link={linkTo("/revenue-reports") ? { to: "/revenue-reports", label: t("Reports") } : undefined}
        >
          <div className="divide-y divide-zinc-100">
            <KV label={t("Occupancy")} value={<Num>{prop.statistics.mtd_occupancy_pct}%</Num>} />
            <KV label={t("Revenue")} value={money(prop.statistics.mtd_revenue)} to={linkTo("/revenue-reports")} />
            <KV label={t("ADR")} value={money(prop.statistics.adr)} to={linkTo("/revenue-reports")} />
            <KV label={t("RevPAR")} value={money(prop.statistics.revpar)} to={linkTo("/revenue-reports")} />
            <KV label={t("Rooms sold")} value={<Num>{inr(prop.statistics.rooms_sold_mtd)}</Num>} />
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title={t("Room readiness")} icon={Brush}>
          <CompositionBar segments={readiness} />
          <div className="mt-3">
            <BarList
              items={HK_ORDER.map((k) => ({
                key: k,
                label: t(k),
                icon: HK_META[k].icon,
                iconClassName: HK_META[k].ink,
                value: <Num>{prop.housekeeping.room_status[k] ?? 0}</Num>,
                pct: prop.total_rooms
                  ? ((prop.housekeeping.room_status[k] ?? 0) / prop.total_rooms) * 100
                  : 0,
                barClassName: HK_META[k].bar,
                to: linkTo("/rooms", `?housekeeping_status=${encodeURIComponent(k)}`),
              }))}
            />
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-2">
            <KV
              label={t("Open tasks")}
              value={<Num>{prop.housekeeping.open_tasks}</Num>}
              to={linkTo("/housekeeping", "?status=Open")}
            />
            <KV
              label={t("Overdue")}
              value={
                <span className="inline-flex items-center gap-1">
                  {prop.housekeeping.overdue_tasks > 0 && (
                    <CircleAlert className="size-3.5 text-rose-600" aria-hidden />
                  )}
                  <Num>{prop.housekeeping.overdue_tasks}</Num>
                </span>
              }
              tone={prop.housekeeping.overdue_tasks ? "text-rose-600" : undefined}
              to={linkTo("/housekeeping")}
            />
          </div>
        </ChartCard>

        <ChartCard title={t("Collections by mode")} icon={Wallet}>
          {modes.length ? (
            <BarList items={modeItems} />
          ) : (
            <p className="py-6 text-center text-sm text-zinc-400">
              {t("No payments collected yet.")}
            </p>
          )}
          <div className="mt-3 border-t border-zinc-100 pt-2">
            <KV label={t("Collected today")} value={money(prop.finance.collections_today)} to={linkTo("/billing")} />
            <KV
              label={t("Outstanding")}
              value={money(prop.finance.outstanding)}
              tone={prop.finance.outstanding ? "text-gold-700" : undefined}
              to={linkTo("/billing")}
            />
            <KV label={t("Open folios")} value={<Num>{prop.finance.open_folios}</Num>} to={linkTo("/billing")} />
          </div>
        </ChartCard>

        <ChartCard title={t("Movement today")} icon={LogIn}>
          <BarList items={movement} />
          {prop.no_shows > 0 && (
            <div className="mt-3 border-t border-zinc-100 pt-2">
              <KV
                label={t("No-shows")}
                value={
                  <span className="inline-flex items-center gap-1">
                    <CircleAlert className="size-3.5 text-rose-600" aria-hidden />
                    <Num>{prop.no_shows}</Num>
                  </span>
                }
                tone="text-rose-600"
                to={linkTo("/reservations")}
              />
            </div>
          )}
          <Legend
            className="mt-3"
            items={[
              { swatch: "bg-sky-500", icon: LogIn, iconClassName: "text-sky-600", label: t("Arrivals") },
              { swatch: "bg-gold-500", icon: LogOut, iconClassName: "text-gold-600", label: t("Departures") },
              { swatch: "bg-brand-500", icon: Users, iconClassName: "text-brand-600", label: t("In-house") },
            ]}
          />
        </ChartCard>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Portfolio analytics - the chain roll-up: revenue leaders + the detail table.
// ---------------------------------------------------------------------------
function PortfolioView({
  port,
  onOpenProperty,
  t,
}: {
  port: Portfolio
  onOpenProperty: (name: string) => void
  t: (s: string) => string
}) {
  const revMax = Math.max(1, ...port.properties.map((p) => p.revenue_today))
  const revItems: BarItem[] = port.properties.map((p) => ({
    key: p.property,
    label: <Bilingual value={p.property_name} primaryOnly />,
    value: money(p.revenue_today),
    sub: (
      <span>
        <Num>{p.occupancy_pct}%</Num> · {qty(p.total_rooms, "room")}
      </span>
    ),
    pct: (p.revenue_today / revMax) * 100,
    onClick: () => onOpenProperty(p.property),
  }))

  return (
    <>
      <ChartCard title={t("Revenue by property")} icon={SaudiRiyal}>
        <BarList items={revItems} />
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Building2 className="size-4 text-brand-600" aria-hidden />
            {t("By property")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-start text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="py-2 pe-3 text-start">{t("Property")}</th>
                  <th className="py-2 pe-3 text-end">{t("Occ %")}</th>
                  <th className="py-2 pe-3 text-end">{t("Arr")}</th>
                  <th className="py-2 pe-3 text-end">{t("Dep")}</th>
                  <th className="py-2 pe-3 text-end">{t("In-house")}</th>
                  <th className="py-2 pe-3 text-end">{t("Revenue")}</th>
                  <th className="py-2 pe-3 text-end">{t("Collected")}</th>
                  <th className="py-2 text-end">{t("Outstanding")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {port.properties.map((p) => (
                  <tr key={p.property} className="hover:bg-zinc-50">
                    <td className="py-2 pe-3">
                      <button
                        type="button"
                        onClick={() => onOpenProperty(p.property)}
                        className="rounded text-start font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
                      >
                        <Bilingual value={p.property_name} primaryOnly />
                      </button>
                    </td>
                    <td className="py-2 pe-3 text-end tabular-nums"><Num>{p.occupancy_pct}%</Num></td>
                    <td className="py-2 pe-3 text-end tabular-nums"><Num>{p.arrivals}</Num></td>
                    <td className="py-2 pe-3 text-end tabular-nums"><Num>{p.departures}</Num></td>
                    <td className="py-2 pe-3 text-end tabular-nums"><Num>{p.in_house}</Num></td>
                    <td className="py-2 pe-3 text-end tabular-nums">{money(p.revenue_today)}</td>
                    <td className="py-2 pe-3 text-end tabular-nums">{money(p.collections_today)}</td>
                    <td className="py-2 text-end tabular-nums">{money(p.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
