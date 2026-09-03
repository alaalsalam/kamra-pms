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
