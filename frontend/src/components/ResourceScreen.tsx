import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react"
import { Columns3, Download, ListFilter, Plus, Search, Trash2, X, type LucideIcon } from "lucide-react"
import { Sheet } from "./ui/sheet"
import { ContextPanel } from "./ContextPanel"
import { OnboardingEmptyState } from "./OnboardingEmptyState"
import { getCurrentProperty } from "../lib/api"
import {
  createResource,
  deleteResource,
  listResource,
  serverError,
  updateResource,
  type Row,
} from "../lib/resource"
import { frappeFetch } from "../lib/api"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Card } from "./ui/card"
import ImageField from "./ImageField"
import { Bilingual } from "./Bilingual"
import { BoardNav } from "./BoardNav"
import { moneyLocale } from "../lib/money"
import { useSearchParams } from "react-router-dom"

export interface FieldSpec {
  field: string
  label: string
  type: "data" | "int" | "float" | "currency" | "select" | "check" | "date" | "link" | "readonly" | "image"
  options?: string[] // for select
  linkDoctype?: string // for link
  required?: boolean
  hint?: string // for image: recommended size/format
  dependsOn?: (draft: Record<string, unknown>) => boolean
}

export interface ScreenConfig {
  doctype: string
  title: string
  description?: string
  columns: {
    field: string
    label: string
    badge?: boolean
    /** Render a bilingual "AR | EN" seed value as its primary-language name only. */
    bilingual?: boolean
    /** Resolve a Link-ID column to a readable label from `doctype`.`labelField`. */
    lookup?: { doctype: string; labelField: string }
    /** Custom cell renderer (gets the whole row). CSV export still uses the raw
     *  `field`, so keep `field` meaningful even for composite cells. */
    render?: (row: Row) => ReactNode
  }[]
  /** Extra fields to fetch (not shown as columns) — for composite renderers and
   *  the context panel, e.g. check_out_date/amount_after_tax/source. */
  extraFields?: string[]
  form: FieldSpec[]
  propertyScoped?: boolean
  allowCreate?: boolean
  allowDelete?: boolean
  orderBy?: string
  /** Fields searched (LIKE) by the search box. Adds a search input when set. */
  searchFields?: string[]
  /** Dropdown filters shown in the toolbar (e.g. status). */
  filters?: {
    field: string
    label: string
    /** Static choices; omit and set `optionsFrom` to derive them from the data. */
    options?: string[]
    /** Doctype fieldname to pull distinct values from (property-scoped) — e.g.
     * "floor", whose values vary per property. */
    optionsFrom?: string
  }[]
  /** Rows per page (adds pagination when set). */
  pageSize?: number
  /** Date-range filter on this date field (adds From/To pickers). */
  dateFilter?: { field: string; label: string }
  /** Show the Calendar/Tape/Rooms quick-switch above the screen (rooms board). */
  boardNav?: boolean
  /** Custom section rendered in the drawer below the form (existing rows only). */
  extra?: ComponentType<{ row: Row; reload: () => void }>
  /** Replace the generic edit form with a bespoke detail panel (existing rows).
   *  When set, the drawer opens wide and the panel owns its own actions. */
  detailPanel?: ComponentType<{
    row: Row
    reload: () => void
    onClose: () => void
  }>
  /** Oasis contextual summary panel: a row click opens a 372px side panel (no
   *  scrim, list stays visible) instead of the wide drawer. Its "Full details"
   *  action opens `detailPanel` via `onOpenDetail`. Opt-in — other screens keep
   *  the wide-drawer behaviour. */
  contextPanel?: ComponentType<{
    row: Row
    reload: () => void
    onClose: () => void
    onOpenDetail: () => void
  }>
  /** Zero-data onboarding shown in place of the generic "Nothing here yet." when
   *  there are no records AND no active search/filter. Its CTA is role-gated by
   *  the shared OnboardingEmptyState. Opt-in. */
  onboarding?: {
    icon?: LucideIcon
    title: string
    message: string
    cta?: { label: string; to: string }
    secondary?: { label: string; to: string }
    gatedNote?: string
  }
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm " +
  "focus:outline-2 focus:outline-offset-1 focus:outline-brand-600 " +
  "disabled:bg-zinc-50 disabled:text-zinc-400"

function FieldInput(props: {
  spec: FieldSpec
  value: unknown
  onChange: (v: unknown) => void
  linkOptions: Record<string, string[]>
}) {
  const { spec, value, onChange } = props
  switch (spec.type) {
    case "select":
      return (
        <select
          className={inputCls}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">-</option>
          {spec.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    case "link":
      return (
        <select
          className={inputCls}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">-</option>
          {(props.linkOptions[spec.linkDoctype ?? ""] ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    case "check":
      return (
        <input
          type="checkbox"
          className="size-4 accent-brand-600"
          checked={Boolean(Number(value ?? 0))}
          onChange={(e) => onChange(e.target.checked ? 1 : 0)}
        />
      )
    case "date":
      return (
        <input
          type="date"
          className={inputCls}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case "int":
    case "float":
    case "currency":
      return (
        <input
          type="number"
          className={inputCls}
          value={value === null || value === undefined ? "" : Number(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      )
    case "readonly":
      return (
        <input className={inputCls} disabled value={String(value ?? "")} />
      )
    case "image":
      return (
        <ImageField
          hint={spec.hint || "JPG/PNG/WebP · under 1 MB"}
          value={String(value ?? "")}
          onChange={(url) => onChange(url)}
        />
      )
    default:
      return (
        <input
          className={inputCls}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

const BADGE_TONES: Record<string, "green" | "sky" | "amber" | "rose" | "zinc"> = {
  Confirmed: "green", "Checked In": "sky", "Checked Out": "zinc",
  Cancelled: "rose", "No Show": "rose", Waitlist: "amber",
  Open: "amber", Closed: "zinc", Enquiry: "amber", Completed: "zinc",
  Clean: "green", Dirty: "amber", Inspected: "sky", "Out of Order": "rose",
  "In Progress": "sky", Done: "green",
  Urgent: "rose", High: "amber", Verified: "green",
}

const cellValue = (v: unknown) =>
  typeof v === "number"
    ? v.toLocaleString(moneyLocale(), { maximumFractionDigits: 2 })
    : String(v ?? "-")

export function ResourceScreen({
  config,
  headerAction,
}: {
  config: ScreenConfig
  /** Extra control rendered in the header next to New (e.g. a bulk import). */
  headerAction?: ReactNode
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const [contextRow, setContextRow] = useState<Row | null>(null)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [linkOptions, setLinkOptions] = useState<Record<string, string[]>>({})
  const [dynOptions, setDynOptions] = useState<Record<string, string[]>>({})
  const [search, setSearch] = useState("")
  // Frappe-style list settings: choose which columns this table shows,
  // remembered per user per doctype.
  const colsKey = `hotelpms:cols:${config.doctype}`
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(colsKey) || "[]"))
    } catch {
      return new Set()
    }
  })
  const [colsOpen, setColsOpen] = useState(false)
  const toggleCol = (field: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else if (next.size < config.columns.length - 1) next.add(field)
      localStorage.setItem(colsKey, JSON.stringify([...next]))
      return next
    })
  }
  const visibleCols = config.columns.filter((c) => !hiddenCols.has(c.field))
  const [debounced, setDebounced] = useState("")
  const [filterVals, setFilterVals] = useState<Record<string, string>>({})
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(0)
  const [lookupMaps, setLookupMaps] = useState<Record<string, Record<string, string>>>({})
  const [searchParams, setSearchParams] = useSearchParams()

  const pageSize = config.pageSize ?? 0

  const fields = Array.from(
    new Set([
      "name",
      ...config.columns.map((c) => c.field),
      ...(config.extraFields ?? []),
    ]),
  )

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // seed filters from the URL once on mount, e.g. /rooms?housekeeping_status=Dirty
  // (deep-links from the dashboard, and to restore state on reload).
  useEffect(() => {
    const seed: Record<string, string> = {}
    config.filters?.forEach((f) => {
      const v = searchParams.get(f.field)
      if (v) seed[f.field] = v
    })
    if (Object.keys(seed).length) setFilterVals((prev) => ({ ...prev, ...seed }))
    const q = searchParams.get("q")
    if (q) setSearch(q)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    if (from) setDateFrom(from)
    if (to) setDateTo(to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // mirror the active filters/search back into the URL so a reload or a shared
  // link keeps them. Skip the first run so the mount-seed above isn't wiped.
  const didSyncMount = useRef(false)
  useEffect(() => {
    if (!didSyncMount.current) {
      didSyncMount.current = true
      return
    }
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p)
        for (const f of config.filters ?? []) {
          const v = filterVals[f.field]
          if (v) next.set(f.field, v)
          else next.delete(f.field)
        }
        if (debounced) next.set("q", debounced)
        else next.delete("q")
        if (config.dateFilter) {
          if (dateFrom) next.set("from", dateFrom)
          else next.delete("from")
          if (dateTo) next.set("to", dateTo)
          else next.delete("to")
        }
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterVals, debounced, dateFrom, dateTo])

  // resolve Link-ID columns to their readable label once per screen
  useEffect(() => {
    config.columns
      .filter((c) => c.lookup)
      .forEach((c) => {
        listResource(c.lookup!.doctype, {
          fields: ["name", c.lookup!.labelField],
          limit: 500,
          orderBy: "name asc",
        })
          .then((r) =>
            setLookupMaps((prev) => ({
              ...prev,
              [c.field]: Object.fromEntries(
                r.map((x) => [x.name, String(x[c.lookup!.labelField] ?? x.name)]),
              ),
            })),
          )
          .catch(() => {})
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.doctype])

  // any search/filter change resets to the first page
  useEffect(() => setPage(0), [debounced, filterVals, dateFrom, dateTo])

  const load = useCallback(() => {
    setLoading(true)
    const filters: (string | number)[][] = []
    if (config.propertyScoped)
      filters.push(["property", "=", getCurrentProperty()])
    for (const [field, val] of Object.entries(filterVals))
      if (val) filters.push([field, "=", val])
    if (config.dateFilter?.field) {
      if (dateFrom) filters.push([config.dateFilter.field, ">=", dateFrom])
      if (dateTo) filters.push([config.dateFilter.field, "<=", dateTo])
    }
    const orFilters =
      debounced && config.searchFields?.length
        ? config.searchFields.map((f) => [f, "like", `%${debounced}%`])
        : undefined
    listResource(config.doctype, {
      fields,
      filters: filters.length ? filters : undefined,
      orFilters,
      orderBy: config.orderBy,
      limit: pageSize || 100,
      start: pageSize ? page * pageSize : 0,
    })
      .then((r) => {
        setRows(r)
        setError(null)
        setErrorStatus(null)
      })
      .catch((e) => {
        setError(serverError(e))
        setErrorStatus((e as { status?: number })?.status ?? null)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.doctype, debounced, filterVals, page, dateFrom, dateTo])

  useEffect(load, [load])

  async function exportCsv() {
    const filters: (string | number)[][] = []
    if (config.propertyScoped)
      filters.push(["property", "=", getCurrentProperty()])
    for (const [field, val] of Object.entries(filterVals))
      if (val) filters.push([field, "=", val])
    if (config.dateFilter?.field) {
      if (dateFrom) filters.push([config.dateFilter.field, ">=", dateFrom])
      if (dateTo) filters.push([config.dateFilter.field, "<=", dateTo])
    }
    const orFilters =
      debounced && config.searchFields?.length
        ? config.searchFields.map((f) => [f, "like", `%${debounced}%`])
        : undefined
    const all = await listResource(config.doctype, {
      fields,
      filters: filters.length ? filters : undefined,
      orFilters,
      orderBy: config.orderBy,
      limit: 2000,
    })
    const cols = visibleCols
    const esc = (v: unknown) => {
      const t = String(v ?? "")
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
    }
    const csv = [
      cols.map((c) => esc(c.label)).join(","),
      ...all.map((r) =>
        cols
          .map((c) =>
            esc(c.lookup ? lookupMaps[c.field]?.[String(r[c.field])] ?? r[c.field] : r[c.field]),
          )
          .join(","),
      ),
    ].join("\n")
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${config.doctype.toLowerCase().replace(/ /g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // load link options once per screen
  useEffect(() => {
    const links = config.form.filter((f) => f.type === "link" && f.linkDoctype)
    links.forEach((f) => {
      listResource(f.linkDoctype!, {
        fields: ["name"],
        filters: undefined,
        limit: 100,
        orderBy: "name asc",
      }).then((r) =>
        setLinkOptions((prev) => ({
          ...prev,
          [f.linkDoctype!]: r.map((x) => x.name),
        })),
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.doctype])

  // derive dynamic filter options (e.g. floors) from distinct field values
  useEffect(() => {
    ;(config.filters ?? []).forEach((f) => {
      if (!f.optionsFrom) return
      const scope: (string | number)[][] = []
      if (config.propertyScoped)
        scope.push(["property", "=", getCurrentProperty()])
      listResource(config.doctype, {
        fields: [f.optionsFrom],
        filters: scope.length ? scope : undefined,
        limit: 1000,
        orderBy: `${f.optionsFrom} asc`,
      }).then((r) => {
        const vals = [
          ...new Set(
            r.map((x) => String(x[f.optionsFrom!] ?? "").trim()).filter(Boolean),
          ),
        ]
        setDynOptions((prev) => ({ ...prev, [f.field]: vals }))
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.doctype])

  function openEdit(row: Row | "new") {
    setEditing(row)
    setError(null)
    if (row === "new") {
      setDraft({})
      return
    }
    // List rows only carry column fields — fetch the full document so
    // form extras (location, slugs, etc.) aren't blank and can't wipe DB values.
    setDraft({ ...row })
    frappeFetch<{ data: Row }>(
      `/api/resource/${encodeURIComponent(config.doctype)}/${encodeURIComponent(row.name)}`,
    )
      .then((r) => setDraft(r.data))
      .catch((e) => setError(serverError(e)))
  }

  async function save() {
    setBusy(true)
    try {
      // Only persist form fields — never the raw list-row or full-doc dump.
      const payload: Record<string, unknown> = {}
      for (const f of config.form) {
        if (f.type === "readonly") continue
        if (f.field in draft) payload[f.field] = draft[f.field]
      }
      if (config.propertyScoped) payload.property = getCurrentProperty()
      if (editing === "new") {
        await createResource(config.doctype, payload)
      } else if (editing) {
        await updateResource(config.doctype, editing.name, payload)
      }
      setEditing(null)
      load()
    } catch (e) {
      setError(serverError(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (editing === "new" || !editing) return
    setBusy(true)
    try {
      await deleteResource(config.doctype, editing.name)
      setEditing(null)
      load()
    } catch (e) {
      setError(serverError(e))
    } finally {
      setBusy(false)
    }
  }

  const isFiltered = Boolean(
    debounced ||
      Object.values(filterVals).some(Boolean) ||
      dateFrom ||
      dateTo,
  )
  const permissionDenied = errorStatus === 401 || errorStatus === 403
  const activeFilterCount =
    Object.values(filterVals).filter(Boolean).length +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)

  const clearFilters = () => {
    setSearch("")
    setFilterVals({})
    setDateFrom("")
    setDateTo("")
  }

  return (
    <div className={"oasis-resource-screen" + (contextRow ? " lg:pe-[392px]" : "")}>
      {config.boardNav && <BoardNav className="mb-4" />}

      <div className="oasis-resource-head">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-brand-700">
            <span className="size-1.5 rounded-full bg-gold-500" aria-hidden />
            HotelPMS · {config.doctype}
          </div>
          <h1>{config.title}</h1>
          {config.description && (
            <p>
              {config.description}
            </p>
          )}
        </div>
        <div className="oasis-resource-actions">
          {headerAction}
          {!permissionDenied && (
            <Button variant="outline" onClick={exportCsv}>
              <Download className="size-4" aria-hidden />
              Export
            </Button>
          )}
          {config.allowCreate !== false && !permissionDenied && (
            <Button onClick={() => openEdit("new")}>
              <Plus className="size-4" aria-hidden />
              New
            </Button>
          )}
        </div>
      </div>

      <Card className="oasis-resource-card">
        {error && !editing && !permissionDenied && (
          <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        <div className="oasis-filterbar">
            <div className="oasis-filter-label">
              <ListFilter className="size-4" aria-hidden />
              <span>Filters</span>
              {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
            </div>
            {config.searchFields?.length ? (
              <div className="oasis-list-search">
                <Search className="pointer-events-none size-4 text-zinc-400" aria-hidden />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  aria-label="Search"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                    <X className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>
            ) : null}
            {config.filters?.map((f) => (
              <select
                key={f.field}
                value={filterVals[f.field] ?? ""}
                onChange={(e) =>
                  setFilterVals((v) => ({ ...v, [f.field]: e.target.value }))
                }
                className="oasis-filter-select"
              >
                <option value="">{f.label}: all</option>
                {(f.options ?? dynOptions[f.field] ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ))}
            {config.dateFilter && (
              <div className="oasis-date-filter">
                <span className="text-xs">{config.dateFilter.label}</span>
                <input
                  type="date"
                  aria-label={`${config.dateFilter.label} from`}
                  className="oasis-filter-select"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <span className="text-xs">to</span>
                <input
                  type="date"
                  aria-label={`${config.dateFilter.label} to`}
                  className="oasis-filter-select"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
                {(dateFrom || dateTo) && (
                  <button
                    className="text-xs text-zinc-400 hover:text-zinc-600"
                    onClick={() => {
                      setDateFrom("")
                      setDateTo("")
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
            <div className="relative ms-auto flex items-center gap-2">
              {isFiltered && (
                <button type="button" onClick={clearFilters} className="oasis-clear-filters">
                  <X className="size-3.5" aria-hidden />
                  Clear all
                </button>
              )}
              <button
                onClick={() => setColsOpen((o) => !o)}
                title="Choose which columns this table shows"
                aria-label="Configure table columns"
                className="oasis-columns-button"
              >
                <Columns3 className="size-4" aria-hidden />
                Columns
              </button>
              {colsOpen && (
                <div className="absolute end-0 top-11 z-30 w-56 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl">
                  {config.columns.map((c) => (
                    <label
                      key={c.field}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-600"
                        checked={!hiddenCols.has(c.field)}
                        onChange={() => toggleCol(c.field)}
                      />
                      {c.label}
                    </label>
                  ))}
                  <button
                    className="mt-1 w-full rounded-lg px-2 py-1 text-left text-xs text-zinc-400 hover:text-zinc-600"
                    onClick={() => setColsOpen(false)}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>

        <div className="oasis-list-meta">
          <span><b className="tabular-nums text-zinc-800">{rows.length}</b> records in this view</span>
          {isFiltered && <span>Filtered results</span>}
        </div>

        <div className="oasis-table-wrap">
          <table className="oasis-data-table">
            <thead>
              <tr>
                {visibleCols.map((c) => (
                  <th key={c.field}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.name}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${String(row.name)}`}
                  className={
                    "oasis-data-row" +
                    (contextRow?.name === row.name ? " is-selected" : "")
                  }
                  onClick={() =>
                    config.contextPanel ? setContextRow(row) : openEdit(row)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      config.contextPanel ? setContextRow(row) : openEdit(row)
                    }
                  }}
                >
                  {visibleCols.map((c) => (
                    <td
                      key={c.field}
                      className={
                        "" +
                        (typeof row[c.field] === "number"
                          ? " text-right tabular-nums"
                          : "")
                      }
                    >
                      {c.render ? (
                        c.render(row)
                      ) : c.badge && row[c.field] ? (
                        <Badge
                          tone={BADGE_TONES[String(row[c.field])] ?? "zinc"}
                        >
                          {String(row[c.field])}
                        </Badge>
                      ) : c.lookup ? (
                        <Bilingual
                          value={
                            lookupMaps[c.field]?.[String(row[c.field])] ??
                            String(row[c.field] ?? "")
                          }
                          primaryOnly
                        />
                      ) : c.bilingual ? (
                        <Bilingual value={String(row[c.field] ?? "")} primaryOnly />
                      ) : (
                        cellValue(row[c.field])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {loading &&
                rows.length === 0 &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td colSpan={config.columns.length} className="py-2">
                      <div className="h-5 animate-pulse rounded bg-zinc-100" />
                    </td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={config.columns.length} className="p-0">
                    {permissionDenied ? (
                      <OnboardingEmptyState
                        variant="denied"
                        title="You don't have access to this list"
                        message="Your role can't view these records. Ask a hotel administrator if you need access."
                      />
                    ) : isFiltered ? (
                      <div className="py-8 text-center text-sm text-zinc-400">
                        No matches for your search or filters.
                      </div>
                    ) : config.onboarding ? (
                      <OnboardingEmptyState {...config.onboarding} />
                    ) : (
                      <div className="py-6 text-center text-sm text-zinc-400">
                        Nothing here yet.
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pageSize > 0 && (page > 0 || rows.length >= pageSize) && (
          <div className="oasis-pagination">
            <span>Page {page + 1}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                disabled={rows.length < pageSize}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {editing && (() => {
        const useDetail = editing !== "new" && !!config.detailPanel
        return (
        <Sheet
          wide
          title={
            editing === "new"
              ? `New ${config.title.replace(/s$/, "")}`
              : String(editing.name)
          }
          description={useDetail ? undefined : config.description}
          onClose={() => setEditing(null)}
          footer={
            useDetail ? undefined : (
            <div className="flex items-center justify-between">
              {editing !== "new" && config.allowDelete !== false ? (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={remove}
                  aria-label="Delete"
                >
                  <Trash2 className="size-4 text-rose-500" aria-hidden />
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button disabled={busy} onClick={save}>
                  {busy ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
            )
          }
        >
          {useDetail && config.detailPanel ? (
            <config.detailPanel
              row={editing}
              reload={load}
              onClose={() => setEditing(null)}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                {config.form.filter(spec => spec.dependsOn ? spec.dependsOn(draft) : true).map((spec) => (
                  <label
                    key={spec.field}
                    className={
                      "block" +
                      (spec.type === "check" ? " sm:col-span-2" : "")
                    }
                  >
                    <span className="mb-1.5 block text-sm font-medium text-zinc-600">
                      {spec.label}
                      {spec.required && <span className="text-rose-500"> *</span>}
                    </span>
                    <FieldInput
                      spec={spec}
                      value={draft[spec.field]}
                      onChange={(v) =>
                        setDraft((d) => ({ ...d, [spec.field]: v }))
                      }
                      linkOptions={linkOptions}
                    />
                  </label>
                ))}
              </div>
              {editing !== "new" && config.extra && (
                <config.extra row={editing} reload={load} />
              )}
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              )}
            </div>
          )}
        </Sheet>
        )
      })()}
      {contextRow && config.contextPanel && (
        <ContextPanel
          label={String(contextRow.name)}
          onClose={() => setContextRow(null)}
        >
          <config.contextPanel
            key={String(contextRow.name)}
            row={contextRow}
            reload={load}
            onClose={() => setContextRow(null)}
            onOpenDetail={() => {
              const r = contextRow
              setContextRow(null)
              openEdit(r)
            }}
          />
        </ContextPanel>
      )}
    </div>
  )
}
