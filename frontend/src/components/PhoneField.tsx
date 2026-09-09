import { useEffect, useId, useMemo, useRef, useState } from "react"
import { ChevronDown, Search } from "lucide-react"

import { cn } from "../lib/utils"
import { useT } from "../lib/i18n"
import {
  COUNTRIES,
  PHONE_DEFAULT_ISO,
  findCountryByDial,
  findCountryByIso,
  isoForCountryName,
  phoneDigitsValid,
  phoneLenLabel,
  phoneLens,
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
  if (value?.startsWith("+")) {
    const latin = toLatinDigits(value)
    const c = findCountryByDial(latin)
    if (c) return { iso: c.iso, digits: latin.slice(c.dial.length) }
  }
  return {
    iso: isoForCountryName(defaultCountryName) ?? PHONE_DEFAULT_ISO,
    digits: "",
  }
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

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const country = findCountryByIso(iso) ?? COUNTRIES[0]
  const valid = digits.length > 0 && phoneDigitsValid(country, digits)
  const maxLen = Math.max(...phoneLens(country))
  const showError = digits.length > 0 && !valid && (touched || digits.length >= maxLen)

  const name = (c: Country) => (lang === "ar" ? c.ar : c.en)

  // push the composed number up whenever the country or digits change
  useEffect(() => {
    onChange(digits ? `+${country.dial}${digits}` : "", valid)
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
    if (raw.trim().startsWith("+") || raw.trim().startsWith("00")) {
      const rest = toLatinDigits(raw)
      const match = findCountryByDial(rest)
      if (match) {
        setIso(match.iso)
        setDigits(rest.slice(match.dial.length).slice(0, 13))
        return
      }
    }
    setDigits(toLatinDigits(raw).slice(0, 13))
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

  const errMsg =
    lang === "ar"
      ? `رقم ${name(country)} يجب أن يتكوّن من ${phoneLenLabel(country)} أرقام${
          digits.length ? ` — أدخلت ${digits.length}` : ""
        }`
      : `${name(country)} numbers must be ${phoneLenLabel(country)} digits${
          digits.length ? ` — you entered ${digits.length}` : ""
        }`
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
            value={digits}
            onChange={(e) => handleNational(e.target.value)}
            onBlur={() => setTouched(true)}
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
