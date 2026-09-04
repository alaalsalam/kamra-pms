/** Interface direction / language. Arabic runs right-to-left; everything
 * else left-to-right. Stored per device (like the theme) and applied to the
 * document so the whole UI - staff app, phone apps and the booking page -
 * flips together. */

export type Lang = "en" | "ar"

const KEY = "hotelpms-lang"

export const getLang = (): Lang => {
  const stored = localStorage.getItem(KEY)
  if (stored === "ar" || stored === "en") return stored
  // HotelPMS is presented to the Saudi market first. New devices start in
  // Arabic; the language switch remains persistent for guests who choose EN.
  return "ar"
}

export function applyLang(l: Lang) {
  const el = document.documentElement
  el.setAttribute("lang", l)
  el.setAttribute("dir", l === "ar" ? "rtl" : "ltr")
}

export function setLang(l: Lang) {
  localStorage.setItem(KEY, l)
  applyLang(l)
  // let listeners (React trees) re-render with the new direction/strings
  window.dispatchEvent(new Event("hotelpms:lang"))
}

/** Call once at boot. */
export function initLang() {
  applyLang(getLang())
}

const isArabic = (s: string) => /[؀-ۿ]/.test(s)

/** A stored bilingual label is written "عربي | English". For a plain-text
 * context that can't hold markup (a native <option>, a title tooltip), pick
 * the side that matches the current UI language, falling back to the other. */
export function primaryLabel(value: string): string {
  const parts = (value || "").split("|").map((s) => s.trim()).filter(Boolean)
  const ar = parts.find(isArabic)
  const en = parts.find((s) => !isArabic(s))
  return (getLang() === "ar" ? ar ?? en : en ?? ar) ?? value
}
