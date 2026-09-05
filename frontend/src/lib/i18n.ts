import { createElement, Fragment, useEffect, useState, type ReactNode } from "react"
import { getLang, type Lang } from "./dir"
import { AR } from "./translations/ar"

const DICT: Record<Lang, Record<string, string>> = { en: {}, ar: AR }

/**
 * Look up a UI string without ever making English rendering dependent on the
 * translation catalogue. The product is deliberately English-first and every
 * missing Arabic entry falls back to the original source string.
 */
function lookup(source: string, lang: Lang): string {
  if (lang === "en") return source
  return DICT[lang][source] ?? source
}

const UNIT: Record<string, string> = {
  arrival: "وصول",
  arrivals: "حالات وصول",
  adult: "بالغ",
  adults: "بالغون",
  booking: "حجز",
  bookings: "حجوزات",
  child: "طفل",
  children: "أطفال",
  departure: "مغادرة",
  departures: "حالات مغادرة",
  day: "يوم",
  days: "أيام",
  dish: "طبق",
  dishes: "أطباق",
  function: "فعالية",
  functions: "فعاليات",
  guest: "ضيف",
  guests: "ضيوف",
  hall: "قاعة",
  halls: "قاعات",
  invoice: "فاتورة",
  invoices: "فواتير",
  item: "صنف",
  items: "أصناف",
  night: "ليلة",
  nights: "ليالٍ",
  order: "طلب",
  orders: "طلبات",
  pax: "شخص",
  payment: "دفعة",
  payments: "دفعات",
  request: "طلب",
  requests: "طلبات",
  reservation: "حجز",
  reservations: "حجوزات",
  room: "غرفة",
  rooms: "غرف",
  seat: "مقعد",
  seats: "مقاعد",
  row: "صف",
  rows: "صفوف",
  stay: "إقامة",
  stays: "إقامات",
  table: "طاولة",
  tables: "طاولات",
  task: "مهمة",
  tasks: "مهام",
  ticket: "تذكرة",
  tickets: "تذاكر",
  property: "منشأة",
  properties: "منشآت",
}

function translateCore(source: string, lang: Lang): string {
  const direct = lookup(source, lang)
  if (direct !== source || lang === "en") return direct

  // Dynamic counters are common throughout the operational screens.
  const count = source.match(/^(\d+(?:[.,]\d+)?)\s+([A-Za-z]+)$/)
  if (count) {
    const unit = UNIT[count[2].toLowerCase()]
    if (unit) return `${count[1]} ${unit}`
  }

  const showing = source.match(/^Showing\s+(\d+)\s+of\s+(\d+)$/i)
  if (showing) return `عرض ${showing[1]} من ${showing[2]}`

  const ofTotal = source.match(/^(\d+)\s+of\s+(\d+)\s+([A-Za-z]+)$/i)
  if (ofTotal) {
    const unit = UNIT[ofTotal[3].toLowerCase()]
    if (unit) return `${ofTotal[1]} من ${ofTotal[2]} ${unit}`
  }

  const inDays = source.match(/^In\s+(\d+)\s+days?$/i)
  if (inDays) return `خلال ${inDays[1]} أيام`

  const labelledCount = source.match(/^(.+?)\s+\((\d+)\)$/)
  if (labelledCount) {
    const label = lookup(labelledCount[1], lang)
    if (label !== labelledCount[1]) return `${label} (${labelledCount[2]})`
  }

  const prefixed = source.match(/^([·:,])\s*(.+)$/)
  if (prefixed) {
    const rest = lookup(prefixed[2], lang)
    if (rest !== prefixed[2]) return `${prefixed[1]} ${rest}`
  }

  const room = source.match(/^Room\s+(.+)$/i)
  if (room) return `غرفة ${room[1]}`

  const left = source.match(/^(\d+)\s+left$/i)
  if (left) return `متبقي ${left[1]}`

  // Translate composable labels such as "Room · 201 · Clean" while keeping
  // names, amounts and dates untouched. This also handles live API values.
  for (const separator of [" · ", " — ", ": "]) {
    if (!source.includes(separator)) continue
    let changed = false
    const translated = source
      .split(separator)
      .map((part) => {
        const next = lookup(part, lang)
        if (next !== part) changed = true
        return next
      })
      .join(separator)
    if (changed) return translated
  }

  const qualified = source.match(/^(.+?)\s+\((optional|required)\)$/i)
  if (qualified) {
    const base = lookup(qualified[1], lang)
    const qualifier = qualified[2].toLowerCase() === "optional" ? "اختياري" : "مطلوب"
    if (base !== qualified[1]) return `${base} (${qualifier})`
  }

  return source
}

/** Translate text while preserving JSX whitespace and punctuation. */
export function translateText(source: string, lang: Lang = getLang()): string {
  if (lang === "en" || !source.trim()) return source
  const leading = source.match(/^\s*/)?.[0] ?? ""
  const trailing = source.match(/\s*$/)?.[0] ?? ""
  const core = source.slice(leading.length, source.length - trailing.length)
  let translated = translateCore(core, lang)

  if (translated === core) {
    const punctuated = core.match(/^(.+?)([.…,:;!?])$/)
    if (punctuated) {
      const base = translateCore(punctuated[1], lang)
      if (base !== punctuated[1]) translated = `${base}${punctuated[2]}`
    }
  }
  return `${leading}${translated}${trailing}`
}

