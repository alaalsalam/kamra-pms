import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Printer } from "lucide-react"
import { call, getCurrentProperty } from "../lib/api"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { cur, moneyLocale } from "../lib/money"
import { useT, fill } from "../lib/i18n"

/** The manager's flash - sign it off with the morning chai. */

interface Day {
  date: string
  rooms_sold: number
  pax: number
  occupancy_pct: number
  room_revenue: number
  fnb_revenue: number
  other_revenue: number
  total_revenue: number
  adr: number
  revpar: number
  revpax: number
}

interface Flash {
  date: string
  total_rooms: number
  today: Day | null
  mtd: Day & { occupancy_pct: number }
  movement: { arrivals: number; departures: number; in_house: number; no_shows: number }
  collections: { modes: { mode: string; txns: number; total: number }[]; grand_total: number }
  trend: Day[]
  outlook: { date: string; booked: number; occupancy_pct: number }[]
}

const inr = (n: number) =>
  Number(n).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

type SortKey = "date" | "occupancy" | "adr" | "revpar" | "revenue"

function trendValue(row: Day, key: SortKey): number {
  switch (key) {
    case "date":
      return new Date(row.date).getTime()
    case "occupancy":
      return row.occupancy_pct
    case "adr":
      return row.adr
    case "revpar":
      return row.revpar
    case "revenue":
      return row.room_revenue + row.fnb_revenue + row.other_revenue
  }
}

function Stat(props: { label: string; value: string; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <div className="text-xl font-semibold">{props.value}</div>
      <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">
        {props.label}
      </div>
      {props.sub && <div className="mt-0.5 text-xs text-zinc-500">{props.sub}</div>}
    </div>
  )
}

export default function Reports() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [sortBy, setSortBy] = useState<SortKey>("date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [d, setD] = useState<Flash | null>(null)
  const { t } = useT()

  const load = useCallback(() => {
    call<Flash>("hotelpms.reports.manager_flash", {
      property: getCurrentProperty(),
      date,
    }).then(setD)
  }, [date])
  useEffect(load, [load])

  const sortedTrend = useMemo(() => {
    if (!d) return []
    const dir = sortDirection === "asc" ? 1 : -1
    return [...d.trend].sort(
      (a, b) => dir * (trendValue(a, sortBy) - trendValue(b, sortBy)),
    )
  }, [d, sortBy, sortDirection])

  if (!d) return <p className="py-10 text-center text-zinc-400">Loading…</p>
  const today = d.today

  const trendCols: {
    key: SortKey
    label: string
    align: "left" | "right"
    money?: boolean
    last?: boolean
  }[] = [
    { key: "date", label: "Date", align: "left" },
    { key: "occupancy", label: "Occ %", align: "right" },
    { key: "adr", label: "ADR", align: "right", money: true },
    { key: "revpar", label: "RevPAR", align: "right", money: true },
    { key: "revenue", label: "Revenue", align: "right", money: true, last: true },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-lg font-semibold">Manager flash</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Report date"
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Print
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat
          label="Occupancy"
          value={`${today?.occupancy_pct ?? 0}%`}
          sub={fill(t("{sold} of {total} rooms"), {
            sold: today?.rooms_sold ?? 0,
            total: d.total_rooms,
          })}
        />
        <Stat
          label="ADR"
          value={`${cur()}${inr(today?.adr ?? 0)}`}
          sub={t("room rate / room sold")}
        />
        <Stat
          label="RevPAR"
          value={`${cur()}${inr(today?.revpar ?? 0)}`}
          sub={t("room rev / room")}
        />
        <Stat
          label="RevPAX"
          value={`${cur()}${inr(today?.revpax ?? 0)}`}
          sub={fill(t("total spend / guest · {pax} pax"), { pax: today?.pax ?? 0 })}
        />
        <Stat
          label="Revenue (day)"
          value={`${cur()}${inr(today?.total_revenue ?? 0)}`}
          sub={fill(t("room {room} · F&B {fnb} · other {other}"), {
            room: `${cur()}${inr(today?.room_revenue ?? 0)}`,
            fnb: `${cur()}${inr(today?.fnb_revenue ?? 0)}`,
            other: `${cur()}${inr(today?.other_revenue ?? 0)}`,
          })}
        />
      </div>
      <p className="-mt-2 mb-4 text-xs text-zinc-400">
        {t(
          "RevPAX = total guest spend (room + F&B + experiences + extras) per in-house guest - the ancillary revenue RevPAR can't see.",
        )}
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Last 14 days</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-start text-xs uppercase tracking-wider text-zinc-500">
                  {trendCols.map((col) => {
                    const active = sortBy === col.key
                    const arrow = active ? (sortDirection === "asc" ? " ▲" : " ▼") : ""
                    return (
                      <th
                        key={col.key}
                        aria-sort={
                          active
                            ? sortDirection === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        className={`py-1.5 ${col.last ? "" : "pe-3"} ${col.align === "right" ? "text-end" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (active) {
                              setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                            } else {
                              setSortBy(col.key)
                              setSortDirection("desc")
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-brand-600"
                        >
                          {t(col.label)}
                          {col.money && <bdi dir="ltr">{cur()}</bdi>}
                          {arrow}
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {sortedTrend.map((r) => (
                  <tr key={r.date}>
                    <td className="py-1.5 pe-3 text-zinc-500">
                      <bdi dir="ltr">{r.date}</bdi>
                    </td>
                    <td className="py-1.5 pe-3 text-end">{r.occupancy_pct}</td>
                    <td className="py-1.5 pe-3 text-end">{inr(r.adr)}</td>
                    <td className="py-1.5 pe-3 text-end">{inr(r.revpar)}</td>
                    <td className="py-1.5 text-end">
                      {inr(r.room_revenue + r.fnb_revenue + r.other_revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-300 font-medium">
                  <td className="py-2 pe-3">Month to date</td>
                  <td className="py-2 pe-3 text-end">{d.mtd.occupancy_pct}</td>
                  <td className="py-2 pe-3 text-end">{inr(d.mtd.adr)}</td>
                  <td className="py-2 pe-3 text-end">{inr(d.mtd.revpar)}</td>
                  <td className="py-2 text-end">
                    {inr(d.mtd.room_revenue + d.mtd.fnb_revenue + d.mtd.other_revenue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Movement</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <div>Arrivals <span className="float-end font-medium">{d.movement.arrivals}</span></div>
              <div>Departures <span className="float-end font-medium">{d.movement.departures}</span></div>
              <div>In-house <span className="float-end font-medium">{d.movement.in_house}</span></div>
              <div>No-shows <span className="float-end font-medium">{d.movement.no_shows}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Collections</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {d.collections.modes.length === 0 && (
                <p className="text-zinc-400">Nothing collected yet.</p>
              )}
              {d.collections.modes.map((m) => (
                <div key={m.mode} className="flex justify-between py-0.5">
                  <span>{m.mode} · {m.txns}</span>
                  <span>{cur()}{inr(m.total)}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t border-zinc-200 pt-1 font-medium">
                <span>Total</span>
                <span>{cur()}{inr(d.collections.grand_total)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Next 7 days</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {d.outlook.map((o) => (
                <div key={o.date} className="flex items-center gap-2 py-0.5">
                  <span className="w-24 text-zinc-500">{o.date.slice(5)}</span>
                  <div className="h-2 flex-1 rounded bg-zinc-100">
                    <div
                      className="h-2 rounded bg-brand-600"
                      style={{ width: `${Math.min(100, o.occupancy_pct)}%` }}
                    />
                  </div>
                  <span className="w-10 text-end">{o.occupancy_pct}%</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
