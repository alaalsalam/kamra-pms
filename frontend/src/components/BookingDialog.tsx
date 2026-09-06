import { useEffect, useState } from "react"
import {
  AlertTriangle,
  Ban,
  BedDouble,
  Check,
  ChevronDown,
  Loader2,
  Megaphone,
  Plus,
  RotateCw,
  Star,
  Trash2,
  X,
} from "lucide-react"
import {
  call,
  createBooking,
  getBookingOptions,
  getCalendar,
  getCurrentProperty,
  getQuote,
  guestSearch,
  type BookingOptions,
  type GuestHit,
  type Quote,
} from "../lib/api"
import { Button } from "./ui/button"
import { cn } from "../lib/utils"
import { primaryLabel } from "../lib/dir"
import { cur, moneyLocale, taxLabel } from "../lib/money"
import { useT, fill, qty } from "../lib/i18n"

interface ExtraRoom {
  room_type: string
  adults: number
  children: number
  meal_plan: string
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-base " +
  "focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"

function Field(props: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-600">
        {props.label}
        {props.required && (
          <span className="ms-0.5 text-rose-500" aria-hidden>
            *
          </span>
        )}
      </span>
      {props.children}
    </label>
  )
}


const inr = (n: number) =>
  n.toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

export function BookingDialog(props: {
  initial: {
    room_type?: string
    date?: string
    guest?: string
    guest_name?: string
    phone?: string
    stays?: number
  }
  onClose: () => void
  onBooked: () => void
}) {
  const { t: tt } = useT()
  const [options, setOptions] = useState<BookingOptions | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // rooms-left per room type across the whole stay - one batched availability
  // read (min over the stay nights), so the agent picks with full context.
  const [avail, setAvail] = useState<Record<string, number> | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [done, setDone] = useState<{
    ref: string
    room: string | null
    waitlist?: boolean
  } | null>(
    null,
  )

  const [form, setForm] = useState({
    guest_name: props.initial.guest_name ?? "",
    phone: props.initial.phone ?? "",
    room_type: props.initial.room_type ?? "",
    check_in_date: props.initial.date ?? new Date().toISOString().slice(0, 10),
    nights: 1,
    adults: 2,
    children: 0,
    meal_plan: "",
    voucher_code: "",
    company: "",
    travel_agent: "",
    booked_by_name: "",
    booked_by_phone: "",
    booker_relation: "",
    contact_preference: "Booker",
    nationality: "",
    id_type: "",
    id_number: "",
  })
  const [idOpen, setIdOpen] = useState(false)
  const [onBehalf, setOnBehalf] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [moreRooms, setMoreRooms] = useState<ExtraRoom[]>([])
  const [moreQuotes, setMoreQuotes] = useState<(Quote | null)[]>([])
  const [addonQty, setAddonQty] = useState<Record<string, number>>({})
  const [extra, setExtra] = useState({
    special_requests: "",
    arrival_mode: "",
    arrival_ref: "",
    arrival_datetime: "",
    purpose: "",
    guest_category: "",
    extra_beds: 0,
    pickup_required: false,
    valet_parking: false,
    early_checkin: false,
    late_checkout: false,
  })
  const setX = (
    k: keyof typeof extra,
    v: string | number | boolean,
  ) => setExtra((e) => ({ ...e, [k]: v }))
  const [profile, setProfile] = useState<GuestHit | null>(() =>
    props.initial.guest
      ? {
          name: props.initial.guest,
          full_name: props.initial.guest_name ?? "",
          phone: props.initial.phone ?? null,
          email: null,
          vip: 0,
          blacklisted: 0,
          stays: props.initial.stays ?? 0,
          last_stay: null,
        }
      : null,
  )
  const [hits, setHits] = useState<GuestHit[]>([])

  // profile typeahead - find the returning guest before creating a dupe
  useEffect(() => {
    if (profile || form.guest_name.trim().length < 2) {
      setHits([])
      return
    }
    const t = setTimeout(
      () => guestSearch(form.guest_name).then(setHits).catch(() => setHits([])),
      250,
    )
    return () => clearTimeout(t)
  }, [form.guest_name, profile])

  useEffect(() => {
    getBookingOptions().then((o) => {
      setOptions(o)
      setForm((f) => ({
        ...f,
        room_type: f.room_type || o.room_types[0]?.name || "",
        meal_plan: o.meal_plans.find((m) => m.is_default)?.name ?? "",
      }))
    })
  }, [])

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  const checkOut = (() => {
    const d = new Date(form.check_in_date)
    d.setDate(d.getDate() + Math.max(1, form.nights))
    return d.toISOString().slice(0, 10)
  })()

  useEffect(() => {
    if (!form.room_type) return
    setQuoting(true)
    const t = setTimeout(() => {
      getQuote({
        room_type: form.room_type,
        check_in_date: form.check_in_date,
        check_out_date: checkOut,
        adults: form.adults,
        children: form.children,
        meal_plan: form.meal_plan || undefined,
        voucher_code: form.voucher_code || undefined,
      })
        .then((q) => {
          setQuote(q)
          setError(null)
        })
        .catch((e) => {
          setQuote(null)
          setError(shortErr(e))
        })
        .finally(() => setQuoting(false))
    }, 300)
    return () => clearTimeout(t)
  }, [
    form.room_type,
    form.check_in_date,
    form.nights,
    form.adults,
    form.children,
    form.meal_plan,
    form.voucher_code,
    checkOut,
    retryKey,
  ])

  // Availability for the stay dates - a single batched calendar read (no N+1);
  // rooms-left = the tightest night across the stay. Fails open: an unknown
  // count never blocks the desk, it just hides the badge.
  useEffect(() => {
    let alive = true
    setAvail(null)
    const nights = Math.min(31, Math.max(1, form.nights))
    const t = setTimeout(() => {
      getCalendar(nights, form.check_in_date)
        .then((cal) => {
          if (!alive) return
          const map: Record<string, number> = {}
          for (const row of cal.room_types) {
            map[row.room_type] = row.cells.length
              ? Math.min(...row.cells.map((c) => c.available))
              : 0
          }
          setAvail(map)
        })
        .catch(() => {
          if (alive) setAvail(null)
        })
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [form.check_in_date, form.nights, retryKey])

  // quotes for the additional rooms
  useEffect(() => {
    if (moreRooms.length === 0) {
      setMoreQuotes([])
      return
    }
    const t = setTimeout(() => {
      Promise.all(
        moreRooms.map((r) =>
          r.room_type
            ? getQuote({
                room_type: r.room_type,
                check_in_date: form.check_in_date,
                check_out_date: checkOut,
                adults: r.adults,
                children: r.children,
                meal_plan: r.meal_plan || undefined,
              }).catch(() => null)
            : Promise.resolve(null),
        ),
      ).then(setMoreQuotes)
    }, 300)
    return () => clearTimeout(t)
  }, [moreRooms, form.check_in_date, checkOut])

  function shortErr(e: unknown): string {
    const body = (e as { body?: string }).body
    if (body) {
      try {
        const msgs = JSON.parse(JSON.parse(body)._server_messages ?? "[]")
        if (msgs.length)
          return String(JSON.parse(msgs[0]).message).replace(/<[^>]+>/g, "")
      } catch {
        /* fall through */
      }
    }
    return (e as Error).message
  }

  async function submit(waitlist = false) {
    setBusy(true)
    setError(null)
    try {
      if (waitlist) {
        const res = await createBooking({
          guest_name: form.guest_name,
          phone: form.phone || undefined,
          guest: profile?.name,
          room_type: form.room_type,
          check_in_date: form.check_in_date,
          check_out_date: checkOut,
          adults: form.adults,
          children: form.children,
          meal_plan: form.meal_plan || undefined,
          voucher_code: form.voucher_code || undefined,
          company: form.company || undefined,
          nationality: form.nationality.trim() || undefined,
          id_type: form.id_type || undefined,
          id_number: form.id_number.trim() || undefined,
          waitlist: 1,
        })
        setDone({ ref: res.reservation, room: null, waitlist: true })
        props.onBooked()
        return
      }
      if (moreRooms.length > 0) {
        // several rooms → one group booking, billable as a block
        const rooms = [
          {
            room_type: form.room_type,
            count: 1,
            adults: form.adults,
            children: form.children,
            meal_plan: form.meal_plan || undefined,
          },
          ...moreRooms.map((r) => ({
            room_type: r.room_type,
            count: 1,
            adults: r.adults,
            children: r.children,
            meal_plan: r.meal_plan || undefined,
          })),
        ]
        const out = await call<{
          group_booking: string
          created: string[]
          skipped: { room_type: string; reason: string }[]
        }>("hotelpms.api.create_group_booking", {
          property: getCurrentProperty(),
          group_name: `${form.guest_name} · ${rooms.length} rooms`,
          check_in_date: form.check_in_date,
          check_out_date: checkOut,
          rooms,
          guest_name: form.guest_name,
          phone: form.phone || undefined,
          company: form.company || undefined,
        })
        if (out.skipped.length > 0) {
          setError(
            `Booked ${out.created.length} of ${rooms.length} rooms - ` +
              out.skipped.map((s) => s.reason).join("; "),
          )
          if (out.created.length === 0) return
        }
        setDone({ ref: out.group_booking, room: null })
        props.onBooked()
        return
      }
      const res = await createBooking({
        guest_name: form.guest_name,
        phone: form.phone || undefined,
        guest: profile?.name,
        room_type: form.room_type,
        check_in_date: form.check_in_date,
        check_out_date: checkOut,
        adults: form.adults,
        children: form.children,
        meal_plan: form.meal_plan || undefined,
        voucher_code: form.voucher_code || undefined,
        company: form.company || undefined,
        nationality: form.nationality.trim() || undefined,
        id_type: form.id_type || undefined,
        id_number: form.id_number.trim() || undefined,
        travel_agent: form.travel_agent || undefined,
        booking_type: form.company ? "Corporate" : undefined,
        booked_by_name: onBehalf ? form.booked_by_name || undefined : undefined,
        booked_by_phone: onBehalf
          ? form.booked_by_phone || undefined
          : undefined,
        booker_relation: onBehalf
          ? form.booker_relation || undefined
          : undefined,
        contact_preference:
          onBehalf && form.booked_by_name ? form.contact_preference : undefined,
        guest_category: extra.guest_category || undefined,
        stay_details: {
          arrival_mode: extra.arrival_mode || undefined,
          arrival_ref: extra.arrival_ref || undefined,
          arrival_datetime: extra.arrival_datetime || undefined,
          purpose: extra.purpose || undefined,
          extra_beds: extra.extra_beds || undefined,
          pickup_required: extra.pickup_required ? 1 : undefined,
          valet_parking: extra.valet_parking ? 1 : undefined,
          early_checkin: extra.early_checkin ? 1 : undefined,
          late_checkout: extra.late_checkout ? 1 : undefined,
        },
        instructions: extra.special_requests
          ? [
              {
                department: "Front Desk",
                instruction: extra.special_requests,
              },
            ]
          : undefined,
        addons: Object.entries(addonQty)
          .filter(([, q]) => q > 0)
          .map(([experience, qty]) => ({ experience, qty })),
      })
      setDone({ ref: res.reservation, room: res.room })
      props.onBooked()
    } catch (e) {
      setError(shortErr(e))
    } finally {
      setBusy(false)
    }
  }

  const set = (k: string, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }))

  // identity is optional at booking (required at check-in). Only validate the
  // ID number's shape when one is actually typed — never block an empty field.
  const idNumberBad =
    !!form.id_number.trim() &&
    !/^[A-Za-z0-9٠-٩\- ]{3,30}$/.test(form.id_number.trim())
  const idError = idNumberBad
    ? "Enter a valid ID number (3–30 letters or digits)."
    : null

  const selectedRt = options?.room_types.find(
    (rt) => rt.name === form.room_type,
  )
  const roomTypeName = primaryLabel(selectedRt?.room_type_name ?? "")
  const overCapacity =
    !!selectedRt &&
    ((selectedRt.adults_capacity > 0 &&
      form.adults > selectedRt.adults_capacity) ||
      (selectedRt.children_capacity > 0 &&
        form.children > selectedRt.children_capacity))

  // rooms needed to sleep the whole party in this room type, keeping at
  // least one adult in every room
  const roomsNeeded = (() => {
    if (!selectedRt) return 1
    const capA = selectedRt.adults_capacity || form.adults || 1
    const capC = selectedRt.children_capacity
    const n = Math.max(
      Math.ceil(form.adults / Math.max(1, capA)),
      capC > 0 ? Math.ceil(form.children / capC) : 1,
      1,
    )
    return Math.min(n, Math.max(1, form.adults))
  })()

  const distributeParty = () => {
    // spread the party as evenly as possible; the lot books as one group
    const n = roomsNeeded
    const baseA = Math.floor(form.adults / n)
    const remA = form.adults % n
    const baseC = Math.floor(form.children / n)
    const remC = form.children % n
    const alloc = Array.from({ length: n }, (_, i) => ({
      adults: baseA + (i < remA ? 1 : 0),
      children: baseC + (i < remC ? 1 : 0),
    }))
    setForm((f) => ({
      ...f,
      adults: alloc[0].adults,
      children: alloc[0].children,
    }))
    setMoreRooms(
      alloc.slice(1).map((a) => ({
        room_type: form.room_type,
        adults: a.adults,
        children: a.children,
        meal_plan: form.meal_plan,
      })),
    )
  }

  const grandTotal = (() => {
    if (!quote) return 0
    const addonsGross = Object.entries(addonQty).reduce((s, [n, q]) => {
      const x = options?.experiences.find((e) => e.name === n)
      return x && q > 0 ? s + q * x.price * (1 + x.gst_rate / 100) : s
    }, 0)
    return (
      quote.amount_after_tax +
      moreQuotes.reduce((s, q) => s + (q?.amount_after_tax ?? 0), 0) +
      addonsGross
    )
  })()

  const cancelCutoff = (() => {
    const pol = options?.property
    if (!pol) return ""
    const d = new Date(form.check_in_date + "T00:00:00")
    d.setDate(d.getDate() - (pol.free_cancel_days || 0))
    return d.toISOString().slice(0, 10)
  })()

  const addonsGross = Object.entries(addonQty).reduce((s, [n, q]) => {
    const x = options?.experiences.find((e) => e.name === n)
    return x && q > 0 ? s + q * x.price * (1 + x.gst_rate / 100) : s
  }, 0)

  // rooms this selection consumes per type (main stay + any extra rooms) - used
  // to catch a group that asks for more of a type than remains for the dates.
  const typeUse: Record<string, number> = {}
  if (form.room_type) typeUse[form.room_type] = 1
  for (const r of moreRooms) {
    if (r.room_type) typeUse[r.room_type] = (typeUse[r.room_type] ?? 0) + 1
  }
  const overCommitted =
    !!avail &&
    Object.entries(typeUse).some(([tp, used]) => used > (avail[tp] ?? 0))
  const mainSoldOut = !!avail && (avail[form.room_type] ?? 0) <= 0

  // one reason the confirm is blocked, in priority order, shown by the button
  const blockReason: string | null = !form.guest_name.trim()
    ? "Enter a guest name to continue"
    : !form.check_in_date
      ? "Pick a check-in date"
      : idError
        ? "Check the highlighted ID field to continue"
        : overCapacity
          ? "Party exceeds the room capacity"
          : overCommitted
            ? "No rooms available for these dates"
            : quoting
              ? "Getting the latest price…"
              : !quote
                ? error
                  ? "Fix the issue above to continue"
                  : "Enter stay details to see a price."
                : null

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="New booking"
      onKeyDown={(e) => e.key === "Escape" && props.onClose()}
    >
      <div
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={props.onClose}
        aria-hidden
      />
      <div
        className="absolute inset-y-0 end-0 flex h-full w-full flex-col bg-white shadow-2xl animate-sheet-in md:w-2/3"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200 px-6 py-4 md:px-8">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-sm"
            aria-hidden
          >
            <BedDouble className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
              New booking
            </h2>
            <p className="mt-0.5 truncate text-sm text-zinc-500">
              {primaryLabel(getCurrentProperty())}
              <span className="text-zinc-300"> · </span>
              Live quote as you type
            </p>
          </div>
          <Button variant="ghost" onClick={props.onClose} aria-label="Close">
            <X className="size-5" />
          </Button>
        </header>

        {done ? (
          <div className="space-y-5 overflow-y-auto px-6 py-8 md:px-8">
            {done.waitlist ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800">
                <p className="text-lg font-semibold">
                  <span>Waitlisted</span> · {done.ref}
                </p>
                <p className="mt-1 text-sm">
                  <span>
                    Parked with no room. Promote it from the reservation when a
                    room frees. Auto-purges 2 days after departure.
                  </span>
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800">
                <p className="text-lg font-semibold">
                  <span>Booked</span> · {done.ref}
                </p>
                <p className="mt-1 text-sm">
                  {done.room ? (
                    <>
                      <span>Room assigned:</span>{" "}
                      <span className="font-semibold">
                        {done.room.split("-").pop()}
                      </span>
                      .
                    </>
                  ) : (
                    <span>No room auto-assigned — pick one from Reservations.</span>
                  )}{" "}
                  <span>Find it under Arrivals on the stay date.</span>
                </p>
              </div>
            )}
            <Button className="px-5 py-2.5 text-base" onClick={props.onClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* Form */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 md:px-8 md:py-6">
              <div className="w-full max-w-none space-y-6">
                {options?.property?.sell_message && (
                  <div className="flex items-start gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
                    <Megaphone
                      className="mt-0.5 size-4 shrink-0 text-brand-700"
                      aria-hidden
                    />
                    <span>{options.property.sell_message}</span>
                  </div>
                )}

                <h3 className="-mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Guest details
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Guest name" required>
                    <div className="relative">
                      <input
                        className={inputCls}
                        value={form.guest_name}
                        onChange={(e) => {
                          setProfile(null)
                          set("guest_name", e.target.value)
                        }}
                        placeholder="Type to find or create"
                        aria-required="true"
                        autoFocus
                      />
                      {hits.length > 0 && (
                        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
                          {hits.map((h) => (
                            <li key={h.name}>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-zinc-50"
                                onClick={() => {
                                  setProfile(h)
                                  setHits([])
                                  setForm((f) => ({
                                    ...f,
                                    guest_name: h.full_name,
                                    phone: h.phone ?? f.phone,
                                  }))
                                }}
                              >
                                <span className="font-medium">{h.full_name}</span>
                                {Boolean(h.vip) && (
                                  <Star
                                    className="size-3 fill-amber-400 text-amber-400"
                                    aria-label="VIP"
                                  />
                                )}
                                <span className="ms-auto text-xs text-zinc-400">
                                  {h.phone ? `${h.phone} · ` : ""}
                                  {h.stays} stay{h.stays === 1 ? "" : "s"}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {profile && (
                      <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                        Returning guest · {profile.stays} stay
                        {profile.stays === 1 ? "" : "s"}
                        <button
                          type="button"
                          aria-label="Detach profile"
                          onClick={() => setProfile(null)}
                          className="text-brand-700/60 hover:text-brand-700"
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </span>
                    )}
                  </Field>
                  <Field label="Phone">
                    <input
                      className={inputCls}
                      type="tel"
                      dir="ltr"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="+966 5X XXX XXXX"
                    />
                  </Field>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50/40">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-start text-sm font-medium text-zinc-700"
                    onClick={() => setIdOpen((o) => !o)}
                    aria-expanded={idOpen}
                  >
                    <span>
                      Add ID &amp; nationality{" "}
                      <span className="font-normal text-zinc-400">
                        — optional, required at check-in
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-zinc-400 transition-transform",
                        idOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>
                  {idOpen && (
                    <div className="space-y-3 px-3.5 pb-3.5">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Nationality">
                          <input
                            className={inputCls}
                            value={form.nationality}
                            onChange={(e) => set("nationality", e.target.value)}
                            placeholder="e.g. Saudi"
                          />
                        </Field>
                        <Field label="ID type">
                          <select
                            className={inputCls}
                            value={form.id_type}
                            onChange={(e) => set("id_type", e.target.value)}
                          >
                            <option value="">—</option>
                            <option value="Passport">Passport</option>
                            <option value="Driving License">Driving License</option>
                            <option value="Other">Other</option>
                          </select>
                        </Field>
                        {form.id_type && (
                          <Field label="ID number">
                            <input
                              className={cn(
                                inputCls,
                                idError &&
                                  "outline-2 outline-offset-1 outline-rose-400",
                              )}
                              value={form.id_number}
                              onChange={(e) => set("id_number", e.target.value)}
                              placeholder="Document number"
                              aria-invalid={!!idError}
                            />
                          </Field>
                        )}
                      </div>
                      {idError && (
                        <p className="text-xs font-medium text-rose-600">{idError}</p>
                      )}
                      <p className="text-xs text-zinc-400">
                        Not required to book — captured now, it speeds up check-in.
                      </p>
                    </div>
                  )}
                </div>

                <h3 className="-mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Stay &amp; rate
                </h3>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="block text-sm font-medium text-zinc-600">
                      Room type
                      <span className="ms-0.5 text-rose-500" aria-hidden>
                        *
                      </span>
                    </span>
                    {avail === null && (
                      <span className="flex items-center gap-1 text-xs text-zinc-400">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        Checking availability
                      </span>
                    )}
                  </div>
                  <div
                    role="group"
                    aria-label="Room type"
                    className="grid gap-2"
                  >
                    {!options &&
                      [0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-[74px] animate-pulse rounded-xl border border-zinc-200 bg-zinc-100/70"
                          aria-hidden
                        />
                      ))}
                    {options?.room_types.map((rt) => {
                      const left = avail ? avail[rt.name] ?? 0 : null
                      const sold = left !== null && left <= 0
                      const low = left !== null && left > 0 && left <= 2
                      const selected = form.room_type === rt.name
                      return (
                        <button
                          key={rt.name}
                          type="button"
                          aria-pressed={selected}
                          disabled={sold}
                          onClick={() => set("room_type", rt.name)}
                          className={cn(
                            "flex items-stretch gap-3 rounded-xl border p-3 text-start transition",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                            selected
                              ? "border-brand-500 bg-brand-50/70 ring-1 ring-brand-500"
                              : "border-zinc-200 bg-white hover:border-brand-300 hover:bg-brand-50/30 active:bg-brand-50/60",
                            sold &&
                              "cursor-not-allowed opacity-60 hover:border-zinc-200 hover:bg-white",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-9 shrink-0 place-items-center self-center rounded-lg",
                              selected
                                ? "bg-brand-600 text-white"
                                : "bg-zinc-100 text-zinc-500",
                            )}
                            aria-hidden
                          >
                            <BedDouble className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-semibold text-zinc-900">
                                {primaryLabel(rt.room_type_name)}
                              </span>
                              {left === null ? null : sold ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                  <Ban className="size-3" aria-hidden /> Sold out
                                </span>
                              ) : low ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                  <AlertTriangle className="size-3" aria-hidden />
                                  {`${left} left`}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                  <Check className="size-3" aria-hidden /> Available for
                                  your dates
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block text-xs text-zinc-500">
                              {tt("Sleeps up to")} {qty(rt.adults_capacity, "adult")}
                              {rt.children_capacity > 0 && (
                                <>
                                  {" · "}
                                  {qty(rt.children_capacity, "child", "children")}
                                </>
                              )}
                            </span>
                            {sold && (
                              <span className="mt-1 block text-xs font-medium text-rose-600">
                                No rooms available for these dates
                              </span>
                            )}
                          </span>
                          <span className="flex shrink-0 flex-col items-end justify-center text-end">
                            <span className="text-[11px] text-zinc-400">from</span>
                            <span className="font-semibold tabular-nums text-zinc-900">
                              <bdi dir="ltr">
                                {cur()}
                                {inr(rt.base_price)}
                              </bdi>
                            </span>
                            <span className="text-[11px] text-zinc-400">/night</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Check-in">
                    <input
                      type="date"
                      className={inputCls}
                      value={form.check_in_date}
                      onChange={(e) => set("check_in_date", e.target.value)}
                    />
                  </Field>
                  <Field label="Nights">
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      value={form.nights}
                      onChange={(e) =>
                        set("nights", Math.max(1, Number(e.target.value)))
                      }
                    />
                  </Field>
                  <Field label="Adults">
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      value={form.adults}
                      onChange={(e) =>
                        set("adults", Math.max(1, Number(e.target.value)))
                      }
                    />
                  </Field>
                  <Field label="Children">
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={form.children}
                      onChange={(e) =>
                        set("children", Math.max(0, Number(e.target.value)))
                      }
                    />
                  </Field>
                </div>

                {selectedRt && overCapacity && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                    <bdi>{primaryLabel(selectedRt.room_type_name)}</bdi>{" "}
                    {tt("sleeps up to")}{" "}
                    <strong>{qty(selectedRt.adults_capacity, "adult")}</strong>
                    {selectedRt.children_capacity > 0 && (
                      <>
                        {" · "}
                        <strong>{qty(selectedRt.children_capacity, "child", "children")}</strong>
                      </>
                    )}{" "}
                    {tt("per room.")}{" "}
                    <button
                      className="font-semibold text-brand-700 hover:underline"
                      onClick={distributeParty}
                    >
                      {fill(tt("Split into {n} rooms"), { n: roomsNeeded })}
                    </button>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Meal plan">
                    <select
                      className={inputCls}
                      value={form.meal_plan}
                      onChange={(e) => set("meal_plan", e.target.value)}
                    >
                      <option value="">Room only</option>
                      {options?.meal_plans.map((mp) => (
                        <option key={mp.name} value={mp.name}>
                          {mp.label} (+{cur()}
                          {inr(mp.price_per_adult)}/adult)
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Voucher">
                    <input
                      className={inputCls}
                      value={form.voucher_code}
                      onChange={(e) =>
                        set("voucher_code", e.target.value.toUpperCase())
                      }
                      placeholder="Optional code"
                    />
                  </Field>
                </div>

                {moreRooms.map((r, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5"
                  >
                    <span className="w-full text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Room {i + 2}
                    </span>
                    <select
                      className={`${inputCls} !w-auto flex-1`}
                      aria-label={`Room ${i + 2} type`}
                      value={r.room_type}
                      onChange={(e) =>
                        setMoreRooms((rs) =>
                          rs.map((x, j) =>
                            j === i ? { ...x, room_type: e.target.value } : x,
                          ),
                        )
                      }
                    >
                      {options?.room_types.map((rt) => {
                        const left = avail ? avail[rt.name] ?? 0 : null
                        return (
                          <option
                            key={rt.name}
                            value={rt.name}
                            disabled={left === 0 && rt.name !== r.room_type}
                          >
                            {primaryLabel(rt.room_type_name)}
                            {left !== null && left > 0
                              ? ` · ${tt(`${left} left`)}`
                              : ""}
                          </option>
                        )
                      })}
                    </select>
                    <input
                      type="number"
                      min={1}
                      aria-label={`Room ${i + 2} adults`}
                      className={`${inputCls} !w-16`}
                      value={r.adults}
                      onChange={(e) =>
                        setMoreRooms((rs) =>
                          rs.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  adults: Math.max(1, Number(e.target.value)),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                    <select
                      className={`${inputCls} !w-auto`}
                      aria-label={`Room ${i + 2} meal plan`}
                      value={r.meal_plan}
                      onChange={(e) =>
                        setMoreRooms((rs) =>
                          rs.map((x, j) =>
                            j === i ? { ...x, meal_plan: e.target.value } : x,
                          ),
                        )
                      }
                    >
                      <option value="">Room only</option>
                      {options?.meal_plans.map((mp) => (
                        <option key={mp.name} value={mp.name}>
                          {mp.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded p-1.5 text-zinc-400 hover:text-rose-500"
                      aria-label={`Remove room ${i + 2}`}
                      onClick={() =>
                        setMoreRooms((rs) => rs.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                    {avail &&
                      r.room_type &&
                      (typeUse[r.room_type] ?? 0) > (avail[r.room_type] ?? 0) && (
                        <span className="flex w-full items-center gap-1 text-xs font-medium text-rose-600">
                          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                          No rooms available for these dates
                        </span>
                      )}
                  </div>
                ))}

                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:border-brand-500 hover:bg-brand-50/40 hover:text-brand-800"
                  onClick={() =>
                    setMoreRooms((rs) => [
                      ...rs,
                      {
                        room_type: form.room_type,
                        adults: 2,
                        children: 0,
                        meal_plan: form.meal_plan,
                      },
                    ])
                  }
                >
                  <Plus className="size-4" aria-hidden />
                  Add another room
                </button>

                <div className="border-t border-zinc-100 pt-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between py-2 text-start text-sm font-medium text-zinc-700"
                    onClick={() => setMoreOpen((o) => !o)}
                    aria-expanded={moreOpen}
                  >
                    <span>Company, add-ons & arrival details</span>
                    <ChevronDown
                      className={
                        "size-4 text-zinc-400 transition-transform " +
                        (moreOpen ? "rotate-180" : "")
                      }
                      aria-hidden
                    />
                  </button>

                  {moreOpen && (
                    <div className="space-y-5 pb-2 pt-1">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Company (bill corporate)">
                          <select
                            className={inputCls}
                            value={form.company}
                            onChange={(e) => set("company", e.target.value)}
                          >
                            <option value="">-</option>
                            {options?.companies.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.company_name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Travel agent">
                          <select
                            className={inputCls}
                            value={form.travel_agent}
                            onChange={(e) =>
                              set("travel_agent", e.target.value)
                            }
                          >
                            <option value="">-</option>
                            {options?.travel_agents.map((t) => (
                              <option key={t.name} value={t.name}>
                                {t.agent_name} ({t.commission_pct}%)
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      {moreRooms.length === 0 &&
                        (options?.experiences.length ?? 0) > 0 && (
                          <div>
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600">
                              Add-ons
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {options?.experiences.map((x) => {
                                const on = (addonQty[x.name] ?? 0) > 0
                                return (
                                  <button
                                    key={x.name}
                                    type="button"
                                    aria-pressed={on}
                                    className={
                                      on
                                        ? "rounded-full bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                                        : "rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:border-brand-600"
                                    }
                                    onClick={() =>
                                      setAddonQty((q) => ({
                                        ...q,
                                        [x.name]: on ? 0 : 1,
                                      }))
                                    }
                                  >
                                    {x.experience_name} · {cur()}
                                    {inr(x.price)}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                      {moreRooms.length > 0 && (
                        <p className="text-xs text-zinc-400">
                          Multi-room bookings are created as a group — vouchers,
                          add-ons and booker details can be added per stay
                          afterwards.
                        </p>
                      )}

                      {moreRooms.length === 0 && (
                        <>
                          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                            <input
                              type="checkbox"
                              className="size-4 accent-brand-600"
                              checked={onBehalf}
                              onChange={(e) => setOnBehalf(e.target.checked)}
                            />
                            Booked on someone&apos;s behalf
                          </label>
                          {onBehalf && (
                            <div className="space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Booker name">
                                  <input
                                    className={inputCls}
                                    value={form.booked_by_name}
                                    onChange={(e) =>
                                      set("booked_by_name", e.target.value)
                                    }
                                    placeholder="Who arranged this stay"
                                  />
                                </Field>
                                <Field label="Booker phone">
                                  <input
                                    className={inputCls}
                                    type="tel"
                                    dir="ltr"
                                    value={form.booked_by_phone}
                                    onChange={(e) =>
                                      set("booked_by_phone", e.target.value)
                                    }
                                    placeholder="+966 5X XXX XXXX"
                                  />
                                </Field>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Relation">
                                  <select
                                    className={inputCls}
                                    value={form.booker_relation}
                                    onChange={(e) =>
                                      set("booker_relation", e.target.value)
                                    }
                                  >
                                    <option value="">-</option>
                                    {[
                                      "Assistant",
                                      "Family",
                                      "Company Travel Desk",
                                      "Travel Agent",
                                    ].map((r) => (
                                      <option key={r}>{r}</option>
                                    ))}
                                  </select>
                                </Field>
                                <Field label="Send links & updates to">
                                  <select
                                    className={inputCls}
                                    value={form.contact_preference}
                                    onChange={(e) =>
                                      set("contact_preference", e.target.value)
                                    }
                                  >
                                    <option value="Booker">Booker</option>
                                    <option value="Guest">Guest</option>
                                    <option value="Both">Both</option>
                                  </select>
                                </Field>
                              </div>
                            </div>
                          )}

                          <Field label="Special requests">
                            <textarea
                              className={inputCls}
                              rows={2}
                              placeholder="e.g. prayer mat, high floor, allergy notes"
                              value={extra.special_requests}
                              onChange={(e) =>
                                setX("special_requests", e.target.value)
                              }
                            />
                          </Field>
                          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                            {(
                              [
                                ["pickup_required", "Airport pickup"],
                                ["valet_parking", "Valet parking"],
                                ["early_checkin", "Early check-in"],
                                ["late_checkout", "Late check-out"],
                              ] as const
                            ).map(([k, lbl]) => (
                              <label
                                key={k}
                                className="flex items-center gap-1.5 font-medium text-zinc-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={extra[k]}
                                  onChange={(e) => setX(k, e.target.checked)}
                                />
                                {lbl}
                              </label>
                            ))}
                          </div>
                          {extra.pickup_required && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label="Arrival mode">
                                <select
                                  className={inputCls}
                                  value={extra.arrival_mode}
                                  onChange={(e) =>
                                    setX("arrival_mode", e.target.value)
                                  }
                                >
                                  <option value="">—</option>
                                  <option>Air</option>
                                  <option>Road</option>
                                  <option>Rail</option>
                                  <option>Sea</option>
                                  <option>Own vehicle</option>
                                </select>
                              </Field>
                              <Field label="Flight / train no.">
                                <input
                                  className={inputCls}
                                  value={extra.arrival_ref}
                                  onChange={(e) =>
                                    setX("arrival_ref", e.target.value)
                                  }
                                />
                              </Field>
                              <Field label="Arrival time">
                                <input
                                  type="datetime-local"
                                  className={inputCls}
                                  value={extra.arrival_datetime}
                                  onChange={(e) =>
                                    setX("arrival_datetime", e.target.value)
                                  }
                                />
                              </Field>
                              <Field label="Extra beds">
                                <input
                                  type="number"
                                  min={0}
                                  className={inputCls}
                                  value={extra.extra_beds}
                                  onChange={(e) =>
                                    setX("extra_beds", Number(e.target.value))
                                  }
                                />
                              </Field>
                            </div>
                          )}
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Purpose of visit">
                              <select
                                className={inputCls}
                                value={extra.purpose}
                                onChange={(e) =>
                                  setX("purpose", e.target.value)
                                }
                              >
                                <option value="">—</option>
                                <option>Leisure</option>
                                <option>Business</option>
                                <option>Event / Wedding</option>
                                <option>Medical</option>
                                <option>Pilgrimage</option>
                                <option>Crew</option>
                                <option>Other</option>
                              </select>
                            </Field>
                            <Field label="Guest category">
                              <select
                                className={inputCls}
                                value={extra.guest_category}
                                onChange={(e) =>
                                  setX("guest_category", e.target.value)
                                }
                              >
                                <option value="">Standard</option>
                                <option>VIP</option>
                                <option>Corporate</option>
                                <option>Complimentary</option>
                                <option>Crew</option>
                              </select>
                            </Field>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quote rail — always visible on lg */}
            <aside className="flex w-full shrink-0 flex-col border-t border-zinc-200 bg-zinc-50 lg:w-80 lg:border-s lg:border-t-0 xl:w-[22rem]">
              <div className="max-h-[42vh] flex-1 overflow-y-auto px-6 py-5 md:px-7 lg:max-h-none">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Quote
                  </h3>
                  {quoting && (
                    <Loader2
                      className="size-4 animate-spin text-zinc-400"
                      aria-label="Updating quote"
                    />
                  )}
                </div>

                {quote ? (
                  <div className="space-y-2.5 text-[15px]">
                    <div className="flex justify-between gap-3 text-zinc-600">
                      <span className="min-w-0 truncate">
                        {roomTypeName} · {quote.nights} night
                        {quote.nights === 1 ? "" : "s"}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        <bdi dir="ltr">
                          {cur()}
                          {inr(quote.room_total)}
                        </bdi>
                      </span>
                    </div>
                    {quote.meal_total > 0 && (
                      <div className="flex justify-between text-zinc-600">
                        <span>Meals</span>
                        <span className="tabular-nums">
                          <bdi dir="ltr">
                            {cur()}
                            {inr(quote.meal_total)}
                          </bdi>
                        </span>
                      </div>
                    )}
                    {quote.discount > 0 && (
                      <div className="flex justify-between font-medium text-emerald-700">
                        <span>Voucher</span>
                        <span className="tabular-nums">
                          <bdi dir="ltr">
                            −{cur()}
                            {inr(quote.discount)}
                          </bdi>
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-zinc-600">
                      <span>
                        {taxLabel()} <bdi dir="ltr">{quote.tax_percent}%</bdi>
                      </span>
                      <span className="tabular-nums">
                        <bdi dir="ltr">
                          {cur()}
                          {inr(quote.tax_amount)}
                        </bdi>
                      </span>
                    </div>
                    {moreQuotes.map((mq, i) =>
                      mq ? (
                        <div
                          key={i}
                          className="flex justify-between gap-3 text-zinc-600"
                        >
                          <span className="min-w-0 truncate">
                            Room {i + 2} ·{" "}
                            {primaryLabel(
                              options?.room_types.find(
                                (rt) => rt.name === moreRooms[i]?.room_type,
                              )?.room_type_name ?? "",
                            )}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            <bdi dir="ltr">
                              {cur()}
                              {inr(mq.amount_after_tax)}
                            </bdi>
                          </span>
                        </div>
                      ) : null,
                    )}
                    {addonsGross > 0 && (
                      <div className="flex justify-between text-zinc-600">
                        <span>Add-ons (incl. {taxLabel()})</span>
                        <span className="tabular-nums">
                          <bdi dir="ltr">
                            {cur()}
                            {inr(addonsGross)}
                          </bdi>
                        </span>
                      </div>
                    )}

                    <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 shadow-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-zinc-500">
                          Total
                          {moreRooms.length > 0 ? " · all rooms" : ""}
                        </span>
                        <span className="text-3xl font-semibold tabular-nums tracking-tight text-zinc-900">
                          <bdi dir="ltr">
                            {cur()}
                            {inr(grandTotal)}
                          </bdi>
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">
                        <bdi dir="ltr" className="tabular-nums">
                          {form.check_in_date} → {checkOut}
                        </bdi>{" "}
                        · {qty(quote.nights, "night")}
                      </p>
                      {(options?.property?.deposit_pct ?? 0) > 0 && (
                        <div className="mt-2.5 flex items-baseline justify-between gap-2 border-t border-zinc-100 pt-2.5">
                          <span className="text-sm font-medium text-zinc-500">
                            Deposit due now
                            <span className="text-zinc-400">
                              {" "}
                              ({options!.property.deposit_pct}%)
                            </span>
                          </span>
                          <span className="text-base font-semibold tabular-nums text-zinc-900">
                            <bdi dir="ltr">
                              {cur()}
                              {inr(
                                (grandTotal * options!.property.deposit_pct) / 100,
                              )}
                            </bdi>
                          </span>
                        </div>
                      )}
                    </div>

                    {options?.property && (
                      <p className="pt-1 text-xs leading-relaxed text-zinc-500">
                        {(options.property.cancellation_fee || "None") === "None"
                          ? tt("Free cancellation.")
                          : fill(
                              tt(
                                "Free cancellation until {cutoff}; after that the {fee} is charged.",
                              ),
                              {
                                cutoff: cancelCutoff,
                                fee: String(options.property.cancellation_fee).toLowerCase(),
                              },
                            )}
                        {(options.property.no_show_charge || "None") !== "None" && (
                          <>
                            {" "}
                            {fill(tt("No-show: {charge} charged."), {
                              charge: String(options.property.no_show_charge).toLowerCase(),
                            })}
                          </>
                        )}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">
                    {error
                      ? "Fix the issue below to see a price."
                      : "Enter stay details to see a price."}
                  </p>
                )}

                {error && (
                  <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                    <p>{error}</p>
                    <button
                      type="button"
                      onClick={() => setRetryKey((k) => k + 1)}
                      className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                    >
                      <RotateCw className="size-3.5" aria-hidden /> Retry
                    </button>
                  </div>
                )}
              </div>

              <div className="shrink-0 space-y-2 border-t border-zinc-200 bg-white px-6 py-4 md:px-7">
                <Button
                  className="min-h-[44px] w-full justify-center py-2.5 text-base"
                  disabled={busy || !!blockReason}
                  onClick={() => submit()}
                >
                  {busy ? "Booking…" : "Confirm booking"}
                </Button>
                {!busy && blockReason && (
                  <p
                    className="flex items-center justify-center gap-1.5 text-center text-xs text-zinc-500"
                    role="status"
                  >
                    {(mainSoldOut || overCommitted || overCapacity) && (
                      <AlertTriangle
                        className="size-3.5 shrink-0 text-amber-600"
                        aria-hidden
                      />
                    )}
                    {blockReason}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="min-h-[44px] justify-center"
                    onClick={props.onClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[44px] justify-center"
                    disabled={busy || !form.guest_name.trim()}
                    onClick={() => submit(true)}
                    title="Park this stay with no room; promote when inventory frees"
                  >
                    Waitlist
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
