<!-- bildfast:plan id=0008 status=approved agent=bildfast-frontend task="Make guest booking date fields editable again (move range enforcement to the fetch boundary)" -->
# Plan: Guest booking — date fields editable again

## Overview
Regression from plan 0007: the user reported "لا أستطيع التعديل على التاريخ" (I can't edit the
date). 0007 added per-keystroke clamps to the check-in / check-out `onChange` handlers. But a native
`<input type="date">` fires a **complete intermediate value on every segment edit**, so when check-in
equals today, typing the first digit of a new day (e.g. "2" → `2026-09-02`) produces a transient
*past* date that the clamp snapped straight back to today — the field reset on almost every keystroke,
so the user could not type a later date. The inverted-checkout clamp had the same flaw.

## Plan
`@bildfast-frontend` (`PublicListing.tsx`, `PublicBooking.tsx`): move range enforcement off the
keystroke and onto the **fetch boundary** — the date inputs accept whatever the user types; validity
is enforced (and the inputs corrected) just before the debounced search. No backend change.

## Execution Note
Done + built + **verified live**. This **reverts the per-keystroke clamps added in 0007 (`5af1644`)**
— that enforcement point was wrong; the init sanitize + garbage guard + URL self-heal from 0007 stay.

**What changed:**
- **Date `onChange` handlers** now only set the typed value (with an `if (!v) return` empty-guard that
  preserves the `addDays("")` crash fix). Check-in keeps its check-out auto-bump — that only adjusts
  the *other* field, so it never fights the field being edited. Removed the `v > today` (check-in) and
  `v > check_in` (check-out) clamps that fought native date editing.
- **`fetchResults()` enforces the range at the fetch boundary:** it runs `sanitizeStay()` on the
  current dates; if they're invalid (past check-in / inverted), it corrects state and returns, letting
  the resulting re-render re-search with the clean range. `search_stay` is the single funnel (all
  callers — button, mount effect, debounced effect, retry — go through `fetchResults`), so the backend
  never receives an invalid range and the "check-out must be after check-in" error stays unreachable.
- Same change applied to `PublicBooking.tsx` (`/book`) — it had the same clamps ported in `5af1644`.

**Trade-off (accepted):** if a user *pauses >300 ms mid-edit on an invalid transient*, the debounced
fetch corrects it once — "occasionally self-corrects," not "can't edit." Deliberately not chased with
`onBlur`/`activeElement` machinery (adds stale-panel holes for a rare case).

**Live verification** (`hotelpms.yemenfrappe.com`, listing `standard`, 390 AR — the user's context;
simulated with real React change events):
1. **The exact repro that failed:** fire `2026-09-02` on check-in → field **keeps `09-02`** (no snap)
   → fire `2026-09-20` → sticks; ~900 ms later a valid search ran for **09-20 → 09-22** (checkout
   auto-bumped), available, no error, URL self-healed. ✅
2. **Abandoned inverted checkout:** set check-out `2026-09-02` (before check-in `09-20`) → briefly held,
   then auto-corrected to `09-22`, valid search, **no error panel**, URL rewritten. ✅
3. **0007 regression:** reloading `/stay/standard/2026-06-08/2026-06-04/2/0` still sanitizes to
   `2026-09-06 → 2026-09-08`, no error, no crash. ✅

**Scope note:** `/book` redirects to `/stay/standard` on this single-listing property, so PublicBooking
isn't the live path here — its identical fix is tsc + build-verified, mirroring the live-verified
PublicListing change.
