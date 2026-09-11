/*  Banquet Kitchen — the pre-production board for confirmed functions.

    Separate from the POS kitchen (which runs live KOTs): a function is
    cooked to a plan — confirmed → BEO → final menu → guaranteed pax →
    prep → issue from the shared store → served → closed. This page lists
    the confirmed functions the kitchen has to produce and, per function,
    the dishes by station and the indent against the SAME inventory the
    restaurant draws on. No parallel stock, no KOT link — shared items,
    recipes, ingredients, stock and stations.  */

import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChefHat, PackageSearch, Users } from "lucide-react"

import { banquet, getCurrentProperty } from "../lib/api"
import { listResource, serverError, type Row } from "../lib/resource"
import { Card, CardContent } from "../components/ui/card"
import { Empty, ErrorNote } from "./banquet/shared"

const s = (v: unknown) => (v == null ? "" : String(v))
const n = (v: unknown) => Number(v ?? 0)

export type KitchenStateKey =
  | "Unplanned"
  | "Planned"
  | "In Preparation"
  | "Ready to Serve"
  | "Served"
  | "Closed"

export const KITCHEN_STATES: {
  key: KitchenStateKey
  label: string
  tone: string
}[] = [
  { key: "Unplanned", label: "Unplanned", tone: "bg-zinc-100 text-zinc-600" },
  { key: "Planned", label: "Planned", tone: "bg-sky-50 text-sky-700" },
  { key: "In Preparation", label: "In Preparation", tone: "bg-amber-50 text-amber-700" },
  { key: "Ready to Serve", label: "Ready to Serve", tone: "bg-violet-50 text-violet-700" },
  { key: "Served", label: "Served", tone: "bg-emerald-50 text-emerald-700" },
  { key: "Closed", label: "Closed", tone: "bg-zinc-100 text-zinc-500" },
]

/** A read-only chip when the backend kitchen_status field isn't live yet:
 *  derive a best-effort state from signals we already have. The real, editable
 *  six-state field takes over once it ships. */
export function deriveKitchenState(
  row: Record<string, unknown>,
  planned: boolean | undefined,
): KitchenStateKey {
  if (row.kitchen_status) return row.kitchen_status as KitchenStateKey
  if (row.closed_out_on) return "Closed"
  if (n(row.pax_actual) > 0) return "Served"
  if (planned) return "Planned"
  return "Unplanned"
}

export function KitchenStateChip({ state }: { state: KitchenStateKey }) {
  const meta = KITCHEN_STATES.find((x) => x.key === state) ?? KITCHEN_STATES[0]
  return (
    <span
      className={
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium " + meta.tone
      }
    >
      {meta.label}
    </span>
  )
}

type IndentInfo = { planned: boolean; short: number } | undefined

export default function BanquetKitchen() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // per-function kitchen readiness, loaded lazily off the indent
  const [info, setInfo] = useState<Record<string, IndentInfo>>({})

  const load = useCallback(() => {
    listResource("Venue Booking", {
      filters: [
        ["status", "=", "Confirmed"],
        ["property", "=", getCurrentProperty()],
      ],
      // NB: no kitchen_status here — it's a dormant column and would error the
      // query until it ships. The chip derives from pax_actual/closed_out_on.
      fields: [
        "name", "event_name", "customer_name", "venue", "event_date",
        "start_time", "end_time", "session", "pax_guaranteed", "pax_actual",
        "beo_number", "closed_out_on",
      ],
      orderBy: "event_date asc",
      limit: 100,
    })
      .then(setRows)
      .catch((e) => setError(serverError(e)))
  }, [])
  useEffect(load, [load])

  // Build each indent lazily. A throw (no composed menu) IS the "Unplanned"
  // signal — not an error; swallow it per row so one blank function doesn't
  // paint the board red.
  useEffect(() => {
    if (!rows) return
    let live = true
    for (const r of rows) {
      const fn = s(r.name)
      banquet
        .indent(fn)
        .then((d) => {
          if (live)
            setInfo((m) => ({ ...m, [fn]: { planned: true, short: d.shortfall_lines } }))
        })
        .catch(() => {
          if (live) setInfo((m) => ({ ...m, [fn]: { planned: false, short: 0 } }))
        })
    }
    return () => {
      live = false
    }
  }, [rows])

  if (!rows) return <Empty>{error ?? "Loading…"}</Empty>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
          <ChefHat className="size-5 text-violet-600" />
          Banquet Kitchen
        </h1>
        <p className="mt-0.5 text-sm text-zinc-400">
          Confirmed functions to produce. Open one for the stations, the indent
          against the store, and what was actually served.
        </p>
      </div>

      <ErrorNote error={error} />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-zinc-500">
            No confirmed functions. They appear here the moment an event is
            confirmed.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const fn = s(r.name)
            const i = info[fn]
            const state = deriveKitchenState(r, i?.planned)
            const time = s(r.start_time).slice(0, 5)
            return (
              <button
                key={fn}
                onClick={() => navigate("/banquet-kitchen/" + encodeURIComponent(fn))}
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-start transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-zinc-900" dir="auto">
                    {s(r.event_name) || s(r.customer_name)}
                  </span>
                  <KitchenStateChip state={state} />
                </div>
                <div className="text-sm text-zinc-500" dir="auto">
                  {s(r.venue).split("-").pop()}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                  <span className="tabular-nums">
                    {s(r.event_date)}
                    {time ? " · " + time : ""}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" />
                    {n(r.pax_guaranteed)} pax
                  </span>
                  {s(r.beo_number) && <span>BEO {s(r.beo_number)}</span>}
                </div>
                <div className="mt-1">
                  {i === undefined ? (
                    <span className="text-xs text-zinc-300">Checking stock…</span>
                  ) : !i.planned ? (
                    <span className="text-xs font-medium text-amber-700">
                      Menu not composed yet
                    </span>
                  ) : i.short > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
                      <PackageSearch className="size-3.5" />
                      {i.short} short on the shelf
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-emerald-700">
                      Stock covers the indent
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
