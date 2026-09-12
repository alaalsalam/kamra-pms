/*  One confirmed function, from the kitchen's side.

    The plan (dishes by station), the indent against the SAME store the
    restaurant draws on (issue deducts real stock), and the night (actual
    pax + what was really used). Reuses the existing indent / issue /
    consumption APIs and the Economics sheets — no parallel machinery. */

import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Boxes,
  ChefHat,
  ClipboardList,
  PackageCheck,
  Plus,
  Users,
} from "lucide-react"

import {
  banquet,
  type FunctionEconomics,
  type FunctionSheet,
  type KitchenIndent,
} from "../lib/api"
import { serverError } from "../lib/resource"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Empty, ErrorNote, inputCls, inr } from "./banquet/shared"
import { CountSheet, IndentSheet, SupplementarySheet } from "./banquet/Economics"
import {
  deriveKitchenState,
  KITCHEN_STATES,
  KitchenStateChip,
  type KitchenStateKey,
} from "./BanquetKitchen"

type PrepKey = "Not Started" | "In Preparation" | "Ready" | "Served"
const PREP: { key: PrepKey; label: string; tone: string }[] = [
  { key: "Not Started", label: "Not Started", tone: "text-zinc-500" },
  { key: "In Preparation", label: "In Preparation", tone: "text-amber-700" },
  { key: "Ready", label: "Ready", tone: "text-emerald-700" },
  { key: "Served", label: "Served", tone: "text-sky-700" },
]

