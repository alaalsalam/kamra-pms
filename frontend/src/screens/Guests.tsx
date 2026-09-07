import { useEffect, useMemo, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  Mail,
  Phone,
  Repeat,
  RotateCw,
  Search,
  Star,
  Users,
  Wallet,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { call, isAuthError } from "../lib/api"
import { serverError } from "../lib/resource"
import type { ShellContext } from "../AppShell"
import { fill, qty, useT } from "../lib/i18n"
import { cur, moneyLocale, dateLocale } from "../lib/money"
import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import { Avatar } from "../components/ui/avatar"
import { ScreenHeader, type HeaderStat } from "../components/ScreenHeader"
import { OnboardingEmptyState } from "../components/OnboardingEmptyState"

interface GuestRow {
  name: string
  full_name: string
  phone: string | null
  email: string | null
  vip: 0 | 1
  bookings: number
  stays: number
  nights: number
  lifetime_value: number
  // MAX(check_in_date) over every reservation — may be a past OR a future date.
  last_stay: string | null
}

const PAGE = 25

const inr = (n: unknown) =>
  Number(n ?? 0).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function fmtDate(iso: string) {
  // Parse as local midnight — a bare `new Date(iso)` treats it as UTC and shifts
  // the day back in any UTC+ timezone.
  return new Date(iso + "T00:00:00").toLocaleDateString(dateLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const inputCls =
  "min-h-11 w-full rounded-xl border border-zinc-300 bg-white ps-9 pe-3 text-sm " +
  "focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"

function FilterPill({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  label: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600",
        active
          ? "border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100"
          : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50",
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label}
      {active && <X className="size-3.5 shrink-0" aria-hidden />}
    </button>
  )
}

// Recency of the guest's most recent booking — semantic colour + icon + text,
// never colour alone. Upcoming (future date) vs a past stay vs none at all.
function stayMeta(lastStay: string | null, today: string) {
  if (!lastStay)
    return {
      icon: CalendarOff,
      cls: "bg-zinc-50 text-zinc-400 ring-zinc-200",
      label: "No stays yet",
      date: null as string | null,
    }
  const upcoming = lastStay > today
  return upcoming
    ? {
        icon: CalendarClock,
        cls: "bg-brand-50 text-brand-700 ring-brand-200",
        label: "Upcoming",
        date: fmtDate(lastStay),
      }
    : {
        icon: CalendarCheck2,
        cls: "bg-zinc-100 text-zinc-600 ring-zinc-200",
        label: "Last stay",
        date: fmtDate(lastStay),
      }
}

function GuestListItem({ g, today }: { g: GuestRow; today: string }) {
  const { t } = useT()
  const vip = Boolean(g.vip)
  const stays = Number(g.stays ?? 0)
  const nights = Number(g.nights ?? 0)
  const value = Number(g.lifetime_value ?? 0)
  const meta = stayMeta(g.last_stay, today)
  const StayIcon = meta.icon
  const returning = stays > 1

  return (
    <Link
      to={`/guests/${encodeURIComponent(g.name)}`}
      aria-label={g.full_name}
      className={cn(
        "group flex min-h-11 flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm transition-colors",
        "hover:border-brand-300 hover:bg-brand-50/30 active:bg-brand-50/60",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        "sm:flex-row sm:items-center sm:gap-4 sm:p-4",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar
          name={g.full_name}
          className={cn(
            "size-10",
            vip && "ring-2 ring-amber-400 ring-offset-1 ring-offset-white",
          )}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold text-zinc-900">
              {g.full_name}
            </span>
            {vip && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-600/20">
                <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
                {t("VIP")}
              </span>
            )}
            {returning && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                <Repeat className="size-3" aria-hidden />
                {t("Returning")}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-zinc-500">
            {g.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3 shrink-0 text-zinc-400" aria-hidden />
                <bdi dir="ltr" className="tabular-nums">
                  {g.phone}
                </bdi>
              </span>
            )}
            {g.email && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Mail className="size-3 shrink-0 text-zinc-400" aria-hidden />
                <bdi dir="ltr" className="truncate">
                  {g.email}
                </bdi>
              </span>
            )}
            {!g.phone && !g.email && <span>{t("No contact details")}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
            meta.cls,
          )}
        >
          <StayIcon className="size-3.5 shrink-0" aria-hidden />
          {t(meta.label)}
          {meta.date && (
            <bdi dir="ltr" className="tabular-nums">
              {meta.date}
            </bdi>
          )}
        </span>

        <span className="whitespace-nowrap text-xs text-zinc-500">
          {qty(stays, "stay")}{" "}
          <span className="text-zinc-300" aria-hidden>
            ·
          </span>{" "}
          {qty(nights, "night")}
        </span>

        <span className="min-w-[5rem] text-end">
          <span className="block text-[11px] font-medium text-zinc-400">
            {t("Lifetime")}
          </span>
          <bdi
            dir="ltr"
            className={cn(
              "block font-semibold tabular-nums",
              value > 0 ? "text-gold-700" : "text-zinc-400",
            )}
          >
            {value > 0 ? (
              <>
                {cur()}
                {inr(value)}
              </>
            ) : (
              "—"
            )}
          </bdi>
        </span>
      </div>
    </Link>
  )
}

export default function Guests() {
  const { t } = useT()
  const { openBooking, canCreateBooking } = useOutletContext<ShellContext>()

  const [rows, setRows] = useState<GuestRow[]>([])
  const [search, setSearch] = useState("")
  const [vipOnly, setVipOnly] = useState(false)
  const [returningOnly, setReturningOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const today = isoToday()

  // Debounced server search (name / phone). rows are never cleared on a new
  // query, so a refetch dims the current list instead of unmounting it.
  useEffect(() => {
    setLoading(true)
    setError(null)
    setDenied(false)
    const timer = setTimeout(() => {
      call<GuestRow[]>("hotelpms.api.guests_with_stats", {
        search: search || undefined,
      })
        .then((r) => {
          setRows(r)
          setPage(0)
        })
        .catch((e) => {
          if (isAuthError(e)) {
            setDenied(true)
            setRows([])
          } else setError(serverError(e))
        })
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [search, reloadKey])

  useEffect(() => {
    setPage(0)
  }, [vipOnly, returningOnly])

  const hasFilters = search.trim() !== "" || vipOnly || returningOnly
  const clearAll = () => {
    setSearch("")
    setVipOnly(false)
    setReturningOnly(false)
  }

  const filtered = useMemo(() => {
    let list = rows
    if (vipOnly) list = list.filter((g) => Boolean(g.vip))
    if (returningOnly) list = list.filter((g) => Number(g.stays) > 1)
    return list
  }, [rows, vipOnly, returningOnly])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE))
  const safePage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE)

  // KPI tiles read the whole server result (pre client-side filter) so they stay
  // a stable summary of the dataset. In-house isn't derivable from this payload.
  const stats = useMemo<HeaderStat[]>(() => {
    const vips = rows.filter((g) => Boolean(g.vip)).length
    const returning = rows.filter((g) => Number(g.stays) > 1).length
    const lifetime = rows.reduce((s, g) => s + Number(g.lifetime_value ?? 0), 0)
    return [
      {
        key: "total",
        label: t("Guests"),
        // The endpoint caps at 200 rows — signal there may be more.
        value: rows.length >= 200 ? "200+" : rows.length,
        icon: Users,
        tone: "brand",
      },
      { key: "vip", label: t("VIPs"), value: vips, icon: Star, tone: "gold" },
      {
        key: "ret",
        label: t("Returning"),
        value: returning,
        icon: Repeat,
        tone: "brand",
      },
      {
        key: "ltv",
        label: t("Lifetime value"),
        value: (
          <bdi dir="ltr">
            {cur()}
            {inr(lifetime)}
          </bdi>
        ),
        icon: Wallet,
        tone: "gold",
      },
    ]
  }, [rows, t])

  const header = (
    <ScreenHeader
      title={t("Guests")}
      context={t("Search guests and their history")}
      stats={rows.length > 0 ? stats : undefined}
      primaryAction={
        canCreateBooking ? (
          <Button
            variant="primary"
            className="min-h-11"
            onClick={() => openBooking({})}
          >
            <CalendarDays className="size-4" aria-hidden /> {t("New booking")}
          </Button>
        ) : undefined
      }
    />
  )

  const toolbar = (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">{t("Search guests")}</span>
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <input
            type="search"
            className={inputCls}
            placeholder={t("Name or phone…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            active={vipOnly}
            onClick={() => setVipOnly((v) => !v)}
            icon={Star}
            label={t("VIP")}
          />
          <FilterPill
            active={returningOnly}
            onClick={() => setReturningOnly((v) => !v)}
            icon={Repeat}
            label={t("Returning")}
          />
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="min-h-11 text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
            >
              {t("Clear")}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  const noMatches = (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 py-14 text-center">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-400">
        <Search className="size-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-zinc-800">
        {t("No matches for your search or filters.")}
      </h3>
      <Button variant="outline" className="mt-4 min-h-11" onClick={clearAll}>
        {t("Clear")}
      </Button>
    </div>
  )

  function renderBody() {
    if (denied)
      return (
        <OnboardingEmptyState
          variant="denied"
          title={t("You don't have access to this list")}
          message={t(
            "The guest directory is for reception and front-desk teams. Ask a hotel administrator if you need access.",
          )}
        />
      )

    if (loading && rows.length === 0)
      return (
        <div className="space-y-2.5" aria-busy="true" aria-label={t("Searching")}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[4.75rem] animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100"
            />
          ))}
        </div>
      )

    if (error && rows.length === 0)
      return (
        <div className="rounded-2xl border border-zinc-200 bg-white py-12 text-center shadow-sm">
          <p className="text-sm font-medium text-rose-700">{error}</p>
          <Button
            variant="outline"
            className="mt-3 min-h-11"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            <RotateCw className="size-4" aria-hidden /> {t("Try again")}
          </Button>
        </div>
      )

    if (rows.length === 0)
      return hasFilters ? (
        noMatches
      ) : (
        <OnboardingEmptyState
          icon={Users}
          title={t("No guests yet")}
          message={t("Guests appear here once you take a booking.")}
        />
      )

    if (filtered.length === 0) return noMatches

    return (
      <div className="space-y-3">
        {error && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            <span>{error}</span>
            <button
              className="min-h-11 shrink-0 font-semibold underline"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              {t("Retry")}
            </button>
          </div>
        )}

        <div
          className={cn(
            "space-y-2.5",
            loading && "opacity-60 transition-opacity",
          )}
        >
          {visible.map((g) => (
            <GuestListItem key={g.name} g={g} today={today} />
          ))}
        </div>

        {pageCount > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm text-zinc-500">
            <span>
              {fill(t("Showing {from}–{to} of {total}"), {
                from: safePage * PAGE + 1,
                to: Math.min((safePage + 1) * PAGE, filtered.length),
                total: filtered.length,
              })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                {t("Previous")}
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                {t("Next")}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {header}
      {!denied && toolbar}
      {renderBody()}
    </div>
  )
}
