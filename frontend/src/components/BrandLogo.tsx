import { useId } from "react"

import { cn } from "../lib/utils"

type Tone = "auto" | "light" | "dark"

/** The gold "H" mark, rendered inline so it scales crisply and never fetches
 *  a file. Same geometry as the static /assets/hotelpms/hotelpms-mark.svg. */
export function BrandMark({
  size = 32,
  className,
  title = "HotelPMS",
}: {
  size?: number
  className?: string
  title?: string
}) {
  const gid = useId()
  return (
    <svg
      viewBox="0 0 120 112"
      role="img"
      aria-label={title}
      style={{ width: size, height: size }}
      className={className}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0bf79" />
          <stop offset=".5" stopColor="#c9a24b" />
          <stop offset="1" stopColor="#a9822f" />
        </linearGradient>
      </defs>
      <g fill={`url(#${gid})`}>
        <path d="M60 6 L64.5 17.5 L76 22 L64.5 26.5 L60 38 L55.5 26.5 L44 22 L55.5 17.5 Z" />
        <rect x="20" y="40" width="15" height="54" rx="5" />
        <rect x="85" y="40" width="15" height="54" rx="5" />
        <rect x="30" y="61" width="60" height="12" rx="6" />
        <path d="M18 101 C42 93 78 93 102 101 C78 97 42 97 18 101 Z" />
      </g>
    </svg>
  )
}

/** Full lockup: gold mark + "Hotel PMS" wordmark (+ optional tagline).
 *  "Hotel" is a translatable node (→ "هوتل" in Arabic per the brand rule);
 *  "PMS" always stays Latin gold. `tone` picks the wordmark colour:
 *   - "auto"  navy on light / white on dark (default, for normal surfaces)
 *   - "dark"  white — for fixed navy chrome that stays navy in both themes
 *   - "light" navy  — for permanently light surfaces */
export function BrandLogo({
  size = 32,
  tone = "auto",
  showWordmark = true,
  tagline = false,
  className,
}: {
  size?: number
  tone?: Tone
  showWordmark?: boolean
  tagline?: boolean
  className?: string
}) {
  const wordTone =
    tone === "dark"
      ? "text-white"
      : tone === "light"
        ? "text-navy-900"
        : "text-navy-900 dark:text-white"
  const tagTone =
    tone === "dark"
      ? "text-navy-200"
      : tone === "light"
        ? "text-zinc-500"
        : "text-zinc-500 dark:text-navy-200"

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size} className="shrink-0" />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={cn("font-semibold tracking-tight", wordTone)}
            dir="ltr"
            translate="no"
            data-no-translate
          >
            <span style={{ fontSize: size * 0.62 }}>
              <span>Hotel</span>
              <span className="text-gold" data-no-translate>
                PMS
              </span>
            </span>
          </span>
          {tagline && (
            <span
              className={cn(
                "mt-1 text-[9px] font-medium uppercase tracking-[0.22em]",
                tagTone,
              )}
            >
              Hospitality Management System
            </span>
          )}
        </span>
      )}
    </span>
  )
}
