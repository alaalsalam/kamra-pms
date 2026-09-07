import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  CheckCircle2,
  Coins,
  FileText,
  FolderOpen,
  Loader2,
  MoonStar,
  RotateCw,
  Wallet,
} from "lucide-react"
import { call, getCurrentProperty, isAuthError } from "../lib/api"
import { listResource, serverError, type Row } from "../lib/resource"
import { useT, qty, fill } from "../lib/i18n"
import { cur, moneyLocale, dateLocale, taxLabel } from "../lib/money"
import { cn } from "../lib/utils"
import { ScreenHeader, type HeaderStat } from "../components/ScreenHeader"
import { OnboardingEmptyState } from "../components/OnboardingEmptyState"
import { folioStatusCell } from "./folioCells"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"

const inr = (n: unknown) =>
  Number(n ?? 0).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

const fmtDate = (d: unknown) =>
  d
    ? new Date(String(d) + "T00:00:00").toLocaleDateString(dateLocale(), {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-"
const fmtWhen = (d: unknown) =>
  d
    ? new Date(String(d).replace(" ", "T").slice(0, 19)).toLocaleString(
        dateLocale(),
        { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" },
      )
    : ""

/** A currency amount, bidi-isolated so it reads correctly inside RTL. */
function Money({ value, className }: { value: unknown; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("tabular-nums", className)}>
      {cur()}
      {inr(value)}
    </bdi>
  )
}

interface CashSummary {
  date: string
  modes: { mode: string; txns: number; total: number }[]
  grand_total: number
}

interface AuditResult {
  audit?: string
  already_ran?: boolean
  room_charges_posted?: number
  amount_posted?: number
  no_shows_flagged?: number
  folios_opened?: number
}

function BillingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading billing">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[4.75rem] animate-pulse rounded-xl border border-zinc-200 bg-zinc-100" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100" />
      <div className="h-28 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100" />
      <div className="h-72 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100" />
    </div>
  )
}

