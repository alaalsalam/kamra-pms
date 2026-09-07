<!-- bildfast:plan id=0014 status=approved agent=bildfast-frontend task="Oasis round-3 comprehensive redesign" -->
# Plan: Oasis UI v2 — Round-3 comprehensive redesign (autonomous execution loop)

## Overview
Long-running autonomous redesign to bring HotelPMS's whole surface to a world-class,
Arabic-first (RTL default), SAR-currency PMS, benchmarked to the Oasis v2 design system
(`design-system.md`: Emerald Teal + warm ivory + apricot amber, Alexandria font). Frontend
phase only (`apps/hotelpms/frontend/`). Every change preserves the real backend APIs and the
server-enforced auth boundary; POS service-mode logic (`4649388`) preserved; the 7 auth-boundary
files kept LOCKED and untouched. Base commit `4649388`.

Per-screen loop applied throughout: inspect → design → implement against real APIs → `tsc` →
`vite build` → verify LIVE (Playwright, 1440 AR + spot 390/roles) → capture before/after →
independent review → fix P0/P1 → commit individually. auth-isolation suite (5 tests) run per
commit that touches nav/role, and again as a batch.

## Plan (who did what)
- **bildfast-frontend subagents** — screen rebuilds/elevations (Billing, FolioView) under a tight
  scope contract (no posting-flow rewrite, no backend-call changes, no test writes).
- **bildfast-review** — batch independent audit of `4649388..HEAD` (API integrity, correctness,
  RTL/i18n, a11y, maintainability).
- **advisor** — approach + sequencing checks (FolioView-before-public-site; run auth-isolation
  every commit; investigate the Lost&Found denial; verify Billing 390).
- **Orchestrator (this agent)** — owns the shared files (`App.tsx`, `configs.ts`, `ar.ts`),
  shared component layer (`ScreenHeader`, `charts`, status cells), live verification, findings,
  and all commits.

## Execution Note (actual results — HEAD `72541dd`)
**17 commits, all: tsc 0, build green, auth-isolation 5/5 where nav/role touched, 0 app console
errors (only the pre-existing socket.io 400), real APIs preserved, no locked file, POS untouched.**

Done & committed:
- **Pkg 0** — Calendar (KPI command bar), Tape Chart (frozen headers + KPI + semantic bars),
  Rooms (semantic HK/occupancy status + "Ready" state), Booking & Check-in modals (direct room
  selection w/ availability badges).
- **Pkg 1** — Today (task-organised cockpit), Dashboard (dependency-free analytics cockpit),
  Apps launcher (AR i18n fix). AppShell/core nav treated as done (`b1b1eca`) + LOCKED → not rebuilt.
- **Pkg 2** — Reservations (lifecycle status colour+icon+text), CRS (cross-property search→pick→book,
  UTC date-collapse fix).
- **Pkg 4** — Guests (CRM-style directory).
- **Pkg 5** — Billing (financial cockpit; locale-leak fix), Folio detail (elevation + shared
  folio-status pill; «فتح»→«مفتوحة» on both).
- **Pkg 6 / 6b** — Housekeeping tasks (status+priority pills) + cross-doctype semantic status sweep
  (Groups, Room Blocks, Lost&Found, Shifts, Venue Bookings) via one keyword-mapped `statusCellFor`.
- **Review fixes** — **P0** Today crash on "Ready" rooms (HK_META/HK_CYCLE never learned the new
  state → TypeError → cockpit down); status i18n leaks (Pending Payment/Held/Quoted/Requested +
  aria labels).

Shared layer introduced (reused everywhere): `components/ScreenHeader.tsx`, `components/ui/charts.tsx`,
`components/CalendarView.tsx`, `components/Legend.tsx`, and status cells `roomCells` /
`reservationCells` / `hkCells` / `statusCells` / `folioCells`.

Public booking page (`/book`) reviewed live: already a fully-structured React page (hero, search,
gallery, room cards w/ availability, sticky summary, policies, maps, FAQ, trust bar) — the
"restructure not CSS overlay" bar is already met; needs light i18n polish only, not a rebuild.

### Backend findings surfaced (for the BACKEND phase — out of the frontend lane)
1. **[P1] Lost & Found list 403 for authorized roles.** `frappe.client.get_list` on **Lost And Found
   Item** returns 403 for **Hotel Admin** and **System Manager** although the doctype JSON grants
   both `read=1` — a runtime perm mismatch (live DocPerm out of sync with source, or a has_permission
   hook). Management + housekeeping can't see the register. Fix: re-sync/migrate perms or review the
   hook; add an e2e assertion.
2. **[P1] Page-capped client-side aggregates.** Billing "Outstanding balance / Open folios / Folios"
   (list-capped at 100) and Guests "VIPs / Returning / Lifetime value" (capped at 200) under-count
   at scale. Fix: small server-side aggregate endpoints computed over the full set. Root cause: the
   "byte-identical API" brief was over-strict — additive list args (`limit`, `fields`, `orderBy`)
   don't break the contract; only method names/filters/scope do.

### Remaining (next continuation)
Light polish of public pages (`/book`, `/stay/:slug`, `/checkin/:token`); GuestJourney; Tickets;
Laundry; POS/Kitchen; Reports/Revenue; Settings/Activity/Assistant/Marketplace. Most internal
resource screens are already elevated (`4eb291b`) + status-swept; they need only spot i18n/RTL polish.

Evidence: `docs/design-reference/oasis-v2/implementation-round-3/` (README coverage board +
`before/` and `after/` screenshots at 1440/390 AR).
