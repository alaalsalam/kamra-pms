import { useCallback, useEffect, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useRealtime } from "../lib/realtime"
import {
  BedDouble, LogIn, LogOut, Users, SaudiRiyal, Wallet, Building2, Brush, Receipt,
  PieChart, ArrowUpRight, CircleAlert, Sparkles,
} from "lucide-react"
import { call, getCurrentProperty } from "../lib/api"
import { serverError } from "../lib/resource"
import { useAuth } from "../lib/auth"
import { useEnabledModules } from "../lib/modules"
import { canAccessPath } from "../lib/apps"
import type { ShellContext } from "../AppShell"
import { Bilingual } from "../components/Bilingual"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { StatCard } from "../components/ui/stat-card"
import { cur, moneyLocale, dateLocale } from "../lib/money"
import { useT } from "../lib/i18n"

const inr = (n: unknown) =>
  Number(n ?? 0).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

interface PropDash {
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
    outstanding: number
    open_folios: number
  }
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

function Tile({ icon: Icon, label, value, sub, tone, to }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  tone?: string
  to?: string
}) {
  return (
    <StatCard
      icon={<Icon className="size-4" />}
      label={label}
      value={value}
      sub={sub}
      accent={tone === "text-brand-600"}
      to={to}
    />
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-xl border border-zinc-200 bg-zinc-100" />
        ))}
      </div>
      <div className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-44 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100" />
        <div className="h-44 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100" />
      </div>
    </div>
  )
}

