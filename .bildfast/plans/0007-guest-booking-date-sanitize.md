<!-- bildfast:plan id=0007 status=approved agent=bildfast-frontend task="Sanitize guest booking dates: no inverted/past/garbage ranges, self-healing URL" -->
# Plan: Guest booking — robust date handling (no inverted/past/garbage ranges)

## Overview
The user opened `/stay/standard/2026-06-08/2026-06-04/2/0` — a **check-out before check-in**
range (and both dates in the past) — and saw a scary generic error "تعذّر التحقق من التوفر الآن"
(couldn't check availability). Root cause: the backend `search_stay` **correctly** rejects an
invalid range (`frappe.throw("Check-out must be after check-in")`), but the frontend copied the raw
URL date params straight into state with **no validation**, so an inverted / past / malformed link
(or a bad picker edit the app itself could mint) produced a dead-end error instead of availability.

## Plan
`@bildfast-frontend` (`frontend/src/screens/PublicListing.tsx`, `frontend/src/screens/PublicBooking.tsx`):
add a `sanitizeStay()` guard for the URL-derived stay and clamp the date inputs so an invalid range
is impossible; no backend change (its validation is right — the UI just must never send it a bad range).

## Execution Note
Done + built + **verified live** on the real site at the user's exact URL. **Backend untouched.**

**`sanitizeStay()` (both public pages).** Coerces the raw `:checkin/:checkout/:adults/:children`
params into a bookable stay: check-in never before today; check-out strictly after check-in (default
+2-night gap — also satisfies this property's 2-night minimum); adults ≥ 1, children ≥ 0. A new
`isValidDate()` (`/^\d{4}-\d{2}-\d{2}$/` **and** `!Number.isNaN(new Date(x).getTime())`) rejects junk
before any date math, so `new Date("garbage").toISOString()` can never throw a white screen (regex
alone would let `2026-13-45` through — the `isNaN` check catches it).

**Both writers guarded, not just the initializer.** The user's populated stale quote proved the bad
URL was minted *mid-session*: the check-out `onChange` wrote `e.target.value` unvalidated (typed dates
bypass the `min` attribute), then the URL-sync effect published the inverted URL. Now the check-out
`onChange` clamps to `check_in + minNights` when the value is ≤ check-in, and the check-in `onChange`
falls back to today on an empty/past/invalid value (also fixing an `addDays("")` crash when the picker
is cleared).

**URL self-heals.** Added `resolved` to PublicListing's URL-sync effect deps so it re-fires after the
slug resolves and rewrites the address bar to the canonical valid range (it previously early-returned
on `!resolved` and never re-ran). PublicBooking's effect already runs unconditionally.

**Stale-price-beside-error fixed.** On a search error `fetchResults` now also clears `results`, so a
prior quote can't sit next to the error panel (the panel already shows a fixed generic string, never
the raw server "Check-out must be after check-in" text).

**Live verification** (`hotelpms.yemenfrappe.com`, listing `standard`, 390 AR — the user's context):
- The exact reported URL `…/2026-06-08/2026-06-04/2/0` → inputs clamp to **2026-09-06 → 2026-09-08**,
  **no error**, honest sold-out verdict for those near-term dates; URL self-heals to the valid range.
- Mid-session: setting check-out `2026-09-04` (before check-in) via a real React change event →
  clamped to **2026-09-08**, never inverted, no error.
- Garbage URL `…/garbage/2026-13-45/-3/xyz` → **no crash**, defaults to 2026-09-07 → 2026-09-09,
  adults 1, children 0; URL self-heals.

**Scope note:** on this single-listing property `/book` redirects to `/stay/standard`, so PublicBooking
isn't the live path here — its identical fix is tsc + build-verified, mirroring the live-verified
PublicListing change (same as the meal-plan mirror in plan 0006).
