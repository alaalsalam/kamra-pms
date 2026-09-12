import { useEffect, useId, useMemo, useRef, useState } from "react"
import { ChevronDown, Search } from "lucide-react"

import { cn } from "../lib/utils"
import { useT } from "../lib/i18n"
import {
  COUNTRIES,
  PHONE_DEFAULT_ISO,
  findCountryByDial,
  findCountryByIso,
  formatNational,
  isoForCountryName,
  phoneLenLabel,
  phoneLens,
  phoneLenStatus,
  phoneValid,
  toE164,
  toLatinDigits,
  type Country,
} from "../lib/phone"

type Props = {
  /** Composed E.164 value, e.g. "+9677xxxxxxx" (or ""). Read once on mount. */
  value: string
  /** Emits the composed E.164 number and whether it passes length validation. */
  onChange: (e164: string, valid: boolean) => void
  /** Property country, used to pick a sensible default dial code. */
  defaultCountryName?: string | null
  label: string
  required?: boolean
}

function parseInitial(
  value: string,
  defaultCountryName?: string | null,
): { iso: string; digits: string } {
  const iso = isoForCountryName(defaultCountryName) ?? PHONE_DEFAULT_ISO
  const raw = (value ?? "").trim()
  if (raw.startsWith("+")) {
    const latin = toLatinDigits(raw)
    const c = findCountryByDial(latin)
    if (c) return { iso: c.iso, digits: latin.slice(c.dial.length) }
    return { iso, digits: latin } // "+" but unknown dial - keep the digits
  }
  // A stored local number (e.g. "0555…") is kept under the default country
  // rather than wiped, so opening an edit form still shows the existing phone.
  return { iso, digits: toLatinDigits(raw) }
}

export default function PhoneField({
  value,
  onChange,
  defaultCountryName,
  label,
  required,
}: Props) {
  const { lang } = useT()
  const id = useId()
  const errId = `${id}-err`
  // parse the incoming value exactly once; the field owns its state after mount
  const init = useMemo(
    () => parseInitial(value, defaultCountryName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [iso, setIso] = useState(init.iso)
  const [digits, setDigits] = useState(init.digits)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [touched, setTouched] = useState(false)
  // Type on the raw digits (stable caret, no reformatting jitter); only show the
  // grouped number once the field is left.
  const [focused, setFocused] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const country = findCountryByIso(iso) ?? COUNTRIES[0]
  const valid = phoneValid(iso, digits)
  const lenStatus = phoneLenStatus(iso, digits)
  const maxLen = Math.max(...phoneLens(country))
  // too-long is flagged as soon as it happens; too-short / wrong-pattern only
  // once the user has left the field or filled it to the expected length.
  const showError =
    digits.length > 0 &&
    !valid &&
    (lenStatus === "long" || touched || digits.length >= maxLen)

  const name = (c: Country) => (lang === "ar" ? c.ar : c.en)

  // push the composed number up whenever the country or digits change. Skip the
  // mount fire so opening a form (empty create, or an edit whose stored value we
  // just parsed) doesn't spuriously mark it dirty or flip the validity flag.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    onChange(digits ? toE164(iso, digits) : "", valid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, digits])

  // close the dropdown on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  function handleNational(raw: string) {
    // let a guest paste/type a full international number and auto-detect the country
    const trimmed = raw.trim()
    if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
      const rest = toLatinDigits(raw)
      const match = findCountryByDial(rest)
      if (match) {
        setIso(match.iso)
        setDigits(rest.slice(match.dial.length).slice(0, 15))
        return
      }
    }
    setDigits(toLatinDigits(raw).slice(0, 15))
  }

  function pick(c: Country) {
    setIso(c.iso)
    setOpen(false)
    setQuery("")
    triggerRef.current?.focus()
  }

  const q = query.trim().toLowerCase()
  const qDigits = toLatinDigits(query)
  const filtered = COUNTRIES.filter(
    (c) =>
      !q ||
      c.en.toLowerCase().includes(q) ||
      c.ar.includes(query.trim()) ||
      (qDigits && c.dial.startsWith(qDigits)),
  )

  const lenHint =
    lang === "ar"
      ? ` (${phoneLenLabel(country)} أرقام — أدخلت ${digits.length})`
      : ` (${phoneLenLabel(country)} digits — you entered ${digits.length})`
  const errMsg =
    (lang === "ar"
      ? "رقم الهاتف غير صحيح لهذه الدولة"
      : "Invalid phone number for this country") +
    (lenStatus === "short" || lenStatus === "long" ? lenHint : "")
  const searchPh = lang === "ar" ? "ابحث عن دولة أو مفتاح…" : "Search country or code…"
  const noRes = lang === "ar" ? "لا توجد نتائج" : "No results"
  const pickCountry = lang === "ar" ? "اختر الدولة" : "Select country"

  return (
    <div ref={rootRef} className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-600">
        {label}
        {required && (
          <span className="ms-0.5 text-rose-500" aria-hidden>
            *
          </span>
        )}
      </label>

      <div className="relative">
        <div
          className={cn(
            "flex min-w-0 items-stretch rounded-lg border bg-white transition-colors",
            showError
              ? "border-rose-400 ring-1 ring-rose-300"
              : "border-zinc-300 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-gold-500",
          )}
        >
          <button
            ref={triggerRef}
            type="button"
            dir="ltr"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={pickCountry}
            data-no-translate
            className="flex items-center gap-1.5 rounded-s-lg border-e border-zinc-200 px-3 text-base hover:bg-zinc-50"
          >
            <span className="text-lg leading-none">{country.flag}</span>
            <span className="tabular-nums text-zinc-700">+{country.dial}</span>
            <ChevronDown className="size-4 text-zinc-400" aria-hidden />
          </button>

          <input
            id={id}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            dir="ltr"
            value={focused ? digits : formatNational(iso, digits)}
            onChange={(e) => handleNational(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              setTouched(true)
            }}
            placeholder={"X".repeat(maxLen)}
            aria-invalid={showError || undefined}
            aria-describedby={showError ? errId : undefined}
            className="min-w-0 flex-1 rounded-e-lg bg-transparent px-3 py-2.5 text-base outline-none placeholder:text-zinc-300"
          />
        </div>

        {open && (
          <div
            role="listbox"
            aria-label={pickCountry}
            className="absolute z-50 mt-1 max-h-72 w-full min-w-[16rem] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
              <Search className="size-4 shrink-0 text-zinc-400" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPh}
                data-no-translate
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-sm text-zinc-400" data-no-translate>
                  {noRes}
                </p>
              )}
              {filtered.map((c) => (
                <button
                  key={c.iso}
                  type="button"
                  role="option"
                  aria-selected={c.iso === iso}
                  onClick={() => pick(c)}
                  data-no-translate
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm hover:bg-zinc-50",
                    c.iso === iso && "bg-zinc-100 font-medium",
                  )}
                >
                  <span className="text-lg leading-none">{c.flag}</span>
                  <span className="flex-1 text-zinc-700">{name(c)}</span>
                  <span dir="ltr" className="tabular-nums text-zinc-400">
                    +{c.dial}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showError && (
        <p
          id={errId}
          role="alert"
          data-no-translate
          className="mt-1.5 text-sm text-rose-600"
        >
          {errMsg}
        </p>
      )}
    </div>
  )
}