function PrepToggle({
  status,
  busy,
  onSet,
}: {
  status: string
  busy: boolean
  onSet: (s: PrepKey) => void
}) {
  return (
    <div className="mt-1 flex gap-1">
      {PREP.map((p) => (
        <button
          key={p.key}
          type="button"
          disabled={busy}
          aria-pressed={status === p.key}
          onClick={() => onSet(p.key)}
          className={
            "rounded-md px-2 py-0.5 text-[11px] font-medium transition " +
            (status === p.key
              ? "bg-violet-600 text-white"
              : "bg-zinc-100 " + p.tone + " hover:bg-zinc-200")
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

export default function BanquetKitchenFunction() {
  const { name = "" } = useParams()
  const navigate = useNavigate()
  const [fn, setFn] = useState<FunctionSheet | null>(null)
  const [indent, setIndent] = useState<KitchenIndent | null>(null)
  const [econ, setEcon] = useState<FunctionEconomics | null>(null)
  const [planned, setPlanned] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showIndent, setShowIndent] = useState(false)
  const [counting, setCounting] = useState(false)
  const [supp, setSupp] = useState(false)

  const load = useCallback(() => {
    setError(null)
    banquet.sheet(name).then(setFn).catch((e) => setError(serverError(e)))
    banquet
      .indent(name)
      .then((d) => {
        setIndent(d)
        setPlanned(true)
      })
      .catch(() => {
        setIndent(null)
        setPlanned(false)
      })
    banquet.economics(name).then(setEcon).catch(() => {})
  }, [name])
  useEffect(load, [load])

  function run(op: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    op()
      .then(() => load())
      .catch((e) => setError(serverError(e)))
      .finally(() => setBusy(false))
  }

  if (!fn) return <Empty>{error ?? "Loading…"}</Empty>

  const state = deriveKitchenState(fn as unknown as Record<string, unknown>, planned)
  const kitchenFieldLive = fn.kitchen_status !== undefined
  const t = fn.start_time ? String(fn.start_time).slice(0, 5) : ""

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            onClick={() => navigate("/banquet-kitchen")}
            className="mb-1 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
          >
            <ArrowLeft className="size-4" /> Banquet Kitchen
          </button>
          <h1
            className="flex items-center gap-2 text-xl font-semibold text-zinc-900"
            dir="auto"
          >
            <ChefHat className="size-5 text-violet-600" />
            {fn.event_name || fn.customer_name}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-400" dir="auto">
            {[
              fn.venue?.split("-").pop(),
              fn.event_date + (t ? " · " + t : ""),
              `${fn.billable_pax} pax`,
              fn.beo_number ? "BEO " + fn.beo_number : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {kitchenFieldLive ? (
          <select
            className={inputCls + " !w-44"}
            value={state}
            disabled={busy}
            onChange={(e) =>
              run(() => banquet.setKitchenStatus(name, e.target.value))
            }
          >
            {KITCHEN_STATES.map((x) => (
              <option key={x.key} value={x.key}>
                {x.label}
              </option>
            ))}
          </select>
        ) : (
          <KitchenStateChip state={state as KitchenStateKey} />
        )}
      </div>

      <ErrorNote error={error} />

      {!planned && (
        <Card>
          <CardContent className="py-8 text-center text-sm">
            <p className="font-medium text-amber-700">Menu not composed yet.</p>
            <p className="mt-1 text-zinc-500">
              Compose the final menu on the function to plan the kitchen.
            </p>
            <Link
              to={"/banquet/" + encodeURIComponent(name)}
              className="mt-3 inline-block font-medium text-brand-700 hover:underline"
            >
              Open the function →
            </Link>
          </CardContent>
        </Card>
      )}

      {indent && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Kitchen stations</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {indent.by_kitchen.map((k) => (
                <div key={k.kitchen} className="rounded-xl border border-zinc-200 p-3">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {k.kitchen}
                  </h4>
                  <ul className="space-y-2">
                    {k.dishes.map((d, i) => {
                      const rowName = d.name
                      return (
                        <li key={rowName ?? i} className="text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <span dir="auto">
                              {d.dish}
                              {d.note && (
                                <span className="text-xs text-amber-700">
                                  {" "}
                                  · {d.note}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 tabular-nums text-zinc-400">
                              {d.portions}
                            </span>
                          </div>
                          {rowName !== undefined && (
                            <PrepToggle
                              status={d.prep_status ?? "Not Started"}
                              busy={busy}
                              onSet={(st) =>
                                run(() => banquet.setDishPrep(name, rowName, st))
                              }
                            />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kitchen indent</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {indent.shortfall_lines > 0 && indent.material_request_enabled && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => run(() => banquet.createMaterialRequest(name))}
                  >
                    <ClipboardList className="size-4" /> Create material request
                  </Button>
                )}
                {indent.issued?.done ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                    <PackageCheck className="size-4" /> Issued
                    {indent.issued?.on ? " · " + indent.issued?.on : ""}
                  </span>
                ) : (
                  <Button variant="outline" disabled={busy} onClick={() => setShowIndent(true)}>
                    <Boxes className="size-4" /> Issue ingredients
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-zinc-500">
                  {inr(indent.total_cost)} of ingredients
                </span>
                {indent.shortfall_lines > 0 ? (
                  <span className="font-medium text-rose-700">
                    {indent.shortfall_lines} short on the shelf
                  </span>
                ) : (
                  <span className="font-medium text-emerald-700">
                    Stock covers the indent
                  </span>
                )}
                {indent.issued?.done && indent.issued?.outlet && (
                  <span className="text-emerald-700" dir="auto">
                    · from {indent.issued?.outlet?.split("-").pop()}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-start text-xs uppercase tracking-wider text-zinc-400">
                      <th className="py-2 pe-3 font-medium">Ingredient</th>
                      <th className="py-2 pe-3 text-end font-medium">Need</th>
                      <th className="py-2 pe-3 text-end font-medium">On hand</th>
                      <th className="py-2 text-end font-medium">Short</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indent.ingredients.map((r) => (
                      <tr key={r.ingredient} className="border-b border-zinc-100">
                        <td className="py-1.5 pe-3" dir="auto">
                          {r.ingredient_name}
                        </td>
                        <td className="py-1.5 pe-3 text-end tabular-nums font-medium">
                          {r.required} {r.uom}
                        </td>
                        <td className="py-1.5 pe-3 text-end tabular-nums text-zinc-500">
                          {r.on_hand}
                        </td>
                        <td
                          className={
                            "py-1.5 text-end tabular-nums " +
                            (r.short_by > 0
                              ? "font-medium text-rose-700"
                              : "text-zinc-300")
                          }
                        >
                          {r.short_by > 0 ? r.short_by : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>The night</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSupp(true)}>
                  <Plus className="size-4" /> Ordered on the night
                </Button>
                <Button disabled={!econ} onClick={() => setCounting(true)}>
                  <PackageCheck className="size-4" /> Count what was served
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-zinc-500">Guaranteed pax</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {fn.pax_guaranteed}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Actual pax</p>
                  <p className="text-lg font-semibold tabular-nums text-emerald-700">
                    {fn.pax_actual || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Extras</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {econ ? econ.lines.filter((l) => l.is_supplementary).length : 0}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Actual cost</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {econ ? inr(econ.cost.net) : "—"}
                  </p>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
                <Users className="size-3.5" />
                Record the actual pax and the quantities used against what was
                planned. "Served" equals the actual pax counted.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {showIndent && indent && (
        <IndentSheet
          indent={indent}
          property={fn.property}
          busy={busy}
          onClose={() => setShowIndent(false)}
          onIssue={(outlet) =>
            run(async () => {
              await banquet.issueIndent(name, outlet)
              setShowIndent(false)
            })
          }
        />
      )}
      {counting && econ && (
        <CountSheet
          data={econ}
          pax={fn.billable_pax}
          busy={busy}
          onClose={() => setCounting(false)}
          onSave={(rows, pax) =>
            run(async () => {
              await banquet.recordConsumption(name, rows, pax)
              setCounting(false)
            })
          }
        />
      )}
      {supp && (
        <SupplementarySheet
          busy={busy}
          onClose={() => setSupp(false)}
          onAdd={(params) =>
            run(async () => {
              await banquet.addSupplementary(name, params)
              setSupp(false)
            })
          }
        />
      )}
    </div>
  )
}