function AttentionCard({
  icon: Icon,
  title,
  detail,
  action,
  to,
  urgent = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  detail: string
  action: string
  to?: string
  urgent?: boolean
}) {
  const body = (
    <>
      <span className={urgent
        ? "grid size-10 shrink-0 place-items-center rounded-xl bg-gold-100 text-gold-700"
        : "grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-zinc-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{detail}</span>
      </span>
      {to && (
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-700">
          {action}
          <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
        </span>
      )}
    </>
  )
  const cls = "group flex min-h-24 items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}

export default function Dashboard() {
  const { t } = useT()
  const [scope, setScope] = useState<"property" | "portfolio">("property")
  const [multi, setMulti] = useState(false)
  const [prop, setProp] = useState<PropDash | null>(null)
  const [port, setPort] = useState<Portfolio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { roles } = useAuth()
  const { switchProperty } = useOutletContext<ShellContext>()
  const modules = useEnabledModules()
  // A KPI links to its screen only when the user's role AND the property's
  // enabled modules allow it; otherwise the tile stays a plain, unlinked card.
  const linkTo = (path: string, query = "") =>
    canAccessPath(path, roles, modules) ? path + query : undefined
  const activeDate = scope === "property" ? prop?.date : port?.date

  useEffect(() => {
    call<{ name: string }[]>("hotelpms.api.my_properties")
      .then((p) => setMulti((p?.length ?? 0) > 1))
      .catch(() => setMulti(false))
  }, [])

  const load = useCallback(() => {
    setError(null)
    if (scope === "property") {
      call<PropDash>("hotelpms.dashboards.property_dashboard", {
        property: getCurrentProperty(),
      }).then(setProp).catch((e) => setError(serverError(e)))
    } else {
      call<Portfolio>("hotelpms.dashboards.portfolio_dashboard", {})
        .then(setPort).catch((e) => setError(serverError(e)))
    }
  }, [scope])
  useEffect(load, [load])
  useRealtime(load)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t("Operations centre")}</h1>
            {activeDate && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                {new Date(activeDate + "T00:00:00").toLocaleDateString(dateLocale(), {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-zinc-500">
            {scope === "property"
              ? t("See what needs attention now, then monitor the whole property.")
              : t("The whole portfolio at a glance.")}
          </p>
        </div>
        {multi && (
          <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5 text-sm">
            {(["property", "portfolio"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={
                  "rounded-md px-3 py-1.5 font-medium " +
                  (scope === s ? "bg-brand-600 text-white" : "text-zinc-600")
                }
              >
                {s === "property" ? "This property" : "All properties"}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!error &&
        ((scope === "property" && !prop) || (scope === "portfolio" && !port)) && (
          <DashboardSkeleton />
        )}

      {scope === "property" && prop && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Tile icon={PieChart} label="Occupancy" value={`${prop.occupancy_pct}%`}
              sub={`${prop.total_rooms} rooms`} tone="text-brand-600" to={linkTo("/tape")} />
            <Tile icon={LogIn} label="Arrivals" value={String(prop.arrivals)}
              sub="today" to={linkTo("/")} />
            <Tile icon={LogOut} label="Departures" value={String(prop.departures)}
              sub="today" to={linkTo("/")} />
            <Tile icon={Users} label="In-house" value={String(prop.in_house)}
              sub="staying now" to={linkTo("/")} />
            <Tile icon={SaudiRiyal} label="Revenue" value={`${cur()}${inr(prop.revenue_today)}`}
              sub="today" to={linkTo("/revenue-reports")} />
            <Tile icon={Wallet} label="Collections" value={`${cur()}${inr(prop.collections_today)}`}
              sub="today" to={linkTo("/billing")} />
          </div>

          <section aria-labelledby="attention-title">
            <div className="mb-3 flex items-center gap-2">
              <h2 id="attention-title" className="text-[13px] font-bold text-zinc-900">
                {t("Needs your attention now")}
              </h2>
              <span className="rounded-lg bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-500">
                {t("Priority order")}
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <AttentionCard
                icon={LogIn}
                title={`${prop.arrivals} ${t("arrivals today")}`}
                detail={prop.arrivals
                  ? t("Review assignments and prepare the next arrivals.")
                  : t("No arrivals are waiting right now.")}
                action={t("Open today")}
                to={linkTo("/")}
              />
              <AttentionCard
                icon={prop.housekeeping.overdue_tasks ? CircleAlert : Brush}
                title={`${prop.housekeeping.open_tasks} ${t("open housekeeping tasks")}`}
                detail={prop.housekeeping.overdue_tasks
                  ? `${prop.housekeeping.overdue_tasks} ${t("overdue tasks need action")}`
                  : t("Rooms are moving through the cleaning cycle.")}
                action={t("Open board")}
                to={linkTo("/housekeeping", "?status=Open")}
                urgent={prop.housekeeping.overdue_tasks > 0}
              />
              <AttentionCard
                icon={prop.finance.outstanding ? Wallet : Sparkles}
                title={`${cur()}${inr(prop.finance.outstanding)} ${t("outstanding")}`}
                detail={prop.finance.outstanding
                  ? t("Review open balances before the next shift.")
                  : t("No outstanding balance needs action.")}
                action={t("Open billing")}
                to={linkTo("/billing")}
                urgent={prop.finance.outstanding > 0}
              />
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Statistics (month to date)</CardTitle>
              {linkTo("/revenue-reports") && (
                <Link
                  to="/revenue-reports"
                  className="rounded text-xs font-medium text-brand-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
                >
                  Revenue reports →
                </Link>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {[
                  ["Occupancy", `${prop.statistics.mtd_occupancy_pct}%`],
                  ["Revenue", `${cur()}${inr(prop.statistics.mtd_revenue)}`],
                  ["ADR", `${cur()}${inr(prop.statistics.adr)}`],
                  ["RevPAR", `${cur()}${inr(prop.statistics.revpar)}`],
                  ["Rooms sold", inr(prop.statistics.rooms_sold_mtd)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{k}</div>
                    <div className="mt-0.5 text-lg font-semibold text-zinc-800">{v}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-1.5"><Brush className="size-4 text-brand-600" />Housekeeping</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <Row label="Clean" value={prop.housekeeping.room_status.Clean ?? 0} to={linkTo("/rooms", "?housekeeping_status=Clean")} />
                <Row label="Dirty" value={prop.housekeeping.room_status.Dirty ?? 0} tone={prop.housekeeping.room_status.Dirty ? "text-amber-600" : undefined} to={linkTo("/rooms", "?housekeeping_status=Dirty")} />
                <Row label="Inspected" value={prop.housekeeping.room_status.Inspected ?? 0} to={linkTo("/rooms", "?housekeeping_status=Inspected")} />
                <Row label="Out of order" value={prop.housekeeping.room_status["Out of Order"] ?? 0} to={linkTo("/rooms", "?housekeeping_status=Out%20of%20Order")} />
                <Row label="Open tasks" value={prop.housekeeping.open_tasks} to={linkTo("/housekeeping", "?status=Open")} />
                <Row label="Overdue" value={prop.housekeeping.overdue_tasks} tone={prop.housekeeping.overdue_tasks ? "text-rose-600" : undefined} to={linkTo("/housekeeping")} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-1.5"><Receipt className="size-4 text-brand-600" />Finance</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <Row label="Collected today" value={`${cur()}${inr(prop.finance.collections_today)}`} to={linkTo("/billing")} />
                <Row label="Outstanding" value={`${cur()}${inr(prop.finance.outstanding)}`} tone={prop.finance.outstanding ? "text-amber-600" : undefined} to={linkTo("/billing")} />
                <Row label="Open folios" value={prop.finance.open_folios} to={linkTo("/billing")} />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {scope === "portfolio" && port && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Tile icon={Building2} label="Properties" value={String(port.totals.properties)}
              sub={`${port.totals.total_rooms} rooms`} />
            <Tile icon={BedDouble} label="Occupancy" value={`${port.totals.occupancy_pct}%`} tone="text-brand-600" to={linkTo("/tape")} />
            <Tile icon={LogIn} label="Arrivals" value={String(port.totals.arrivals)} to={linkTo("/")} />
            <Tile icon={Users} label="In house" value={String(port.totals.in_house)} to={linkTo("/")} />
            <Tile icon={SaudiRiyal} label="Revenue" value={`${cur()}${inr(port.totals.revenue_today)}`} sub="today" to={linkTo("/revenue-reports")} />
            <Tile icon={Wallet} label="Collections" value={`${cur()}${inr(port.totals.collections_today)}`} sub="today" to={linkTo("/billing")} />
          </div>

          <Card>
            <CardHeader><CardTitle>By property</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      <th className="py-2 pr-3">Property</th>
                      <th className="py-2 pr-3 text-right">Occ %</th>
                      <th className="py-2 pr-3 text-right">Arr</th>
                      <th className="py-2 pr-3 text-right">Dep</th>
                      <th className="py-2 pr-3 text-right">In-house</th>
                      <th className="py-2 pr-3 text-right">Revenue</th>
                      <th className="py-2 pr-3 text-right">Collected</th>
                      <th className="py-2 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {port.properties.map((p) => (
                      <tr key={p.property} className="hover:bg-zinc-50">
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            onClick={() => {
                              switchProperty(p.property)
                              setScope("property")
                            }}
                            className="rounded text-start font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
                          >
                            <Bilingual value={p.property_name} primaryOnly />
                          </button>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.occupancy_pct}%</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.arrivals}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.departures}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.in_house}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{cur()}{inr(p.revenue_today)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{cur()}{inr(p.collections_today)}</td>
                        <td className="py-2 text-right tabular-nums">{cur()}{inr(p.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Row({ label, value, tone, to }: { label: string; value: unknown; tone?: string; to?: string }) {
  const inner = (
    <>
      <span className="text-zinc-500 group-hover:text-zinc-700">{label}</span>
      <span className={`font-semibold tabular-nums ${tone ?? "text-zinc-800"}`}>{String(value)}</span>
    </>
  )
  if (to)
    return (
      <Link
        to={to}
        className="group -mx-2 flex items-center justify-between rounded-md px-2 py-1 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
      >
        {inner}
      </Link>
    )
  return <div className="flex items-center justify-between">{inner}</div>
}
