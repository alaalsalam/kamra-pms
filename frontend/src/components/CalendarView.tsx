import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { BedDouble, CalendarDays, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react"
import { getCalendar, type CalendarData } from "../lib/api"
import { serverError } from "../lib/resource"
import { primaryLabel } from "../lib/dir"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { cn } from "../lib/utils"
import { cur, moneyLocale, dateLocale } from "../lib/money"
import { Bilingual } from "./Bilingual"
import { Legend } from "./Legend"
import { BoardNav } from "./BoardNav"
import { OnboardingEmptyState } from "./OnboardingEmptyState"

const inr = (n: number) =>
  n.toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

function cellTone(available: number, total: number) {
  if (available === 0) return "bg-rose-50 text-rose-700"
  if (available <= Math.max(1, Math.floor(total * 0.25)))
    return "bg-amber-50 text-amber-800"
  return "bg-white text-zinc-700"
}

/** Same thresholds as cellTone, but the "available" state gets a visible teal
 * fill so it reads as a badge on the white mobile cards. */
function badgeTone(available: number, total: number) {
  if (available === 0) return "bg-rose-50 text-rose-700"
  if (available <= Math.max(1, Math.floor(total * 0.25)))
    return "bg-amber-50 text-amber-800"
  return "bg-brand-50 text-brand-700"
}

const DAYS = 14

const iso = (d: Date) => d.toISOString().slice(0, 10)

function shift(startIso: string, byDays: number) {
  const d = new Date(startIso + "T00:00:00")
  d.setDate(d.getDate() + byDays)
  return iso(d)
}

function rangeLabel(dates: string[]) {
  if (!dates.length) return ""
  const f = new Date(dates[0]),
    l = new Date(dates[dates.length - 1])
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString(dateLocale(), {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    })
  return `${fmt(f, f.getFullYear() !== l.getFullYear())} – ${fmt(l, true)}`
}

export function CalendarView(props: {
  onPick?: (roomType: string, date: string) => void
  refreshKey: number
}) {
  const [data, setData] = useState<CalendarData | null>(null)
  const [start, setStart] = useState(() => iso(new Date()))
  // On phones the 14-column grid is unreadable, so we show one day at a time.
  const [mobileDay, setMobileDay] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  // the room-type filter lives in the URL so it survives a reload and can be
  // deep-linked / shared, like the list screens.
  const [searchParams, setSearchParams] = useSearchParams()
  const rtFilter = searchParams.get("rt") || ""
  const setRtFilter = (v: string) =>
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (v) next.set("rt", v)
        else next.delete("rt")
        return next
      },
      { replace: true },
    )

  useEffect(() => {
    setLoading(true)
    setError(null)
    getCalendar(DAYS, start)
      .then(setData)
      .catch((e) => setError(serverError(e)))
      .finally(() => setLoading(false))
  }, [props.refreshKey, start, reloadKey])

  if (!data) {
    return (
      <div className="space-y-3">
        <BoardNav />
        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-rose-700">{error}</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => setReloadKey((k) => k + 1)}
                >
                  Try again
                </Button>
              </div>
            ) : (
              <div className="space-y-2" aria-busy="true" aria-label="Loading availability">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded-md bg-zinc-100" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const dayLabel = (iso: string) => {
    const d = new Date(iso)
    return {
      dow: d.toLocaleDateString(dateLocale(), { weekday: "short" }),
      day: d.getDate(),
      weekend: d.getDay() === 0 || d.getDay() === 6,
    }
  }

  const shownTypes = data.room_types.filter(
    (rt) => !rtFilter || (rt.room_type_name || rt.room_type) === rtFilter,
  )

  return (
    <div className="space-y-3">
      <BoardNav />
      <Card>
      <CardHeader>
        <div>
          <CardTitle>
            Availability{" "}
            <span className="font-normal text-zinc-400">· {rangeLabel(data.dates)}</span>
          </CardTitle>
          <span className="text-xs text-zinc-400">
            Click a cell to start a booking
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {data.room_types.length > 1 && (
            <select
              value={rtFilter}
              onChange={(e) => setRtFilter(e.target.value)}
              aria-label="Filter by room type"
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:outline-2 focus:outline-brand-600"
            >
              <option value="">All room types</option>
              {data.room_types.map((rt) => (
                <option key={rt.room_type} value={rt.room_type_name || rt.room_type}>
                  {primaryLabel(rt.room_type_name || rt.room_type)}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="outline"
            aria-label="Previous 14 days"
            onClick={() => setStart((s) => shift(s, -DAYS))}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            disabled={start === iso(new Date())}
            onClick={() => setStart(iso(new Date()))}
          >
            <CalendarDays className="size-4" aria-hidden /> Today
          </Button>
          <input
            type="date"
            aria-label="Jump to date"
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
            value={start}
            onChange={(e) => e.target.value && setStart(e.target.value)}
          />
          <Button
            variant="outline"
            aria-label="Next 14 days"
            onClick={() => setStart((s) => shift(s, DAYS))}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn(loading && "opacity-60 transition-opacity")}>
        {error && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <span>{error}</span>
            <button className="shrink-0 font-semibold underline" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </button>
          </div>
        )}
        {data.room_types.length === 0 ? (
          <OnboardingEmptyState
            icon={LayoutGrid}
            title="Set up room types to see availability"
            message="The calendar shows how many rooms are free each night. Add your room types, then your rooms, to bring it to life."
            cta={{ label: "Create room types", to: "/room-types" }}
            secondary={{ label: "Add rooms", to: "/rooms" }}
            gatedNote="Ask a hotel administrator to add room types and rooms."
          />
        ) : data.room_types.every((rt) => rt.total_rooms === 0) ? (
          <OnboardingEmptyState
            icon={BedDouble}
            title="No rooms added yet"
            message="Your room types are ready, but there are no rooms yet — availability stays at zero until rooms exist."
            cta={{ label: "Add rooms", to: "/rooms" }}
            gatedNote="Ask a hotel administrator to add rooms."
          />
        ) : (
          <>
            {/* Desktop: the full 14-day grid */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky start-0 bg-white pe-3 text-start text-xs font-medium text-zinc-500">
                      Room type
                    </th>
                    {data.dates.map((d) => {
                      const l = dayLabel(d)
                      const isToday = d === iso(new Date())
                      return (
                        <th
                          key={d}
                          className={cn(
                            "min-w-14 px-1 pb-2 text-center text-xs font-medium",
                            l.weekend ? "text-brand-700" : "text-zinc-500",
                            isToday && "rounded-t-md bg-brand-50",
                          )}
                        >
                          <div>{l.dow}</div>
                          <div className="text-sm font-semibold">{l.day}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {shownTypes.map((rt) => (
                    <tr key={rt.room_type}>
                      <td className="sticky start-0 whitespace-nowrap bg-white py-1 pe-3 font-medium">
                        <Bilingual as="span" value={rt.room_type_name} primaryOnly />
                        <span className="ms-1 text-xs font-normal text-zinc-400">
                          ×{rt.total_rooms}
                        </span>
                      </td>
                      {rt.cells.map((c) => (
                        <td key={c.date} className={cn("p-0.5", c.date === iso(new Date()) && "bg-brand-50/60")}>
                          <button
                            onClick={() => props.onPick?.(rt.room_type, c.date)}
                            disabled={c.available === 0 || !props.onPick}
                            title={`${rt.room_type_name} · ${c.date} · ${c.available} left · ${cur()}${inr(c.rate)}`}
                            className={cn(
                              "w-full rounded-md border border-zinc-200 px-1 py-1.5 text-center transition-colors",
                              "hover:border-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600",
                              "disabled:cursor-not-allowed",
                              cellTone(c.available, rt.total_rooms),
                            )}
                          >
                            <div className="text-sm font-semibold leading-none">
                              {c.available}
                            </div>
                            <div className="mt-0.5 text-[10px] leading-none opacity-70">
                              <bdi dir="ltr">{cur()}{inr(c.rate)}</bdi>
                            </div>
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile: one day at a time — a tappable room-type list, not a crushed grid */}
            <div className="lg:hidden">
              <div
                className="mb-3 flex gap-1.5 overflow-x-auto pb-1"
                role="tablist"
                aria-label="Pick a date"
              >
                {data.dates.map((d, i) => {
                  const l = dayLabel(d)
                  const sel = i === Math.min(mobileDay, data.dates.length - 1)
                  return (
                    <button
                      key={d}
                      role="tab"
                      aria-selected={sel}
                      onClick={() => setMobileDay(i)}
                      className={cn(
                        "flex min-h-12 shrink-0 flex-col items-center justify-center rounded-lg border px-2.5 py-1 text-xs tabular-nums transition-colors",
                        sel
                          ? "border-brand-600 bg-brand-50 text-brand-800"
                          : "border-zinc-200 text-zinc-500 hover:border-zinc-300",
                      )}
                    >
                      <span>{l.dow}</span>
                      <span className="text-sm font-semibold">{l.day}</span>
                    </button>
                  )
                })}
              </div>
              <ul className="space-y-2">
                {shownTypes.map((rt) => {
                  const c = rt.cells[Math.min(mobileDay, rt.cells.length - 1)]
                  if (!c) return null
                  return (
                    <li key={rt.room_type}>
                      <button
                        onClick={() => props.onPick?.(rt.room_type, c.date)}
                        disabled={c.available === 0 || !props.onPick}
                        className={cn(
                          "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-start transition-colors",
                          "hover:border-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600",
                          "disabled:cursor-not-allowed disabled:opacity-70",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-zinc-800">
                            <Bilingual as="span" value={rt.room_type_name} primaryOnly />
                            <span className="ms-1 text-xs font-normal text-zinc-400">
                              ×{rt.total_rooms}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-400">
                            <bdi dir="ltr" className="tabular-nums">{cur()}{inr(c.rate)}</bdi> · per night
                          </div>
                        </div>
                        <span
                          className={cn(
                            "flex min-w-11 shrink-0 flex-col items-center rounded-lg px-2.5 py-1.5 tabular-nums",
                            badgeTone(c.available, rt.total_rooms),
                          )}
                        >
                          <span className="text-base font-semibold leading-none">{c.available}</span>
                          <span className="mt-0.5 text-[10px] font-medium leading-none opacity-70">available</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Legend
            items={[
              { swatch: "bg-white", label: "Available" },
              { swatch: "bg-amber-400", label: "Limited" },
              { swatch: "bg-rose-500", label: "Sold out" },
            ]}
          />
          <p className="text-xs text-zinc-400">
            Number = rooms available · price = 2-adult nightly rate, taxes and seasons applied.
          </p>
        </div>
      </CardContent>
      </Card>
    </div>
  )
}
