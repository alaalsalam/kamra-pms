<!-- bildfast:plan id=0005 status=approved agent=bildfast-frontend task="Public booking page UX polish: mobile booking bar, map CTA, bilingual policies" -->
# Plan: Public booking page — UX/UI polish

## Overview
The user was viewing the guest-facing booking page (`/book/:checkin/:checkout/:adults/:children`) and
asked to "start executing, focused on the best UX/UI." The page is already polished and
conversion-critical, so this is targeted refinement — **no redesign, no booking/pricing-logic change,
navy #082B5C / gold #B8892E identity preserved.** Three concrete wins + one consistency fix.

## Plan
`@bildfast-frontend` (`frontend/src/screens/PublicBooking.tsx`):
1. **Sticky mobile booking bar** — on mobile/tablet the stay-summary rail is desktop-only, so after
   picking a room the guest had to scroll back up to continue. Add a fixed bottom bar (room + total +
   "Continue to book") that mirrors the rail and opens the same booking Sheet.
2. **Location map** — always surface a prominent "Open in Google Maps" button (was hidden whenever
   `google_maps_url` was null even though coordinates exist); make the embed robust (lazy + bg container).
3. **Bilingual policy/directions** — render house rules / pets / children / extra-bed / driving-directions
   through `<Bilingual>` (clean AR-primary + muted-EN hierarchy) instead of the raw "AR | EN" pipe.

## Execution Note
Done + built + verified live on **both viewports (390 / 1440) and both languages (AR/EN)**; 0 console errors.
- **Sticky mobile bar** — `fixed bottom-0 z-40 lg:hidden`, shown only when a room is available/selected
  **and** the booking Sheet is closed (`selRt && selRes?.quote && !booking`), with iOS safe-area padding and
  a matching `pb-24 lg:pb-0` on the page container so it never hides the footer. Reuses the rail's exact
  expressions (`selRt.room_type_name`, `selRes.quote.amount_after_tax`, `setBooking(selName)`). Verified:
  bar shows the default room + total, Continue opens the Sheet, bar hides while the Sheet is open (no
  z-fighting); hidden entirely on desktop (`display:none`, container `pb:0`), desktop rail intact, no overflow.
- **Map** — `loading="lazy"` + a `bg-zinc-100` container; the "Open in Google Maps" button now always renders
  from `google_maps_url ?? https://www.google.com/maps?q=<lat>,<lng>` (this property's `google_maps_url` is
  null but coords exist, so the escape hatch had been hidden). The embed itself renders fine once loaded.
- **Bilingual** — 5 policy/direction bodies wrapped in `<Bilingual>` (`whitespace-pre-line` preserved on both
  lines); no raw pipe left in that section. No new `ar.ts` keys needed (all strings pre-existing).
- No pricing/quote/booking-flow change; the public path creates real reservations so the create was **not**
  submitted during verification (Sheet opened + closed only).
