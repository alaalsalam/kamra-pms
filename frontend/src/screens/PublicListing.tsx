import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  BedDouble,
  Check,
  ExternalLink,
  Loader2,
  MapPin,
  Minus,
  Phone,
  Plus,
  Search,
  Users,
} from "lucide-react"
import { call } from "../lib/api"
import { serverError } from "../lib/resource"
import { accentVars } from "../lib/accents"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { PublicFooter, PublicHeader } from "../components/PublicChrome"
import { Sheet } from "../components/ui/sheet"
import { cur, moneyLocale, adoptUiLocale } from "../lib/money"
import { qty } from "../lib/i18n"
import { formatPhoneDisplay, formatPhoneTel } from "../lib/phone"

const inr = (n: number) =>
  n.toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

interface Resolved {
  kind: "listing" | "site"
  property: string
  listing_slug?: string
  location_slug?: string
  location_name?: string
  room_type?: string
  room_type_name?: string
}

interface Showcase {
  property: {
    name: string
    property_name: string
    description: string | null
    logo_url: string | null
    hero_image: string | null
    brand_accent: string | null
    payment_mode: string
    cleaning_fee: number
    security_deposit_amount: number
    minimum_nights: number
    booking_mode: string
    property_kind: string
    checkin_time: string
    checkout_time: string
    house_rules: string | null
    pets_policy: string | null
    children_policy: string | null
    city: string
    state: string
    phone: string | null
    country?: string | null
    gallery: { url: string; caption: string | null }[]
  }
  room_types: {
    name: string
    room_type_name: string
    listing_slug: string | null
    location_slug: string | null
    description: string | null
    base_price: number
    adults_capacity: number
    bed_type: string | null
    room_view: string | null
    amenities: string[]
    media: { media_type: string; url: string; caption: string | null }[]
    location_name: string | null
    location_address: string | null
    google_maps_url: string | null
    latitude: number | null
    longitude: number | null
  }[]
  locations: {
    name: string
    slug: string | null
    address: string | null
    google_maps_url: string | null
    latitude: number | null
    longitude: number | null
    phone?: string | null
    cover_image?: string | null
    room_types: string[]
    from_rate?: number
  }[]
  meal_plans: { name: string; code: string; label: string; price_per_adult: number }[]
  experiences: {
    name: string
    experience_name: string
    category: string | null
    price: number
    gst_rate: number
    description: string | null
  }[]
}

interface StayResult {
  room_type: string
  rooms_left: number
  quote: {
    nights: number
    amount_after_tax: number
    cleaning_fee?: number
    totals?: { deposit_required?: number }
  } | null
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-base " +
  "focus:outline-2 focus:outline-offset-1 focus:outline-gold-500"

function todayPlus(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function nightsBetween(a: string, b: string) {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return Math.max(1, Math.round(ms / 86_400_000))
}

function addDays(date: string, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function mapEmbedUrl(lat: number, lng: number) {
  const d = 0.02
  return (
    `https://www.openstreetmap.org/export/embed.html?bbox=` +
    `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}` +
    `&layer=mapnik&marker=${lat}%2C${lng}`
  )
}

function MapBlock({
  address,
  mapsUrl,
  lat,
  lng,
}: {
  address: string | null | undefined
  mapsUrl: string | null | undefined
  lat: number | null | undefined
  lng: number | null | undefined
}) {
  if (!address && !mapsUrl && (lat == null || lng == null)) return null
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-zinc-900">Where you’ll be</h2>
      {address && <p className="text-sm text-zinc-600">{address}</p>}
      {lat != null && lng != null && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm">
          <iframe
            title="Map"
            className="h-64 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={mapEmbedUrl(lat, lng)}
          />
        </div>
      )}
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
        >
          Open in Google Maps <ExternalLink className="size-3.5" aria-hidden />
        </a>
      )}
    </section>
  )
}