/** Translate an English string for the current language. */
export function t(source: string): string {
  return translateText(source)
}

/**
 * Render a counted noun as a single "<n> <noun>" token (e.g. `qty(2, "night")`
 * → "2 nights"). Keeping the number and word in one text node lets the live
 * translator localise it via the UNIT map — splitting the plural letter into
 * its own node used to leave a stray "s" in the Arabic UI.
 */
export function qty(n: number, singular: string, plural = singular + "s"): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * Interpolate a *translated* template that contains `{name}` placeholders,
 * returning ReactNode[] so a compound sentence stays translatable as ONE
 * dictionary key (correct Arabic grammar/word-order) while each substituted
 * value is bidi-isolated. Pass an already-wrapped node (e.g. a guest name that
 * may be Arabic) to keep its own direction; bare strings/numbers — dates,
 * refs, amounts — are wrapped `<bdi dir="ltr">` so they read correctly inside
 * an RTL sentence. Usage: `fill(t("… {ref} … {ci} to {co} …"), { ref, ci, co })`.
 */
export function fill(
  template: string,
  values: Record<string, ReactNode>,
): ReactNode[] {
  return template.split(/(\{[a-zA-Z0-9_]+\})/).map((part, i) => {
    const m = /^\{([a-zA-Z0-9_]+)\}$/.exec(part)
    if (!m) return part
    const v = values[m[1]]
    if (typeof v === "string" || typeof v === "number")
      return createElement("bdi", { key: i, dir: "ltr" }, v)
    return createElement(Fragment, { key: i }, v)
  })
}

/** Subscribe a component to language changes and return a bound translator. */
export function useT() {
  const [lang, setLanguage] = useState<Lang>(getLang())
  useEffect(() => {
    const onChange = () => setLanguage(getLang())
    window.addEventListener("hotelpms:lang", onChange)
    return () => window.removeEventListener("hotelpms:lang", onChange)
  }, [])
  return { lang, t: (source: string) => translateText(source, lang) }
}

type TextState = { source: string; output: string }
type AttributeState = Map<string, TextState>
const textStates = new WeakMap<Text, TextState>()
const attributeStates = new WeakMap<Element, AttributeState>()
const TRANSLATED_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const
const SKIP_SELECTOR = "script,style,code,pre,kbd,[data-no-translate]"

function localizeTextNode(node: Text, lang: Lang) {
  if (node.parentElement?.closest(SKIP_SELECTOR)) return
  const current = node.nodeValue ?? ""
  const previous = textStates.get(node)

  if (lang === "en") {
    if (previous && current === previous.output) node.nodeValue = previous.source
    textStates.delete(node)
    return
  }

  const source = previous && current === previous.output ? previous.source : current
  const output = translateText(source, lang)
  if (output !== source) {
    textStates.set(node, { source, output })
    if (current !== output) node.nodeValue = output
  } else if (previous) {
    textStates.delete(node)
  }
}

function localizeAttributes(element: Element, lang: Lang) {
  if (element.closest(SKIP_SELECTOR)) return
  let states = attributeStates.get(element)

  for (const name of TRANSLATED_ATTRIBUTES) {
    const current = element.getAttribute(name)
    if (current == null) continue
    const previous = states?.get(name)

    if (lang === "en") {
      if (previous && current === previous.output) element.setAttribute(name, previous.source)
      states?.delete(name)
      continue
    }

    const source = previous && current === previous.output ? previous.source : current
    const output = translateText(source, lang)
    if (output !== source) {
      states ??= new Map<string, TextState>()
      states.set(name, { source, output })
      if (current !== output) element.setAttribute(name, output)
    } else {
      states?.delete(name)
    }
  }

  if (states?.size) attributeStates.set(element, states)
  else attributeStates.delete(element)
}

function localizeSubtree(root: Node, lang: Lang = getLang()) {
  if (root instanceof Text) {
    localizeTextNode(root, lang)
    return
  }
  if (!(root instanceof Element || root instanceof DocumentFragment || root instanceof Document)) return

  if (root instanceof Element) localizeAttributes(root, lang)
  const elements = root.querySelectorAll?.("*") ?? []
  for (const element of elements) localizeAttributes(element, lang)

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) localizeTextNode(node as Text, lang)
}

let observer: MutationObserver | undefined

/**
 * Localize legacy and lazy-loaded React screens that predate the translation
 * hook. New components can use useT(); the observer keeps the entire shipped
 * product bilingual today, including API-provided status labels.
 */
export function initI18n() {
  if (observer) return
  const apply = () => localizeSubtree(document.documentElement)
  apply()
  observer = new MutationObserver((mutations) => {
    const lang = getLang()
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        localizeAttributes(mutation.target as Element, lang)
        continue
      }
      for (const node of mutation.addedNodes) localizeSubtree(node, lang)
      if (mutation.type === "characterData") localizeTextNode(mutation.target as Text, lang)
    }
  })
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATED_ATTRIBUTES],
  })
  window.addEventListener("hotelpms:lang", () => queueMicrotask(apply))
}
