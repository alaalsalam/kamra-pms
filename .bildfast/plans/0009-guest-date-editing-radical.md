<!-- bildfast:plan id=0009 status=approved agent=bildfast-frontend task="Radically fix guest date editing: fetch boundary skips invalid ranges, never mutates the inputs" -->
# Plan: Guest date editing — the real root cause (fetch boundary must never touch the inputs)

## Overview
Despite 0008, the user still could not edit the date — day, month **or year** all reverted:
"عندما اقوم بتغير التاريخ تتغير تلقائيا بنفس التاريخ الي كان". Root cause found: a native
`<input type="date">` reports a **complete intermediate value on every digit**, and typing a
multi-digit segment (a 4-digit year, a 2-digit day) takes **longer than the 300 ms search debounce**.
So while the guest was still typing, the debounced `fetchResults` fired on a transient *past* value
(e.g. typing "2028" passes through year `0002` → `0020` → `0202`), and 0008's `setSearch(clean)`
correction snapped the field back — every digit reverted. Same transient-past values would also have
triggered a catastrophic ~2000-year `search_stay` if searched.

## Plan
`@bildfast-frontend` (`PublicListing.tsx`, `PublicBooking.tsx`): the fetch boundary must **never
mutate the date inputs**. It only *skips* the search for a non-bookable range and shows an inline hint;
the inputs stay 100 % under the guest's control.

## Execution Note
Done + built + **verified live with real keyboard typing**. This removes the `setSearch(clean)`
correction that 0008 added in `e999959` (it was the revert). The init sanitize + garbage guard + URL
self-heal from 0007, and the non-clamping onChange handlers from 0008, all stay.

**What changed:**
- **`fetchResults()` never calls `setSearch`.** It now just returns early when the range isn't
  bookable — `check_in < today || check_out <= check_in` — so transient past/inverted values (mid-edit)
  and a real inverted range are skipped without a search, and the huge-range `search_stay` can't fire.
- **`rangeValid`** (`check_in ≥ today && check_out > check_in`) drives the UI: when false, the result
  panel shows a gentle amber **"Check your dates / Check-out must be after check-in, and check-in today
  or later."** hint, the nights line shows "—", and "Check availability" is disabled — instead of a
  scary error or a reverted field.
- The date inputs are now the single source of truth; `search` is mutated **only** by the user's own
  onChange handlers (grep-confirmed — no fetch-path writer). Check-in keeps its check-out auto-bump
  (adjusts the *other* field only), so extending a stay stays valid automatically.
- Same change in `PublicBooking.tsx` (`/book`).

**Live verification** (`hotelpms.yemenfrappe.com`, listing `standard`, 390 AR — the user's context;
**real `page.keyboard` key events**, not synthetic complete values):
1. Typed a transient past value on check-in and **waited past the debounce → no revert** (old bug
   snapped to today); the "Check your dates" hint showed and focus was retained.
2. Retyped the **entire** date digit-by-digit — month `09→12`, day `07→25`, year `2026→2028` (through
   transient years `0002/0020/0202`) — **every digit stuck, nothing reverted**, check-out auto-followed,
   and once valid the search ran for **Dec 25–27 2028 → available**, no error, URL self-healed.
3. Made check-out earlier than check-in (inverted): the field **held the typed value** (no revert), the
   hint showed, the book button/"Check availability" disabled, **no error, no catastrophic search**.
4. Regression: the 0007 inverted/past URL still sanitizes at mount; garbage URL still no-crash.

**Accepted trade-off:** the sticky price keeps showing the last valid quote as a reference while the
range is mid-edit/invalid; the prominent hint + disabled button + red field outline make the state
clear. Not chased further to avoid churn.

**Scope note:** `/book` redirects to `/stay/standard` on this single-listing property, so PublicBooking
isn't the live path here — its identical fix is tsc + build-verified.

**Known gap (named, not chased):** the amber "Check your dates" hint + disabled button render only on
the single-listing path (`!isSite && primary`). On the multi-listing **site** path (and on `/book`) an
invalid range is a *silent* fetch-boundary no-op — no hint, and the site "Check availability" button
stays enabled (it just doesn't search). Neither is this property's live path; left as-is to avoid churn.