export default function Billing() {
  const { t } = useT()
  const navigate = useNavigate()

  const [folios, setFolios] = useState<Row[]>([])
  const [cash, setCash] = useState<CashSummary | null>(null)
  const [audit, setAudit] = useState<AuditResult | null>(null)
  const [auditErr, setAuditErr] = useState<string | null>(null)
  const [auditRuns, setAuditRuns] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)

  const load = useCallback(async (opts?: { skeleton?: boolean }) => {
    if (opts?.skeleton) setLoading(true)
    setError(null)
    try {
      // Only the Folio list drives the screen's error/denied state; the cash
      // summary and audit runs are secondary and degrade to empty on failure.
      const [f, c, runs] = await Promise.all([
        listResource("Folio", {
          fields: [
            "name", "guest_name", "reservation", "status", "invoice_number",
            "grand_total", "payments_total", "balance",
          ],
          filters: [["property", "=", getCurrentProperty()]],
          orderBy: "modified desc",
        }),
        call<CashSummary>("hotelpms.api.cash_summary", {
          property: getCurrentProperty(),
        }).catch(() => null),
        listResource("Night Audit Run", {
          fields: [
            "name", "business_date", "status", "room_charges_posted",
            "amount_posted", "no_shows_flagged", "folios_opened", "creation",
          ],
          filters: [["property", "=", getCurrentProperty()]],
          orderBy: "creation desc",
          limit: 8,
        }).catch(() => [] as Row[]),
      ])
      setFolios(f)
      setCash(c)
      setAuditRuns(runs)
      setDenied(false)
    } catch (e) {
      if (isAuthError(e)) setDenied(true)
      else setError(serverError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load({ skeleton: true })
  }, [load])

  async function runAudit() {
    setBusy(true)
    setAuditErr(null)
    setAudit(null)
    try {
      const res = await call<AuditResult>("hotelpms.api.run_night_audit", {
        property: getCurrentProperty(),
      })
      setAudit(res)
      load()
    } catch (e) {
      setAuditErr(serverError(e))
    } finally {
      setBusy(false)
    }
  }

  const stats = useMemo<HeaderStat[]>(() => {
    const openFolios = folios.filter((f) => String(f.status) === "Open").length
    const outstanding = folios.reduce((s, f) => s + Number(f.balance ?? 0), 0)
    return [
      {
        key: "open",
        label: "Open folios",
        value: openFolios,
        icon: FolderOpen,
        tone: "brand",
      },
      {
        key: "outstanding",
        label: "Outstanding balance",
        value: <Money value={outstanding} />,
        icon: Wallet,
        tone: "gold",
      },
      {
        key: "collections",
        label: "Today's collections",
        value: <Money value={cash?.grand_total ?? 0} />,
        icon: Coins,
        tone: "brand",
      },
      {
        key: "count",
        label: "Folios",
        value: folios.length,
        icon: FileText,
        tone: "zinc",
      },
    ]
  }, [folios, cash])

  const ready = !loading && !error && !denied

  const header = (
    <ScreenHeader
      title={t("Billing")}
      context={t("Folios, the night audit and today's collections")}
      stats={ready ? stats : undefined}
    />
  )

  const go = (name: string) => navigate(`/billing/${encodeURIComponent(name)}`)

  // Compact stat line reused by the fresh audit result and each recent run.
  const auditMeta = (r: {
    nights: number
    amount: unknown
    folios: number
    noShows: number
  }) => (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span>{qty(r.nights, "night")}</span>
      <span aria-hidden className="text-zinc-300">·</span>
      <span>
        {t("Posted")} <Money value={r.amount} />
      </span>
      <span aria-hidden className="text-zinc-300">·</span>
      <span>
        {t("Folios opened")} <bdi dir="ltr" className="tabular-nums">{r.folios}</bdi>
      </span>
      <span aria-hidden className="text-zinc-300">·</span>
      <span>
        {t("No-shows")} <bdi dir="ltr" className="tabular-nums">{r.noShows}</bdi>
      </span>
    </span>
  )

  const auditCard = (
    <Card>
      <CardHeader className="flex-wrap">
        <div className="min-w-0">
          <CardTitle>Night audit</CardTitle>
          <p className="mt-0.5 text-xs text-zinc-400">
            Posts tonight's room charges for every in-house guest and flags
            no-shows. Runs automatically at 3 AM; run it manually anytime.
          </p>
        </div>
        <Button disabled={busy} onClick={runAudit} className="min-h-11">
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <MoonStar className="size-4" aria-hidden />
          )}
          {busy ? "Running…" : "Run night audit"}
        </Button>
      </CardHeader>

      {auditErr && (
        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <span>{auditErr}</span>
            <button
              className="min-h-11 shrink-0 font-semibold underline"
              onClick={runAudit}
            >
              {t("Retry")}
            </button>
          </div>
        </CardContent>
      )}

      {audit && (
        <CardContent className="pt-0">
          {audit.already_ran ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600">
              {fill(t("Night audit already ran today ({name})"), {
                name: String(audit.audit ?? ""),
              })}
            </p>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                {fill(t("Night audit {name} complete"), {
                  name: String(audit.audit ?? ""),
                })}
              </p>
              <div className="mt-1.5 text-xs text-emerald-700">
                {auditMeta({
                  nights: Number(audit.room_charges_posted) || 0,
                  amount: audit.amount_posted,
                  folios: Number(audit.folios_opened) || 0,
                  noShows: Number(audit.no_shows_flagged) || 0,
                })}
              </div>
            </div>
          )}
        </CardContent>
      )}

      {auditRuns.length > 0 && (
        <CardContent className="pt-0">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400">
            Recent runs
          </div>
          <ul className="divide-y divide-zinc-100 text-sm">
            {auditRuns.map((r) => (
              <li
                key={String(r.name)}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1.5"
              >
                <span className="w-28 shrink-0 font-medium">
                  <bdi dir="ltr">{fmtDate(r.business_date)}</bdi>
                </span>
                <span className="min-w-0 flex-1 text-zinc-500">
                  {auditMeta({
                    nights: Number(r.room_charges_posted) || 0,
                    amount: r.amount_posted,
                    folios: Number(r.folios_opened) || 0,
                    noShows: Number(r.no_shows_flagged) || 0,
                  })}
                </span>
                <span className="text-xs text-zinc-400">
                  {fill(t("ran {when}"), { when: fmtWhen(r.creation) })}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  )

  const collectionsCard = (
    <Card>
      <CardHeader className="flex-wrap">
        <div className="min-w-0">
          <CardTitle>Today's collections</CardTitle>
          <p className="mt-0.5 text-xs text-zinc-400">
            What the system says was collected - the drawer must match this
            at shift close.
          </p>
        </div>
        <span className="text-xl font-semibold text-zinc-900">
          <Money value={cash?.grand_total ?? 0} />
        </span>
      </CardHeader>
      {cash && cash.modes.length > 0 && (
        <CardContent className="flex flex-wrap gap-2 pt-0">
          {cash.modes.map((m) => (
            <Badge key={m.mode} tone="zinc">
              {m.mode} <Money value={m.total} className="ms-1 font-semibold" />{" "}
              <span aria-hidden className="mx-1 text-zinc-400">·</span>
              <bdi dir="ltr" className="tabular-nums">{m.txns}</bdi>&nbsp;{t("txn")}
            </Badge>
          ))}
        </CardContent>
      )}
    </Card>
  )

  const foliosCard = (
    <Card>
      <CardHeader>
        <CardTitle>Folios</CardTitle>
        <span className="text-xs text-zinc-400">
          {t(`Click a folio to post charges, settle and print the ${taxLabel()} invoice`)}
        </span>
      </CardHeader>
      <CardContent>
        {folios.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">
            No folios yet - they open automatically at check-in.
          </p>
        ) : (
          <>
            {/* Desktop: dense financial table. */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-start text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <th className="py-2 pe-4 text-start font-medium">Folio</th>
                    <th className="py-2 pe-4 text-start font-medium">Guest</th>
                    <th className="py-2 pe-4 text-start font-medium">Status</th>
                    <th className="py-2 pe-4 text-start font-medium">Invoice</th>
                    <th className="py-2 pe-4 text-start font-medium">Total</th>
                    <th className="py-2 pe-4 text-start font-medium">Paid</th>
                    <th className="py-2 pe-4 text-start font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {folios.map((f) => {
                    const bal = Number(f.balance ?? 0)
                    return (
                      <tr
                        key={f.name}
                        role="button"
                        tabIndex={0}
                        aria-label={`${t("Folio")} ${f.name}`}
                        onClick={() => go(f.name)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            go(f.name)
                          }
                        }}
                        className="cursor-pointer transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
                      >
                        <td className="py-2.5 pe-4 font-medium">
                          <bdi dir="ltr">{f.name}</bdi>
                        </td>
                        <td className="py-2.5 pe-4">{String(f.guest_name ?? "-")}</td>
                        <td className="py-2.5 pe-4">{folioStatusCell(f.status)}</td>
                        <td className="py-2.5 pe-4 text-zinc-500">
                          {f.invoice_number ? (
                            <bdi dir="ltr">{String(f.invoice_number)}</bdi>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-2.5 pe-4">
                          <Money value={f.grand_total} />
                        </td>
                        <td className="py-2.5 pe-4">
                          <Money value={f.payments_total} />
                        </td>
                        <td className="py-2.5 pe-4 font-semibold">
                          {bal > 0 ? (
                            <Money value={bal} className="text-gold-700" />
                          ) : (
                            <Money value={0} className="text-emerald-600" />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: one tappable card per folio, no horizontal overflow. */}
            <ul className="space-y-2.5 sm:hidden">
              {folios.map((f) => {
                const bal = Number(f.balance ?? 0)
                return (
                  <li key={f.name}>
                    <Link
                      to={`/billing/${encodeURIComponent(f.name)}`}
                      className="block rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-brand-200 hover:bg-brand-50/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-zinc-900">
                            {String(f.guest_name ?? "-")}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-zinc-400">
                            <bdi dir="ltr">{f.name}</bdi>
                            {f.invoice_number ? (
                              <>
                                {" · "}
                                <bdi dir="ltr">{String(f.invoice_number)}</bdi>
                              </>
                            ) : null}
                          </div>
                        </div>
                        {folioStatusCell(f.status)}
                      </div>
                      <dl className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <dt className="text-zinc-400">Total</dt>
                          <dd className="mt-0.5 font-medium text-zinc-800">
                            <Money value={f.grand_total} />
                          </dd>
                        </div>
                        <div>
                          <dt className="text-zinc-400">Paid</dt>
                          <dd className="mt-0.5 font-medium text-zinc-800">
                            <Money value={f.payments_total} />
                          </dd>
                        </div>
                        <div>
                          <dt className="text-zinc-400">Balance</dt>
                          <dd className="mt-0.5 font-semibold">
                            {bal > 0 ? (
                              <Money value={bal} className="text-gold-700" />
                            ) : (
                              <Money value={0} className="text-emerald-600" />
                            )}
                          </dd>
                        </div>
                      </dl>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4">
      {header}
      {denied ? (
        <OnboardingEmptyState
          variant="denied"
          title={t("You don't have access to billing")}
          message={t(
            "Billing is for reception, finance and management. Ask a hotel administrator if you need access.",
          )}
        />
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium text-rose-700">{error}</p>
            <Button
              variant="outline"
              className="mt-3 min-h-11"
              onClick={() => load({ skeleton: true })}
            >
              <RotateCw className="size-4" aria-hidden /> {t("Try again")}
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <BillingSkeleton />
      ) : (
        <>
          {auditCard}
          {collectionsCard}
          {foliosCard}
        </>
      )}
    </div>
  )
}
