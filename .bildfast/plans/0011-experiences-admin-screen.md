<!-- bildfast:plan id=0011 status=approved agent=bildfast-frontend task="Add an admin management screen for Experiences (activities/add-ons) so the hotel can add/edit them" -->
# Plan: Experiences (activities) admin management screen

## Overview
On the guest booking page the owner saw the "Add experiences" (النشاطات/التجارب) add-ons but had
**nowhere in the app to add or edit them** ("من الذي يضيف النشاطات… لا توجد حقول الإضافة"). The
`Experience` doctype and the guest-facing display already existed (10 seeded experiences), but there
was **no admin CRUD screen** — so no one could manage them from the UI. This adds that screen and its
booking-page linkage.

## Plan
`@bildfast-frontend`: add a property-scoped admin screen for the `Experience` doctype reusing the
existing `ResourceScreen` + `ScreenConfig` pattern (like Meal Plans / Vouchers / Venues) — **no backend
change** (the doctype already grants create/write to Hotel Admin, Revenue Manager, System Manager), and
**no protected auth-boundary file touched**.

## Execution Note
Done + built + **auth-isolation suite passed** + verified live. Boundary-compliant.

**Files changed (all non-protected):**
- `frontend/src/screens/experienceCells.tsx` — NEW: JSX cell renderers (`<bdi dir=ltr>` price with
  "On request" at 0; "On booking page"/"Hidden" badge; "Active"/"Disabled" badge) — mirrors the
  existing `reservationCells.tsx` precedent (configs.ts is plain `.ts`).
- `frontend/src/screens/configs.ts` — `experiencesConfig`: columns (Name, Category badge, Price, On
  booking page, Status) + a create/edit form with all 9 fields (name, category, price, gst_rate,
  duration, description, image_url, show_on_booking_page, disabled); `propertyScoped: true`; category
  quick-filter + search; onboarding empty state.
- `frontend/src/App.tsx` — `<Route path="experiences" element={<ResourceScreen config={experiencesConfig}/>} />`.
- `frontend/src/lib/apps.ts` — nav item `{ to: "/experiences", label: "Experiences", icon: MapPin }` in
  the **revenue** module (roles: Revenue Manager, Hotel Admin, System Manager, Administrator — matching
  the doctype's DocPerms). RBAC flows automatically through `canAccessPath`/`visibleApps`.
- `frontend/src/lib/translations/ar.ts` — added AR keys (`Experiences`→التجارب, plus Experience name /
  Duration / Image URL / Show on the booking page / On booking page / Hidden / On request / Spa / Tour /
  Dining / Transport / empty-state strings); grepped first to avoid duplicates.

**The "linking" the owner asked for:** the form's **`show_on_booking_page`** check (+ the property Link)
is the integration — enabling it makes the experience appear in that property's guest "Add experiences"
section automatically (the guest display already reads Experiences filtered by property + this flag).

**Boundary compliance (bc35cb7):** none of the seven locked files were modified (verified via
`git status`); no new `api.ts` function (reuses the generic doctype CRUD). Ran the **full
auth-isolation e2e suite → 5 passed** before committing, per the auth-boundary directive.

**Live verification** (logged in as `revenue@hotelpms.local` — Revenue Manager, AR, 1280): `/experiences`
renders the 10 experiences with SAR prices, category badges, "On booking page" + "Active" badges, a
"New" button, and category filter/search; **"التجارب" appears in the Revenue sidebar** (RBAC-gated — no
login redirect). Screenshot: `verify-experiences-admin-screen-ar.png`.

**Note:** Only Hotel Admin / Revenue Manager / System Manager see this screen (Front Desk does not) —
matching the Experience doctype's permissions. Say the word if you want Front Desk to manage them too
(that's a backend DocPerm change).
