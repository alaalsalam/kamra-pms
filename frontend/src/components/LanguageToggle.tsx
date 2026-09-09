import { useLocation } from "react-router-dom"

import UtilityControls from "./UtilityControls"

/** Floating language + theme controls, shown only on public surfaces that
 *  don't host the inline <UtilityControls> in their own header. The booking,
 *  listing, self check-in and QR-menu pages carry <PublicHeader> (which has
 *  the control); the HK phone app doesn't, so it keeps this fallback. */
const FALLBACK_PREFIXES = ["/hk"]

export default function LanguageToggle() {
  const { pathname } = useLocation()
  const show = FALLBACK_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  )
  if (!show) return null

  return (
    <div className="fixed bottom-[4.75rem] end-3 z-[100] rounded-full border border-zinc-200 bg-white/95 px-1.5 py-1 shadow-lg dark:border-zinc-200 dark:bg-zinc-100">
      <UtilityControls tone="light" />
    </div>
  )
}
