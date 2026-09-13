/** Tax-ID (VAT / registration number) validation, scoped to rules we're sure of.
 *  Unknown countries accept anything (a wrong rule that blocks a legitimate save
 *  is worse than a lenient one). */

import { toLatinDigits } from "./phone"

// Countries whose tax IDs are purely numeric - letters/symbols are rejected.
const NUMERIC_TAX = new Set([
  "Saudi Arabia",
  "Yemen",
  "United Arab Emirates",
  "Egypt",
])

/** Whether this country's tax ID is digits-only (so the input can strip letters). */
export function isNumericTaxCountry(country?: string | null): boolean {
  return NUMERIC_TAX.has(country ?? "")
}

/** true = valid (or no rule to apply). An empty value is treated as valid here;
 *  "required" is enforced separately by the form. */
export function taxIdValid(country: string | null | undefined, raw: string): boolean {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return true
  const c = country ?? ""
  if (c === "Saudi Arabia") {
    // Saudi VAT number: 15 digits, starting and ending with 3
    return /^3\d{13}3$/.test(toLatinDigits(trimmed))
  }
  if (NUMERIC_TAX.has(c)) {
    // numeric tax IDs: Latin or Arabic-Indic digits only, nothing else
    return /^[0-9٠-٩۰-۹]+$/.test(trimmed)
  }
  return true
}

/** A short hint of what's expected, for the inline error (component-inline i18n). */
export function taxIdHint(country: string | null | undefined, lang: string): string {
  const c = country ?? ""
  if (c === "Saudi Arabia")
    return lang === "ar"
      ? "الرقم الضريبي السعودي: ١٥ رقمًا يبدأ وينتهي بالرقم ٣"
      : "Saudi VAT: 15 digits, starting and ending with 3"
  if (NUMERIC_TAX.has(c))
    return lang === "ar" ? "أرقام فقط" : "digits only"
  return ""
}
