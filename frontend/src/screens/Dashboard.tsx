import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useRealtime } from "../lib/realtime"
import {
  BedDouble, LogIn, LogOut, Users, SaudiRiyal, Wallet, Building2, Brush, Receipt,
  PieChart,
} from "lucide-react"
import { call, getCurrentProperty } from "../lib/api"
import { serverError } from "../lib/resource"
import { useAuth } from "../lib/auth"
import { useEnabledModules } from "../lib/modules"
import { canAccessPath } from "../lib/apps"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { StatCard } from "../components/ui/stat-card"
import { cur, moneyLocale } from "../lib/money"

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

export default function Dashboard() {
  const [scope, setScope] = useState<"property" | "portfolio">("property")
  const [multi, setMulti] = useState(false)
  const [prop, setProp] = useState<PropDash | null>(null)
  const [port, setPort] = useState<Portfolio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { roles } = useAuth()
  const modules = useEnabledModules()
  // A KPI links to its screen only when the user's role AND the property's
  // enabled modules allow it; otherwise the tile stays a plain, unlinked card.
  const linkTo = (path: string, query = "") =>
    canAccessPath(path, roles, modules) ? path + query : undefined

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
          <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="text-xs text-zinc-500">
            {scope === "property"
              ? "Today at this property, by department."
              : "The whole portfolio at a glance."}
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
                      <tr key={p.property}>
                        <td className="py-2 pr-3 font-medium">{p.property_name}</td>
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
