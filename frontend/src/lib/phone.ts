/** Format property/host phone numbers for guest-facing pages.
 *  Always include an international dial code so guests can tap-to-call. */

import {
  AsYouType,
  isValidPhoneNumber,
  parsePhoneNumber,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js/max"

const DIAL_BY_COUNTRY: Record<string, string> = {
  india: "91",
  in: "91",
  "united arab emirates": "971",
  uae: "971",
  ae: "971",
  "saudi arabia": "966",
  saudi: "966",
  sa: "966",
  "united states": "1",
  usa: "1",
  us: "1",
  "united kingdom": "44",
  uk: "44",
  gb: "44",
  singapore: "65",
  sg: "65",
  australia: "61",
  au: "61",
}

function dialForCountry(country?: string | null): string {
  const key = (country || "India").trim().toLowerCase()
  return DIAL_BY_COUNTRY[key] || "91"
}

/** Digits only, drop a leading trunk 0. */
function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "")
}

function groupLocal(local: string): string {
  // Saudi landline/mobile numbers are nine digits after +966.
  if (local.length === 9) {
    return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`
  }
  if (local.length === 10) {
    return `${local.slice(0, 5)} ${local.slice(5)}`
  }
  return local
}

/**
 * Display form, e.g. `+91 91488 69914`.
 * Leaves numbers that already start with `+` intact (normalized spacing).
 */
export function formatPhoneDisplay(
  phone: string | null | undefined,
  country?: string | null,
): string {
  if (!phone?.trim()) return ""
  const raw = phone.trim()
  if (raw.startsWith("+")) {
    const rest = digitsOnly(raw.slice(1))
    if (!rest) return raw
    const expected = country ? dialForCountry(country) : ""
    const known = [...new Set(Object.values(DIAL_BY_COUNTRY))]
      .sort((a, b) => b.length - a.length)
      .find((dial) => rest.startsWith(dial))
    const dial = expected && rest.startsWith(expected) ? expected : known
    return dial ? `+${dial} ${groupLocal(rest.slice(dial.length))}` : `+${rest}`
  }
  const dial = dialForCountry(country)
  let local = digitsOnly(raw)
  // Strip an embedded country code, e.g. "919148869914" -> "9148869914".
  // Guard on length > 10: a plain 10-digit local number (India) can itself
  // start with "91" (e.g. 9148869914) and must NOT be stripped.
  if (local.length > 10 && local.startsWith(dial)) {
    local = local.slice(dial.length)
  }
  if (local.length === 10) {
    return `+${dial} ${groupLocal(local)}`
  }
  return `+${dial} ${groupLocal(local)}`
}

/* ------------------------------------------------------------------ *
 * Guest phone entry: country picker + per-country length validation.
 * `len` is the national significant number length (digits after the dial
 * code, trunk 0 dropped). An array means a country genuinely allows a range.
 * ------------------------------------------------------------------ */

export type Country = {
  iso: string
  flag: string
  dial: string
  len: number | number[]
  en: string
  ar: string
}

export const COUNTRIES: Country[] = [
  // Gulf + Arab world first (most relevant to this market)
  { iso: "SA", flag: "🇸🇦", dial: "966", len: 9, en: "Saudi Arabia", ar: "السعودية" },
  { iso: "YE", flag: "🇾🇪", dial: "967", len: 9, en: "Yemen", ar: "اليمن" },
  { iso: "AE", flag: "🇦🇪", dial: "971", len: 9, en: "United Arab Emirates", ar: "الإمارات" },
  { iso: "QA", flag: "🇶🇦", dial: "974", len: 8, en: "Qatar", ar: "قطر" },
  { iso: "KW", flag: "🇰🇼", dial: "965", len: 8, en: "Kuwait", ar: "الكويت" },
  { iso: "BH", flag: "🇧🇭", dial: "973", len: 8, en: "Bahrain", ar: "البحرين" },
  { iso: "OM", flag: "🇴🇲", dial: "968", len: 8, en: "Oman", ar: "عُمان" },
  { iso: "EG", flag: "🇪🇬", dial: "20", len: 10, en: "Egypt", ar: "مصر" },
  { iso: "JO", flag: "🇯🇴", dial: "962", len: 9, en: "Jordan", ar: "الأردن" },
  { iso: "LB", flag: "🇱🇧", dial: "961", len: [7, 8], en: "Lebanon", ar: "لبنان" },
  { iso: "IQ", flag: "🇮🇶", dial: "964", len: 10, en: "Iraq", ar: "العراق" },
  { iso: "SY", flag: "🇸🇾", dial: "963", len: 9, en: "Syria", ar: "سوريا" },
  { iso: "PS", flag: "🇵🇸", dial: "970", len: 9, en: "Palestine", ar: "فلسطين" },
  { iso: "LY", flag: "🇱🇾", dial: "218", len: 9, en: "Libya", ar: "ليبيا" },
  { iso: "SD", flag: "🇸🇩", dial: "249", len: 9, en: "Sudan", ar: "السودان" },
  { iso: "DZ", flag: "🇩🇿", dial: "213", len: 9, en: "Algeria", ar: "الجزائر" },
  { iso: "MA", flag: "🇲🇦", dial: "212", len: 9, en: "Morocco", ar: "المغرب" },
  { iso: "TN", flag: "🇹🇳", dial: "216", len: 8, en: "Tunisia", ar: "تونس" },
  { iso: "MR", flag: "🇲🇷", dial: "222", len: 8, en: "Mauritania", ar: "موريتانيا" },
  // Europe + common international
  { iso: "GB", flag: "🇬🇧", dial: "44", len: 10, en: "United Kingdom", ar: "المملكة المتحدة" },
  { iso: "FR", flag: "🇫🇷", dial: "33", len: 9, en: "France", ar: "فرنسا" },
  { iso: "DE", flag: "🇩🇪", dial: "49", len: [10, 11], en: "Germany", ar: "ألمانيا" },
  { iso: "IT", flag: "🇮🇹", dial: "39", len: [9, 10], en: "Italy", ar: "إيطاليا" },
  { iso: "ES", flag: "🇪🇸", dial: "34", len: 9, en: "Spain", ar: "إسبانيا" },
  { iso: "NL", flag: "🇳🇱", dial: "31", len: 9, en: "Netherlands", ar: "هولندا" },
  { iso: "BE", flag: "🇧🇪", dial: "32", len: [8, 9], en: "Belgium", ar: "بلجيكا" },
  { iso: "CH", flag: "🇨🇭", dial: "41", len: 9, en: "Switzerland", ar: "سويسرا" },
  { iso: "SE", flag: "🇸🇪", dial: "46", len: [7, 9], en: "Sweden", ar: "السويد" },
  { iso: "TR", flag: "🇹🇷", dial: "90", len: 10, en: "Türkiye", ar: "تركيا" },
  { iso: "RU", flag: "🇷🇺", dial: "7", len: 10, en: "Russia", ar: "روسيا" },
  { iso: "US", flag: "🇺🇸", dial: "1", len: 10, en: "United States", ar: "الولايات المتحدة" },
  { iso: "IN", flag: "🇮🇳", dial: "91", len: 10, en: "India", ar: "الهند" },
  { iso: "PK", flag: "🇵🇰", dial: "92", len: 10, en: "Pakistan", ar: "باكستان" },
]

export const PHONE_DEFAULT_ISO = "SA"

/** Convert Arabic-Indic / Persian digits to Latin and keep digits only. */
export function toLatinDigits(raw: string): string {
  let out = ""
  for (const ch of raw ?? "") {
    const a = "٠١٢٣٤٥٦٧٨٩".indexOf(ch)
    const p = "۰۱۲۳۴۵۶۷۸۹".indexOf(ch)
    if (a >= 0) out += a
    else if (p >= 0) out += p
    else if (ch >= "0" && ch <= "9") out += ch
  }
  return out
}

export function findCountryByIso(iso?: string | null): Country | undefined {
  return COUNTRIES.find((c) => c.iso === iso)
}

/** Longest dial-code prefix that matches the given digit string. */
export function findCountryByDial(digits: string): Country | undefined {
  const d = toLatinDigits(digits)
  let best: Country | undefined
  for (const c of COUNTRIES) {
    if (d.startsWith(c.dial) && (!best || c.dial.length > best.dial.length)) best = c
  }
  return best
}

/** Map a free-text country ("Saudi Arabia" / "السعودية" / "SA") to an ISO. */
export function isoForCountryName(name?: string | null): string | undefined {
  if (!name) return undefined
  const key = name.trim().toLowerCase()
  return COUNTRIES.find(
    (c) =>
      c.en.toLowerCase() === key ||
      c.ar === name.trim() ||
      c.iso.toLowerCase() === key,
  )?.iso
}

export function phoneLens(c: Country): number[] {
  return Array.isArray(c.len) ? c.len : [c.len]
}

export function phoneDigitsValid(c: Country, digits: string): boolean {
  return phoneLens(c).includes(toLatinDigits(digits).length)
}

/** "9" for a fixed length, "7–8" for a range — used in the error message. */
export function phoneLenLabel(c: Country): string {
  const lens = phoneLens(c)
  return lens.length === 1
    ? String(lens[0])
    : `${Math.min(...lens)}–${Math.max(...lens)}`
}

/** tel: href value, e.g. `+919148869914`. */
export function formatPhoneTel(
  phone: string | null | undefined,
  country?: string | null,
): string {
  if (!phone?.trim()) return ""
  const raw = phone.trim()
  if (raw.startsWith("+")) {
    return `+${digitsOnly(raw.slice(1))}`
  }
  const dial = dialForCountry(country)
  let local = digitsOnly(raw)
  if (local.length > 10 && local.startsWith(dial)) {
    local = local.slice(dial.length)
  }
  return `+${dial}${local}`
}

// ── libphonenumber-js-backed validation (real per-country format checks) ──

/** All-same-digit junk (1111111111) is a structurally valid number for many
 *  countries, so libphonenumber accepts it - reject it explicitly. */
function looksFake(digits: string): boolean {
  return /^(\d)\1+$/.test(digits)
}

/** True per-country validity: libphonenumber-js pattern + length check, plus a
 *  junk guard. `iso` is a 2-letter country code; `digits` the national number
 *  (Arabic-Indic digits and any formatting are tolerated). */
export function phoneValid(iso: string, digits: string): boolean {
  const d = toLatinDigits(digits)
  if (!d || looksFake(d)) return false
  try {
    return isValidPhoneNumber(d, iso as CountryCode)
  } catch {
    return false
  }
}

/** Length verdict while typing, so the UI knows WHEN to show the error:
 *  too-long is flagged immediately, too-short only once they stop / fill up. */
export function phoneLenStatus(
  iso: string,
  digits: string,
): "empty" | "short" | "long" | "ok" {
  const d = toLatinDigits(digits)
  if (!d) return "empty"
  let verdict: string | undefined
  try {
    verdict = validatePhoneNumberLength(d, iso as CountryCode)
  } catch {
    return "ok"
  }
  if (verdict === "TOO_SHORT") return "short"
  if (verdict === "TOO_LONG" || verdict === "INVALID_LENGTH") return "long"
  return "ok"
}

/** As-you-type national grouping, e.g. "50 123 4567". */
export function formatNational(iso: string, digits: string): string {
  const d = toLatinDigits(digits)
  if (!d) return ""
  try {
    return new AsYouType(iso as CountryCode).input(d)
  } catch {
    return d
  }
}

/** Canonical E.164 for storage (strips the national trunk 0); falls back to a
 *  best-effort +dial+digits when the number can't be parsed. */
export function toE164(iso: string, digits: string): string {
  const d = toLatinDigits(digits)
  if (!d) return ""
  try {
    const parsed = parsePhoneNumber(d, iso as CountryCode)
    if (parsed?.number) return parsed.number
  } catch {
    /* fall through */
  }
  const c = findCountryByIso(iso)
  return c ? `+${c.dial}${d}` : `+${d}`
}
