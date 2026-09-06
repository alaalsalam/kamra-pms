<!-- bildfast:plan id=0006 status=approved agent=bildfast-frontend task="Fix guest browse→book: availability result step, in-sheet services, no auto-charged meal plan, AR i18n" -->
# Plan: Guest browse → book flow — radical ease-of-use fix

## Overview
Two guest-facing defects on the public listing page `/stay/:slug` (`PublicListing.tsx`):

1. **Permission error on booking** (Arabic report B): "لا يملك المستخدم Guest حق الوصول إلى النمط…". The
   public `book()` computed its pricing quote while still running as the anonymous **Guest** user; the
   moment a meal plan was included, `pricing.quote` read config doctypes (Room Type / Meal Plan / Rate
   Plan / Property) that Guest cannot access → `frappe.PermissionError`.

2. **"Next step doesn't appear"** (Arabic report C): after pressing "Check availability" the guest saw
   nothing actionable — for sold-out dates `search_stay` returns `{rooms_left:0, quote:null}` and the
   book button was silently disabled with no message; there was also **no way to browse rooms + services
   to complete the booking**. The user asked for a *radical* modification to ease the guest experience.

**Constraint:** no change to pricing/availability/VAT/ledger/RBAC beyond the minimal permission fix,
which is covered by a focused regression test. No demo records left in the live DB.

## Plan
- `@bildfast-backend` (`hotelpms/public_api.py`, `hotelpms/tests/test_public_booking.py`): wrap the
  pre-insert pricing quote in `book()` in the governed booking-agent context (already used for the write)
  so Guest never hits a permission wall; add a `FrappeTestCase` guarding a Guest booking **with a meal
  plan**. (Committed earlier this session, `820b0d5`.)
- `@bildfast-frontend` (`frontend/src/screens/PublicListing.tsx`, `frontend/src/lib/translations/ar.ts`):
  add an explicit availability-result step (available / sold-out / error-with-retry / checking) and move
  the full **services** picker (meal plan + add-ons/experiences + special requests + estimated total)
  into the booking sheet; stop auto-selecting a paid meal plan; complete Arabic i18n.

## Execution Note
Done + built (`bench build --app hotelpms`, tsc clean) + verified **live as Guest** on the real site
(`hotelpms.yemenfrappe.com`, property "نون هوتيل", listing `standard`) at **390 + 1024**, **AR and EN**.

**Backend (permission fix + test).** `book()` now runs `price_quote(...)` + `_advance_terms(...)` under
`frappe.set_user("agent@hotelpms.local")` with a `finally: set_user("Guest")`, so quoting config doctypes
no longer trips Guest permissions. Regression test
`test_guest_booking_with_meal_plan_is_not_a_permission_error` books as Guest with a meal plan and asserts
no `PermissionError` + a reservation returned. Reproduced the original 403 and confirmed 200 after the fix.

**Frontend — availability result step.** After "Check availability" the single-listing rail now always
shows the next step in `#avail-result`: **available** → emerald "Available for your dates" + price (`<bdi
dir=ltr>` amount · `qty()` nights · taxes in) + a prominent gold **Book** button; **sold-out** → amber
"No rooms available for these dates" + "try different dates"; **error** → rose panel + "Try again";
**checking** → spinner. Auto-searches on load and re-searches (300 ms debounce) on any date/occupancy
change, so the result never goes stale.

**Frontend — in-sheet services.** The booking sheet gained a **meal-plan** selector (a free "No meal plan"
option + each plan with `+<amount> per adult / night`), an **add-ons/experiences** list with −/+ qty
steppers (taxes-in unit price; hidden when the property publishes none — this property has 0), a **special
requests** textarea, and an **estimated total** panel (room quote + meals + add-ons, "final total
confirmed at booking"). `submitBooking` now sends `meal_plan`, `special_requests`, and
`addons:[{experience,qty}]`; sheet close resets those booking-specific fields.

**Fixed while verifying (advisor pass):** (a) removed the auto-select of `meal_plans[0]` that silently
opted the guest into a **paid** "Room Only" plan (est. was ₹5,650; now ₹5,250 room-only until the guest
opts in); (b) gated the estimate panel on a real room quote so it can't understate a total; (c)
`<bdi dir=ltr>`-wrapped the confirmation "Total"; (d) reset add-ons on close.

**i18n.** Added Arabic keys for all new booking-flow strings **and** pre-existing English leaks on the
guest page (Back to property, Where you'll be, Host & caretaker, Coordinated by, the call-caretaker line,
Up to N guests). Counted nouns use `qty()` (single translatable node); amounts stay `<bdi dir=ltr>`.

**Live end-to-end + cleanup.** Did one real Guest booking via the public HTTP endpoint (Breakfast plan +
special request, no email) → **200**, `RES-2026-01634`, amount ₹6,510 (5000 room + 1200 breakfast + 310
tax = correct), `special_requests` + `meal_plan` stored. Then **deleted** the reservation + its security
deposit + the guest; **counts verified back to baseline** (Reservation/Guest/Security Deposit/Folio all
1→1, `RES-2026-01634` gone). No residual demo data.

**Known data (not code) issue, re-flagged:** the property shows the **₹** symbol instead of SAR (﷼) —
its currency/country is unset in Property config; a settings fix for the owner, out of scope here.
