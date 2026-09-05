import { useId } from "react"

import { cn } from "../lib/utils"

type Tone = "auto" | "light" | "dark"

/** HotelPMS hospitality gateway, recoloured for the Oasis design system. */
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
      viewBox="0 0 128 128"
      role="img"
      aria-label={title}
      style={{ width: size, height: size }}
      className={className}
    >
      <defs>
        <linearGradient id={gid} x1="28" y1="22" x2="101" y2="107" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#efbd7f" />
          <stop offset=".52" stopColor="#e8963e" />
          <stop offset="1" stopColor="#b96a1f" />
        </linearGradient>
      </defs>
      <rect x="5" y="5" width="118" height="118" rx="30" fill="#073b34" />
      <rect x="7" y="7" width="114" height="114" rx="28" fill="none" stroke={`url(#${gid})`} strokeWidth="2" opacity=".72" />
      <path d="M29 96V58c0-15 14-27 35-36 21 9 35 21 35 36v38" fill="none" stroke={`url(#${gid})`} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M46 93V59M82 93V59M46 73H82" fill="none" stroke="#fcfcfa" strokeWidth="7" strokeLinecap="round" />
      <path d="M58 96V85c0-5 3-8 6-8s6 3 6 8v11" fill="none" stroke={`url(#${gid})`} strokeWidth="5" strokeLinecap="round" />
      <path d="M25 101c24-8 54-8 78 0" fill="none" stroke={`url(#${gid})`} strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

/** Full lockup: gateway + exact HotelPMS wordmark (+ optional tagline).
 *  HotelPMS always stays Latin and PMS carries the Oasis teal. `tone` picks the colour:
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
        ? "text-zinc-900"
        : "text-zinc-900 dark:text-white"
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
            className={cn("font-semibold tracking-[-0.04em]", wordTone)}
            dir="ltr"
            translate="no"
            data-no-translate
          >
            <span style={{ fontFamily: "'Alexandria Variable', sans-serif", fontSize: size * 0.58 }}>
              <span>Hotel</span>
              <span className="text-brand-600 dark:text-brand-700" data-no-translate>
                PMS
              </span>
            </span>
          </span>
          {tagline && (
            <span
              className={cn(
                "mt-1 text-[8px] font-semibold uppercase tracking-[0.18em]",
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
