import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { BedDouble, MapPin, Search, Star } from "lucide-react"

import { call } from "../lib/api"
import { serverError } from "../lib/resource"
import { useT } from "../lib/i18n"
import { Badge } from "../components/ui/badge"
import { Bilingual } from "../components/Bilingual"
import { PublicFooter, PublicHeader } from "../components/PublicChrome"

/** One bookable property, as shown on the /hotels portal. Rich fields come from
 *  hotelpms.public_api.hotels_list; the pre-restart fallback (catalog_index)
 *  fills only the basics, so every rich field is optional. */
interface Hotel {
  name: string
  property_name: string
  slug: string
  city: string | null
  state?: string | null
  hero_image: string | null
  logo_url?: string | null
  description?: string | null
  amenities?: string[]
  star_category?: string | number | null
  property_kind?: string | null
  phone?: string | null
  from_rate?: number | null
  currency_symbol?: string
  locale?: string
}

/** Star icons from a numeric-ish star_category ("5" / "5 Star" / 5). */
function Stars({ value }: { value: Hotel["star_category"] }) {
  const n = parseInt(String(value ?? ""), 10)
  if (!n || n < 1 || n > 7) return null
  return (
    <span className="flex items-center gap-0.5" aria-label={`${n} star`}>
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} className="size-3.5 fill-gold-400 text-gold-400" aria-hidden />
      ))}
    </span>
  )
}

function HotelCard({ hotel }: { hotel: Hotel }) {
  const { t } = useT()
  const money =
    hotel.from_rate != null && hotel.from_rate > 0
      ? `${hotel.currency_symbol ?? ""}${Number(hotel.from_rate).toLocaleString(
          hotel.locale || "en-US",
          { maximumFractionDigits: 0 },
        )}`
      : null
  const to = `/hotels/${encodeURIComponent(hotel.slug)}`

  return (
    <article className="card-lux flex flex-col overflow-hidden">
      <Link to={to} className="relative block aspect-[16/10] overflow-hidden bg-navy-100">
        {hotel.hero_image ? (
          <img
            src={hotel.hero_image}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 hover:scale-105"
          />
        ) : (
          <span className="grid size-full place-items-center text-navy-300">
            <BedDouble className="size-10" aria-hidden />
          </span>
        )}
        {hotel.star_category ? (
          <span className="absolute end-2 top-2 rounded-full bg-navy-900/80 px-2 py-1">
            <Stars value={hotel.star_category} />
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <Link to={to} className="hover:text-brand-700">
            <Bilingual value={hotel.property_name} className="text-lg font-bold leading-tight" />
          </Link>
          {hotel.city && (
            <p className="mt-1 flex items-center gap-1 text-sm text-zinc-500">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <Bilingual value={hotel.city} primaryOnly />
            </p>
          )}
        </div>

        {hotel.description && (
          <p className="line-clamp-2 text-sm text-zinc-600" dir="auto">
            {hotel.description}
          </p>
        )}

        {hotel.amenities && hotel.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hotel.amenities.slice(0, 4).map((a) => (
              <Badge key={a} tone="zinc">
                <Bilingual value={a} primaryOnly />
              </Badge>
            ))}
            {hotel.amenities.length > 4 && (
              <Badge tone="zinc">+{hotel.amenities.length - 4}</Badge>
            )}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            {money && (
              <>
                <span className="block text-[11px] uppercase tracking-wide text-zinc-400">
                  {t("From")}
                </span>
                <span className="text-base font-bold text-navy-900" dir="ltr">
                  {money}
                  <span className="text-xs font-normal text-zinc-500"> / {t("night")}</span>
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={to}
              className="rounded-lg border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50"
            >
              {t("View hotel")}
            </Link>
            <Link to={to} className="btn-gold rounded-lg px-3 py-1.5 text-sm">
              {t("Book now")}
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function Hotels() {
  const { t } = useT()
  const [hotels, setHotels] = useState<Hotel[] | null>(null)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [city, setCity] = useState("")

  useEffect(() => {
    let cancelled = false
    document.title = "HotelPMS — Hotels"
    // Rich list first; fall back to the always-live catalog_index (the new
    // hotels_list endpoint is not in the running workers until a restart).
    call<{ hotels: Hotel[] }>("hotelpms.public_api.hotels_list")
      .then((r) => {
        if (!cancelled) setHotels(r.hotels || [])
      })
      .catch(() =>
        call<{
          mode: string
          properties?: {
            name: string
            property_name: string
            property_slug: string
            city: string | null
            hero_image: string | null
            property_kind: string | null
          }[]
        }>("hotelpms.public_api.catalog_index")
          .then((idx) => {
            if (cancelled) return
            const list = idx.mode === "properties" ? idx.properties ?? [] : []
            setHotels(
              list.map((p) => ({
                name: p.name,
                property_name: p.property_name,
                slug: p.property_slug,
                city: p.city,
                hero_image: p.hero_image,
                property_kind: p.property_kind,
                amenities: [],
              })),
            )
          })
          .catch((e) => {
            if (!cancelled) setError(serverError(e))
          }),
      )
    return () => {
      cancelled = true
    }
  }, [])

  const cities = useMemo(() => {
    const set = new Set<string>()
    for (const h of hotels ?? []) if (h.city) set.add(h.city)
    return [...set].sort()
  }, [hotels])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (hotels ?? []).filter((h) => {
      if (city && h.city !== city) return false
      if (q && !`${h.property_name} ${h.city ?? ""}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [hotels, query, city])

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <PublicHeader />

      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <h1 className="text-2xl font-bold sm:text-3xl">{t("Find your stay")}</h1>
          <p className="mt-2 max-w-xl text-sm text-navy-100">
            {t("Browse our hotels and book directly — best rate, instant confirmation.")}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">{t("Search hotels")}</span>
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Search by hotel name")}
                className="w-full rounded-lg border border-white/10 bg-white py-2.5 ps-9 pe-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-2 focus:outline-gold-400"
              />
            </label>
            {cities.length > 1 && (
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                aria-label={t("Filter by city")}
                className="rounded-lg border border-white/10 bg-white px-3 py-2.5 text-sm text-zinc-900 sm:w-56"
              >
                <option value="">{t("All cities")}</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-5 py-10">
        {error ? (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </p>
        ) : hotels === null ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card-lux animate-pulse overflow-hidden">
                <div className="aspect-[16/10] bg-zinc-100" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-2/3 rounded bg-zinc-100" />
                  <div className="h-3 w-1/2 rounded bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center gap-2 py-20 text-center">
            <BedDouble className="size-10 text-zinc-300" aria-hidden />
            <p className="text-sm text-zinc-500">
              {hotels.length === 0
                ? t("No hotels are open for booking right now.")
                : t("No hotels match your search.")}
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-zinc-500">
              {t("{count} hotels", { count: filtered.length })}
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((h) => (
                <HotelCard key={h.name} hotel={h} />
              ))}
            </div>
          </>
        )}
      </main>

      <PublicFooter />
    </div>
  )
}