function HostBlock({
  brand,
  phone,
  city,
  country,
}: {
  brand: string
  phone: string | null | undefined
  city: string
  country?: string | null
}) {
  if (!phone) return null
  const display = formatPhoneDisplay(phone, country)
  const tel = formatPhoneTel(phone, country)
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Host & caretaker</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Coordinated by {brand}
        {city ? ` · ${city}` : ""}
      </p>
      <a
        href={`tel:${tel}`}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base font-semibold text-zinc-900 transition hover:border-brand-300 hover:bg-brand-50"
      >
        <Phone className="size-4 text-brand-700" aria-hidden />
        <span dir="ltr">{display}</span>
      </a>
      <p className="mt-2 text-xs text-zinc-400">
        Call for directions, check-in help, or on-site questions.
      </p>
    </section>
  )
}

export default function PublicListing() {
  const { slug, checkin, checkout, adults: adultsParam, children: childrenParam } =
    useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const [data, setData] = useState<Showcase | null>(null)
  const [search, setSearch] = useState(() => {
    const check_in_date = checkin ?? todayPlus(1)
    return {
      check_in_date,
      check_out_date: checkout ?? addDays(check_in_date, 2),
      adults: Number(adultsParam ?? 2) || 2,
      children: Number(childrenParam ?? 0) || 0,
    }
  })
  const [results, setResults] = useState<Record<string, StayResult>>({})
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [booking, setBooking] = useState<string | null>(null)
  const [form, setForm] = useState({
    guest_name: "",
    phone: "",
    email: "",
    meal_plan: "",
    special_requests: "",
  })
  // experience add-ons the guest picks in the booking sheet: name -> qty
  const [addons, setAddons] = useState<Record<string, number>>({})
  const [done, setDone] = useState<{ reservation: string; amount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const checkOut = search.check_out_date

  const listingSlug = resolved?.listing_slug
  const locationSlug = resolved?.location_slug
  const isSite = resolved?.kind === "site"
  const primary = data?.room_types[0]
  const siteMeta = useMemo(() => {
    if (!data) return null
    if (isSite && locationSlug) {
      return data.locations.find((l) => l.slug === locationSlug) ?? data.locations[0]
    }
    if (primary?.location_slug) {
      return data.locations.find((l) => l.slug === primary.location_slug) ?? null
    }
    return data.locations[0] ?? null
  }, [data, isSite, locationSlug, primary])

  useEffect(() => {
    if (!slug) return
    call<Resolved>("hotelpms.public_api.resolve_slug", { slug })
      .then((r) => {
        setResolved(r)
        const args: Record<string, string> = { property: r.property }
        if (r.listing_slug) args.listing_slug = r.listing_slug
        if (r.location_slug) args.location_slug = r.location_slug
        return call<Showcase>("hotelpms.public_api.showcase", args).then((d) => ({
          d,
          r,
        }))
      })
      .then(({ d }) => {
        adoptUiLocale(
          (d as unknown as { ui_locale?: { currency_symbol?: string; locale?: string } })
            .ui_locale,
        )
        setData(d)
        // Start with no meal plan selected so the guest is never silently
        // charged for a plan they didn't pick — they opt in below.
      })
      .catch((e) => setError(serverError(e)))
  }, [slug])

  useEffect(() => {
    if (!resolved) return
    navigate(
      `/stay/${slug}/${search.check_in_date}/${checkOut}/${search.adults}/${search.children}${searchParams.toString() ? `?${searchParams}` : ""}`,
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, checkOut, slug])

  useEffect(() => {
    if (!resolved) return
    const t = setTimeout(fetchResults, 300)
    return () => clearTimeout(t)
  }, [resolved, search, checkOut, listingSlug, locationSlug])

  function fetchResults() {
    if (!resolved) return
    setSearching(true)
    setSearchError(null)
    call<StayResult[]>("hotelpms.public_api.search_stay", {
      property: resolved.property,
      check_in_date: search.check_in_date,
      check_out_date: checkOut,
      adults: search.adults,
      children: search.children,
      listing_slug: listingSlug,
      location_slug: locationSlug,
    })
      .then((rows) => {
        const map: Record<string, StayResult> = {}
        rows.forEach((r) => (map[r.room_type] = r))
        setResults(map)
        setSearched(true)
      })
      .catch((e) => setSearchError(serverError(e)))
      .finally(() => setSearching(false))
  }

  // A guest who lands with dates already in the URL (e.g. arriving from /book or
  // a shared link) sees live availability immediately — no extra click before
  // the next step appears.
  useEffect(() => {
    if (resolved && data && checkin && checkout && !searched) fetchResults()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, data])

  useEffect(() => {
    if (!data || !resolved) return
    const name = isSite
      ? resolved.location_name ?? data.property.property_name
      : primary?.room_type_name ?? data.property.property_name
    document.title = `${name} · ${data.property.property_name}`
  }, [data, resolved, isSite, primary])

  async function submitBooking() {
    if (!booking || !resolved) return
    setBusy(true)
    setError(null)
    try {
      const res = await call<{ reservation: string; amount_after_tax: number }>(
        "hotelpms.public_api.book",
        {
          property: resolved.property,
          room_type: booking,
          check_in_date: search.check_in_date,
          check_out_date: checkOut,
          adults: search.adults,
          children: search.children,
          ...form,
          addons: Object.entries(addons)
            .filter(([, qty]) => qty > 0)
            .map(([experience, qty]) => ({ experience, qty })),
        },
      )
      setDone({ reservation: res.reservation, amount: res.amount_after_tax })
    } catch (e) {
      setError(serverError(e))
    } finally {
      setBusy(false)
    }
  }

  if (!data || !resolved)
    return (
      <p className="py-20 text-center text-zinc-400">{error ?? "Loading…"}</p>
    )

  const p = data.property
  const accent = accentVars(p.brand_accent)
  const minNights = p.minimum_nights || 1
  const confirmLabel =
    p.booking_mode === "Request to Book"
      ? "Request to book"
      : p.payment_mode === "Full online"
        ? "Confirm & pay"
        : "Reserve"
  const title = isSite
    ? resolved.location_name ?? siteMeta?.name ?? p.property_name
    : primary?.room_type_name ?? p.property_name
  const address =
    siteMeta?.address ?? primary?.location_address ?? null
  const mapsUrl = siteMeta?.google_maps_url ?? primary?.google_maps_url ?? null
  const lat = siteMeta?.latitude ?? primary?.latitude ?? null
  const lng = siteMeta?.longitude ?? primary?.longitude ?? null
  const phone = siteMeta?.phone ?? p.phone
  const fromRate = Math.min(...data.room_types.map((r) => r.base_price))
  const photos = isSite
    ? [
        ...(siteMeta?.cover_image ? [{ url: siteMeta.cover_image, caption: null }] : []),
        ...data.room_types.flatMap((rt) => rt.media),
        ...(p.gallery || []),
      ]
    : [...(primary?.media || []), ...(p.gallery || [])]
  const uniquePhotos = photos.filter(
    (m, i, arr) => m.url && arr.findIndex((x) => x.url === m.url) === i,
  )
  const hero = uniquePhotos[0]?.url ?? p.hero_image ?? undefined
  const stayPathSuffix = `${search.check_in_date}/${checkOut}/${search.adults}/${search.children}`
  const backToSite =
    !isSite && primary?.location_slug
      ? `/stay/${primary.location_slug}/${stayPathSuffix}`
      : `/book/${stayPathSuffix}`

  return (
    <div className="min-h-[100dvh] bg-zinc-50" style={accent}>
      <PublicHeader
        links={isSite ? [{ label: "Rooms", href: "#choose-listing" }] : []}
        cta={
          <button
            type="button"
            onClick={() =>
              document
                .getElementById(isSite ? "choose-listing" : "book")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="btn-gold rounded-lg px-4 py-1.5 text-sm"
          >
            Book now
          </button>
        }
      />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
          <Link
            to={isSite ? `/book/${stayPathSuffix}` : backToSite}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {isSite ? "All properties" : "Back to property"}
          </Link>
          <span className="ms-auto truncate text-sm font-medium text-zinc-500">
            {p.property_name}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 pb-20 pt-6">
        {/* Photo plane */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm">
          {hero ? (
            <img
              src={hero}
              alt=""
              className="aspect-[16/9] w-full object-cover sm:aspect-[21/9]"
            />
          ) : (
            <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900 text-white sm:aspect-[21/9]">
              <span className="text-5xl font-semibold tracking-tight">
                {title
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")}
              </span>
            </div>
          )}
          {uniquePhotos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto border-t border-zinc-200 bg-white p-2">
              {uniquePhotos.slice(1, 7).map((m, i) => (
                <img
                  key={`${m.url}-${i}`}
                  src={m.url}
                  alt={m.caption ?? ""}
                  className="h-16 w-24 shrink-0 rounded-lg object-cover"
                />
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-10 lg:grid-cols-5">
          <div className="space-y-8 lg:col-span-3">
            <div>
              <p className="text-sm font-medium text-brand-700">
                {isSite ? p.property_name : siteMeta?.name ?? p.property_name}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
                {title}
              </h1>
              {address && (
                <p className="mt-2 inline-flex items-start gap-1.5 text-sm text-zinc-500">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {address}
                </p>
              )}
              {!isSite && primary && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-zinc-600">
                  <Users className="size-4" aria-hidden />
                  Up to {primary.adults_capacity} guests
                  {primary.bed_type ? ` · ${primary.bed_type} bed` : ""}
                  {primary.room_view ? ` · ${primary.room_view}` : ""}
                </p>
              )}
              {isSite && (
                <p className="mt-2 text-sm text-zinc-600">
                  from {cur()}
                  {inr(fromRate)}/night · {data.room_types.length} listing
                  {data.room_types.length === 1 ? "" : "s"}
                </p>
              )}
            </div>

            {(isSite ? p.description : primary?.description) && (
              <p className="text-[15px] leading-relaxed text-zinc-600">
                {isSite ? p.description : primary?.description}
              </p>
            )}

            {!isSite && primary && primary.amenities.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {primary.amenities.map((a) => (
                  <Badge key={a} tone="zinc">
                    {a}
                  </Badge>
                ))}
              </ul>
            )}

            {/* Property page: listings */}
            {isSite && (
              <section id="choose-listing" className="space-y-4">
                <h2 className="text-xl font-semibold text-zinc-900">
                  Choose a listing
                </h2>
                <div className="space-y-4">
                  {data.room_types.map((rt) => {
                    const r = results[rt.name]
                    const soldOut = r && !r.quote
                    return (
                      <div
                        key={rt.name}
                        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:grid sm:grid-cols-5"
                      >
                        <div className="relative bg-zinc-100 sm:col-span-2">
                          {rt.media[0] ? (
                            <img
                              src={rt.media[0].url}
                              alt=""
                              className="h-44 w-full object-cover sm:h-full"
                            />
                          ) : (
                            <div className="flex h-44 items-center justify-center sm:h-full">
                              <BedDouble className="size-10 text-zinc-300" aria-hidden />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col justify-between gap-3 p-4 sm:col-span-3 sm:p-5">
                          <div>
                            <h3 className="text-lg font-semibold text-zinc-900">
                              {rt.room_type_name}
                            </h3>
                            <p className="mt-1 text-sm text-zinc-500">
                              Up to {rt.adults_capacity} guests · from {cur()}
                              {inr(rt.base_price)}/night
                            </p>
                            {rt.description && (
                              <p className="mt-2 line-clamp-2 text-sm text-zinc-600">
                                {rt.description}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm">
                              {r?.quote ? (
                                <p className="font-semibold text-gold">
                                  {cur()}
                                  {inr(r.quote.amount_after_tax)}
                                  <span className="ms-1 font-normal text-zinc-500">
                                    total
                                  </span>
                                </p>
                              ) : soldOut ? (
                                <p className="font-medium text-rose-600">Sold out</p>
                              ) : (
                                <p className="text-zinc-400">Checking…</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {rt.listing_slug && (
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    navigate(`/stay/${rt.listing_slug}/${stayPathSuffix}`)
                                  }
                                >
                                  View details
                                </Button>
                              )}
                              <Button
                                variant="gold"
                                disabled={!r?.quote}
                                onClick={() => setBooking(rt.name)}
                              >
                                Reserve
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            <MapBlock address={address} mapsUrl={mapsUrl} lat={lat} lng={lng} />

            <HostBlock
              brand={p.property_name}
              phone={phone}
              city={p.city}
              country={p.country}
            />

            {(p.house_rules || p.pets_policy || p.children_policy) && (
              <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm shadow-sm">
                <h2 className="mb-3 text-lg font-semibold text-zinc-900">
                  House rules
                </h2>
                {p.house_rules && (
                  <p className="whitespace-pre-line leading-relaxed text-zinc-600">
                    {p.house_rules}
                  </p>
                )}
                {p.pets_policy && (
                  <p className="mt-3 text-zinc-600">Pets: {p.pets_policy}</p>
                )}
                {p.children_policy && (
                  <p className="mt-2 text-zinc-600">Children: {p.children_policy}</p>
                )}
                {(p.cleaning_fee || 0) > 0 && (
                  <p className="mt-3 text-zinc-600">
                    Cleaning fee {cur()}
                    {inr(p.cleaning_fee)} (one-time)
                  </p>
                )}
                {(p.security_deposit_amount || 0) > 0 && (
                  <p className="mt-1 text-zinc-600">
                    Refundable deposit {cur()}
                    {inr(p.security_deposit_amount)}
                  </p>
                )}
              </section>
            )}
          </div>

          <aside id="book" className="lg:col-span-2">
            <div className="sticky top-20 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-md">
              <div>
                <p className="text-2xl font-semibold tabular-nums text-gold">
                  {cur()}
                  {inr(
                    !isSite && results[primary?.name ?? ""]?.quote
                      ? results[primary!.name].quote!.amount_after_tax
                      : fromRate,
                  )}
                </p>
                <p className="text-sm text-zinc-500">
                  {!isSite && results[primary?.name ?? ""]?.quote ? (
                    <>
                      {qty(results[primary!.name].quote!.nights, "night")}
                      {" · "}
                      taxes in
                    </>
                  ) : (
                    "from / night"
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-zinc-600">
                    Check-in
                  </span>
                  <input
                    type="date"
                    className={inputCls}
                    value={search.check_in_date}
                    min={todayPlus(0)}
                    onChange={(e) => {
                      const check_in_date = e.target.value
                      const minCheckOut = addDays(check_in_date, minNights)
                      setSearch((s) => ({
                        ...s,
                        check_in_date,
                        check_out_date:
                          s.check_out_date > minCheckOut ? s.check_out_date : minCheckOut,
                      }))
                    }}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-zinc-600">
                    Check-out
                  </span>
                  <input
                    type="date"
                    className={inputCls}
                    value={search.check_out_date}
                    min={addDays(search.check_in_date, minNights)}
                    onChange={(e) =>
                      setSearch({ ...search, check_out_date: e.target.value })
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-zinc-600">
                    Adults
                  </span>
                  <input
                    type="number"
                    min={1}
                    className={inputCls}
                    value={search.adults}
                    onChange={(e) =>
                      setSearch({
                        ...search,
                        adults: Math.max(1, Number(e.target.value)),
                      })
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-zinc-600">
                    Children
                  </span>
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={search.children}
                    onChange={(e) =>
                      setSearch({
                        ...search,
                        children: Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </label>
              </div>
              <p className="text-center text-xs text-zinc-400">
                {qty(nightsBetween(search.check_in_date, search.check_out_date), "night")}
              </p>

              <Button
                variant={isSite ? "outline" : "gold"}
                className="w-full justify-center gap-2 py-2.5 text-base"
                disabled={searching}
                onClick={() => {
                  fetchResults()
                  document
                    .getElementById(isSite ? "choose-listing" : "avail-result")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }}
              >
                {searching ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="size-4" aria-hidden />
                )}
                {searching ? "Checking availability…" : "Check availability"}
              </Button>

              {/* Single-listing: a clear result — available / sold out / error —
                  so the guest always sees the next step after checking. */}
              {!isSite && primary && (
                <div id="avail-result">
                  {searchError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      <p>Couldn't check availability right now.</p>
                      <button
                        className="mt-1 font-semibold underline hover:no-underline"
                        onClick={fetchResults}
                      >
                        Try again
                      </button>
                    </div>
                  ) : searched && !searching ? (
                    (results[primary.name]?.rooms_left ?? 0) > 0 ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                          <Check className="size-4" aria-hidden /> Available for your dates
                        </p>
                        {results[primary.name]?.quote ? (
                          <p className="mt-1 text-sm text-emerald-700">
                            <bdi dir="ltr" className="font-semibold tabular-nums">
                              {cur()}
                              {inr(results[primary.name].quote!.amount_after_tax)}
                            </bdi>
                            {" · "}
                            {qty(results[primary.name].quote!.nights, "night")}
                            {" · "}
                            taxes in
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-emerald-700">
                            Price is confirmed at booking.
                          </p>
                        )}
                        <Button
                          id="sticky-book"
                          variant="gold"
                          className="mt-3 w-full justify-center py-2.5 text-base"
                          onClick={() => setBooking(primary.name)}
                        >
                          {confirmLabel}
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                        <p className="font-semibold text-amber-800">
                          No rooms available for these dates.
                        </p>
                        <p className="mt-0.5 text-amber-700">
                          Try different check-in / check-out dates to find an opening.
                        </p>
                      </div>
                    )
                  ) : (
                    !searching && (
                      <Button
                        id="sticky-book"
                        variant="gold"
                        className="w-full justify-center py-2.5 text-base"
                        disabled
                      >
                        {confirmLabel}
                      </Button>
                    )
                  )}
                </div>
              )}

              {isSite && (
                <p className="text-center text-sm text-zinc-500">
                  Pick a listing below to reserve, or scroll the options on the left.
                </p>
              )}

              <p className="text-center text-xs text-zinc-400">
                Check-in {p.checkin_time?.slice(0, 5)} · Check-out{" "}
                {p.checkout_time?.slice(0, 5)}
                {minNights > 1 ? ` · ${minNights}-night min` : ""}
              </p>

              {phone && (
                <a
                  href={`tel:${formatPhoneTel(phone, p.country)}`}
                  className="flex items-center justify-center gap-2 text-sm font-medium text-brand-700 hover:underline"
                >
                  <Phone className="size-3.5" aria-hidden />
                  Call caretaker <span dir="ltr">{formatPhoneDisplay(phone, p.country)}</span>
                </a>
              )}
            </div>
          </aside>
        </div>
      </div>

      <PublicFooter />

      {booking && (
        <Sheet
          wide
          title={done ? "Booking confirmed" : "Complete your booking"}
          description={
            done
              ? undefined
              : data.room_types.find((r) => r.name === booking)?.room_type_name
          }
          onClose={() => {
            setBooking(null)
            setDone(null)
            setAddons({})
            setForm((f) => ({ ...f, meal_plan: "", special_requests: "" }))
          }}
          footer={
            done ? (
              <Button
                className="w-full justify-center py-2.5"
                onClick={() => {
                  setBooking(null)
                  setDone(null)
                  setAddons({})
                  setForm((f) => ({ ...f, meal_plan: "", special_requests: "" }))
                }}
              >
                Done
              </Button>
            ) : (
              <Button
                variant="gold"
                className="w-full justify-center py-2.5 text-base"
                disabled={busy || !form.guest_name || !form.phone}
                onClick={submitBooking}
              >
                {busy ? "Booking…" : confirmLabel}
              </Button>
            )
          }
        >
          {done ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-800">
              <p className="text-lg font-semibold">{done.reservation}</p>
              <p className="mt-1 text-sm">
                Total{" "}
                <bdi dir="ltr" className="tabular-nums">
                  {cur()}
                  {inr(done.amount)}
                </bdi>
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-zinc-600">
                  Full name
                </span>
                <input
                  className={inputCls}
                  value={form.guest_name}
                  autoFocus
                  onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-zinc-600">
                  Phone
                </span>
                <input
                  className={inputCls}
                  type="tel"
                  dir="ltr"
                  value={form.phone}
                  placeholder="+966 5X XXX XXXX"
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-zinc-600">
                  Email (optional)
                </span>
                <input
                  className={inputCls}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>

              {/* Services — meal plan */}
              {data.meal_plans.length > 0 && (
                <div className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-zinc-600">
                    Meal plan
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[{ name: "", label: "No meal plan", price_per_adult: 0 }, ...data.meal_plans].map((mp) => {
                      const selected = form.meal_plan === mp.name
                      return (
                        <button
                          type="button"
                          key={mp.name || "none"}
                          onClick={() => setForm((f) => ({ ...f, meal_plan: mp.name }))}
                          className={
                            "flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-start text-sm transition " +
                            (selected
                              ? "border-gold-500 bg-gold-50 ring-1 ring-gold-500"
                              : "border-zinc-200 hover:border-zinc-300")
                          }
                        >
                          <span className="font-medium text-zinc-800">{mp.label}</span>
                          {mp.price_per_adult > 0 && (
                            <span className="shrink-0 text-xs text-zinc-500">
                              +<bdi dir="ltr" className="tabular-nums">{cur()}{inr(mp.price_per_adult)}</bdi>{" "}
                              per adult / night
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Services — experiences / add-ons */}
              {data.experiences.length > 0 && (
                <div className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-zinc-600">
                    Add-ons &amp; experiences
                  </span>
                  <ul className="space-y-2">
                    {data.experiences.map((ex) => {
                      const qty = addons[ex.name] || 0
                      return (
                        <li
                          key={ex.name}
                          className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3.5 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-800">
                              {ex.experience_name}
                            </p>
                            <p className="text-xs text-zinc-500">
                              <bdi dir="ltr" className="tabular-nums">
                                {cur()}{inr(ex.price * (1 + ex.gst_rate / 100))}
                              </bdi>{" "}
                              · taxes in
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              aria-label="Remove one"
                              disabled={qty === 0}
                              onClick={() =>
                                setAddons((a) => ({ ...a, [ex.name]: Math.max(0, (a[ex.name] || 0) - 1) }))
                              }
                              className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 disabled:opacity-40"
                            >
                              <Minus className="size-4" aria-hidden />
                            </button>
                            <span className="w-5 text-center text-sm font-semibold tabular-nums">{qty}</span>
                            <button
                              type="button"
                              aria-label="Add one"
                              onClick={() =>
                                setAddons((a) => ({ ...a, [ex.name]: (a[ex.name] || 0) + 1 }))
                              }
                              className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:border-zinc-300"
                            >
                              <Plus className="size-4" aria-hidden />
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-zinc-600">
                  Special requests (optional)
                </span>
                <textarea
                  className={inputCls + " min-h-20"}
                  value={form.special_requests}
                  onChange={(e) => setForm((f) => ({ ...f, special_requests: e.target.value }))}
                />
              </label>

              {/* Estimated total (final total is confirmed by the booking) */}
              {(() => {
                const q = booking ? results[booking]?.quote : null
                const nights = q?.nights ?? nightsBetween(search.check_in_date, checkOut)
                const mp = data.meal_plans.find((m) => m.name === form.meal_plan)
                const mealEst = mp ? nights * search.adults * mp.price_per_adult : 0
                const expEst = data.experiences.reduce(
                  (s, ex) => s + (addons[ex.name] || 0) * ex.price * (1 + ex.gst_rate / 100),
                  0,
                )
                const roomEst = q?.amount_after_tax ?? 0
                const estTotal = roomEst + mealEst + expEst
                // Only show an estimate when we have a real room quote — otherwise
                // the "total" would omit the room and mislead the guest.
                if (!q) return null
                return (
                  <div className="rounded-xl bg-zinc-50 px-4 py-3 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-700">Estimated total</span>
                      <bdi dir="ltr" className="text-lg font-semibold tabular-nums text-gold">
                        {cur()}{inr(estTotal)}
                      </bdi>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      Final total is confirmed at booking. Taxes included.
                    </p>
                  </div>
                )
              })()}

              {error && (
                <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>
              )}
            </div>
          )}
        </Sheet>
      )}
    </div>
  )
}
