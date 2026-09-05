import { useEffect, useState } from "react"
import { Search, Star } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { call } from "../lib/api"
import { serverError } from "../lib/resource"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { cur, moneyLocale, dateLocale } from "../lib/money"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card"

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
  last_stay: string | null
}

const inr = (n: number) =>
  Number(n).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

export default function Guests() {
  const [rows, setRows] = useState<GuestRow[]>([])
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const PAGE = 25
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    setError(null)
    const t = setTimeout(() => {
      call<GuestRow[]>("hotelpms.api.guests_with_stats", {
        search: search || undefined,
      })
        .then((r) => {
          setRows(r)
          setPage(0)
        })
        .catch((e) => setError(serverError(e)))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [search, reloadKey])

  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE))
  const visible = rows.slice(page * PAGE, page * PAGE + PAGE)
  const openGuest = (name: string) =>
    navigate(`/guests/${encodeURIComponent(name)}`)
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(dateLocale(), {
      day: "numeric",
      month: "short",
      year: "numeric",
    })

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Guests</CardTitle>
          <p className="mt-0.5 text-xs text-zinc-400">
            Every guest, their stays and lifetime value. Click for the full
            journey.
          </p>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-2.5 top-2 size-4 text-zinc-400"
            aria-hidden
          />
          <input
            className="rounded-lg border border-zinc-300 py-1.5 pe-3 ps-8 text-sm focus:outline-2 focus:outline-brand-600"
            placeholder="Name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-start text-xs font-medium uppercase tracking-wider text-zinc-500">
                <th className="py-2 pe-4">Guest</th>
                <th className="py-2 pe-4">Phone</th>
                <th className="py-2 pe-4">Bookings</th>
                <th className="py-2 pe-4">Stays</th>
                <th className="py-2 pe-4">Nights</th>
                <th className="py-2 pe-4">Lifetime {cur()}</th>
                <th className="py-2 pe-4">Last stay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visible.map((g) => (
                <tr
                  key={g.name}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${g.full_name}`}
                  className="cursor-pointer transition hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-2 focus:-outline-offset-2 focus:outline-brand-600"
                  onClick={() => openGuest(g.name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      openGuest(g.name)
                    }
                  }}
                >
                  <td className="py-2.5 pe-4">
                    <span className="font-medium">{g.full_name}</span>
                    {Boolean(g.vip) && (
                      <Star
                        className="ms-1.5 inline size-3.5 fill-amber-400 text-amber-400"
                        aria-label="VIP"
                      />
                    )}
                  </td>
                  <td className="py-2.5 pe-4 text-zinc-500" dir="ltr">
                    {g.phone ?? "-"}
                  </td>
                  <td className="py-2.5 pe-4">{g.bookings}</td>
                  <td className="py-2.5 pe-4">{g.stays}</td>
                  <td className="py-2.5 pe-4">{g.nights}</td>
                  <td className="py-2.5 pe-4 font-medium">
                    <bdi dir="ltr" className="tabular-nums">{cur()}{inr(g.lifetime_value)}</bdi>
                  </td>
                  <td className="py-2.5 pe-4 text-zinc-500">
                    {g.last_stay ? (
                      fmtDate(g.last_stay)
                    ) : (
                      <Badge tone="zinc">never</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {loading &&
                rows.length === 0 &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td colSpan={7} className="py-2.5">
                      <div className="h-5 animate-pulse rounded bg-zinc-100" />
                    </td>
                  </tr>
                ))}
              {!loading && error && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm">
                    <p className="font-medium text-rose-700">{error}</p>
                    <Button
                      variant="outline"
                      className="mt-3"
                      onClick={() => setReloadKey((k) => k + 1)}
                    >
                      Try again
                    </Button>
                  </td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-sm text-zinc-400"
                  >
                    No guests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
            <span>
              <span>Showing</span> {page * PAGE + 1}–
              {Math.min((page + 1) * PAGE, total)} <span>of</span> {total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
