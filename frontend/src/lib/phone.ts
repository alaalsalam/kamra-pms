/** Format property/host phone numbers for guest-facing pages.
 *  Always include an international dial code so guests can tap-to-call. */

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
