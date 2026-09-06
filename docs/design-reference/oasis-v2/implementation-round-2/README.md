# Oasis UI v2 — Implementation Round 2 (full page-by-page)

Baseline: **commit `c27b7a4`** (Oasis foundation: teal/amber/ivory token remap app-wide, Alexandria bundled,
shell + Login + Dashboard done). Round 2 applies the Oasis hierarchy / 5 mandatory states / contextual panels /
wiring to **every remaining screen**. Colors are already app-wide via the remapped utility contract — round 2 is
hierarchy, states, interactions, responsiveness, RTL/EN, and wiring, **not** recoloring. No change to pricing /
availability / VAT / payments / invoices / ledger / cancellation / auth / RBAC except a test-proven bug fix.

**Status legend:** Pending · Done (built+built) · Tested (live-verified 1440/1024/768/390 × AR/EN + console-clean
+ no overflow, roles checked) · Deferred (reason).

**Method per page:** understand user/role/data/actions → open live as the right role + record before → check
API/perms → apply Oasis hierarchy + shared components → wire every KPI/card/row/action → add loading/empty/
error+retry/no-permission/success → keep filter state in URL where useful → logical props + real RTL + `bdi` for
numbers/phones → keyboard/focus/hover + 44px touch targets → test 1440/1024/768/390 × AR/EN × roles → watch
console/network → `tsc`+`npm build` → capture after → update this tracker + a memory line → small commit.

Verify harness: `docs/design-reference/oasis-v2/implementation-round-2/verify.js` (route → 1440/1024/768/390 ×
AR/EN captures + console-error + overflow report, one Bash call). `before/` holds the round-2 baseline captures.

---

## Route inventory & status

### Phase 1 — Core operations
| Route | Component | Status | Commit | Notes |
|---|---|---|---|---|
| `/` (index) | Today | **Tested** | (this commit) | operations-centre: pulse+greeting header, real permission-aware needs-now queue, KPI tiles, room board + arrivals/departures/in-house w/ actions, loading skeleton. Day-timeline/live-feed deferred (net-new, data-heavy) |
| `/dashboard` | Dashboard | **Tested** (rechecked) | (this commit) | now uses shared `QueueCard`; fixed leftover `?status=Open`→`Pending` |
| `/reservations` | ResourceScreen(reservationsConfig) + ReservationSummary/ContextPanel + ReservationDetail | **Tested** | (this commit) | 5-col scannable table (guest+ref/source, stay+nights, room-or-amber "No room", status, amber balance); row/keyboard opens 372px ContextPanel (glance: stay/room/source/total/advance/balance + amber "collect balance" callout + Check-in/Check-out/Reg-card/Full-details actions), "Full details" still opens the wide ReservationDetail editor unchanged; existing URL filters kept (no duplicate filter system). Verified 390/768/1024 × AR-RTL/EN-LTR: no overflow, console-clean. Fixes: date-range filter now wraps (was +42px mobile overflow); mobile panel z-[60] over bottom-nav so all actions hittable |
| `/grc/:name` | RegistrationCard | **Tested** | (this commit) | print-safe AR/EN. Backend untouched (registration_card + update_occupants/upload_*/set_actual_times all preserved). i18n leaks fixed: `2 adults + 1 child` (qty + child/children added to UNIT), `(incl. VAT)`, ledger→Oasis money rows (Paid/Balance-amber/Deposit), certification paragraph + folio CTA as whole-string AR keys. Logical props for RTL print (text-end, pe-, ms-, bdi on refs/dates/amounts/phone). error+retry state. Verified real data 1440 AR-RTL/EN-LTR **screen + `print` media**: dir carries, `print:hidden` hides editors/links, no overflow, 0 console errors |
| `/cancelled/:name` | CancellationLetter | **Tested** | (this commit) | print-safe AR/EN. Backend untouched. Compound letter body → whole-sentence AR keys with `{placeholder}` tokens + new `fill()` helper (bidi-isolated values) so Arabic reads grammatically (`نؤكد أن حجزكم … من {ci} إلى {co} (3 ليالٍ) … قد تم إلغاؤه`); Refund-due in amber. error+retry. **Note:** demo data has no Cancelled reservation, so the body/print was verified via a transient route-mock (real-shaped payload) in AR+EN screen+print (dir carries, print:hidden works, no overflow, amber refund); the live error path was verified against a real non-cancelled reservation. No cancel workflow was run on demo data |
| (internal) BookingDialog | components/BookingDialog | **Tested** | (this commit) | pricing/availability/tax/creation/permissions untouched. Presentation only: fixed RTL bidi on the Total-box stay dates (was reversed), fixed compound i18n leaks (capacity `Sleeps up to N adults · M children` via qty, over-capacity warning + `Split into N rooms`, cancellation/no-show policy via `fill()` templates, `Meals`, `/night`, `/adult)`), translated placeholders (`Type to find or create`, `Optional code`). Verified 390 AR-RTL/EN-LTR: no dialog/page overflow, actions reachable, 0 real console errors |
| `/crs` | CRS | **Tested** | (this commit) | crs_search + create_booking logic untouched. Fixed compound leaks (result summary children grammar, `N rooms · from`, `N left · sleeps M`, `total, taxes in`, `Booked {ref} at {property}`), booking Sheet title `Book {roomType}` + description dates now bidi-isolated (widened shared `Sheet` title/description to ReactNode — backward-compatible). Logical props (ms-/text-end) + bdi on rates/totals. Verified 390 AR-RTL/EN-LTR: no overflow, results + Sheet render, dates correct order |
| `/guests` | Guests | **Tested** | (this commit) | backend untouched. r1 list was already well-keyed; added the `Name or phone…` placeholder key, converted physical→logical CSS (ps-/pe-/ms-/text-start), bdi on the lifetime amount. Row → `/guests/:name` navigation intact. Verified 390 AR-RTL/EN-LTR: no overflow |
| `/guests/:name` | GuestJourney | **Tested** | (this commit) | backend untouched. Translated all frontend statics (back link, Journey, `events · newest first`, stay-strip legend, Profile actions, Merge/Anonymize + descriptions, placeholders), bidi on all frontend dates/amounts/timestamps/phone/ID, and fixed the timeline RTL layout (`border-s`/`ms-`/`ps-`/`-start-` so the rail + icons sit on the correct side). **Known limit:** timeline event `title`/`detail` come from the `guest_journey` API (data) — they stay English in AR unless the backend is changed (out of scope). Verified 390 AR-RTL/EN-LTR: no overflow, no frontend-label leaks |
| `/room-blocks` | ResourceScreen(roomBlocksConfig) | **Tested** | (this commit) | uses the round-2 ResourceScreen. Added AR keys for the description + reason/status enums (House Use/VIP Hold/Owner/Released) + form date labels. Verified 390 AR-RTL/EN-LTR: no overflow, description + enums translated |

### Phase 2 — Inventory & housekeeping
| Route | Component | Status | Commit | Notes |
|---|---|---|---|---|
| `/rooms` | ResourceScreen(roomsConfig) | **Tested** | (this commit) | already carried the occupancy × housekeeping dual badges + was fully keyed from r1 — verified only (no code change). 390/768/1024/1440 AR-RTL + EN: no overflow, no leaks |
| `/room-types` | ResourceScreen(roomTypesConfig) | **Tested** | (this commit) | made 3 currency/tax column headers translatable — `Base ${cur()}/night`→`Base / night`, `Extra adult ${cur()}`→`Extra adult` (the embedded `cur()` defeated the observer), + AR keys for those and `VAT %` / `Code (e.g. DLX)`. Verified 390/768/1024/1440 AR-RTL + EN: no overflow, headers translated |
| `/calendar` | CalendarView | **Tested** (empty live; populated route-mock) | (this commit) | New shared **`OnboardingEmptyState`** (role-gated CTA via `canAccessPath`). Two zero-data flavors: `room_types=[]`→"Create room types"/"Add rooms"; rooms all 0→"Add rooms". New **mobile day-view** (day-tabs + tappable room-type cards) replaces the crushed 14-col grid below `lg`. Logical props (`sticky start-0`, `text-start`, `pe-`), bidi rates. Backend untouched. **Live-verified empty** dual-persona (gm=CTAs, Front Desk=gated note) 390/768/1024/1440 AR + 1024 EN, no overflow. **Populated verified via `availability_calendar` route-mock** (desktop grid RTL + mobile cards) — not live Tested (DB intentionally empty). Pre-existing env errors only (`property_locale` 404 on purged DB, socket.io) |
| `/tape` | TapeChart | **Tested** (onboarding + RTL bars via route-mock; live=property-not-found) | (this commit) | **Fixed a real RTL bug**: booking bars + held-blocks + hourly bars used absolute `left:` px (LTR-only) → switched to logical `insetInlineStart` so they mirror correctly in RTL (empirically verified: a dates[2]→[5] bar now aligns with its day columns in both dirs). Added today-column highlight (the "now" marker), onboarding empty via `OnboardingEmptyState` (unfiltered no-rooms), logical props (text-start/me-/ms-). Legend + safe click-to-edit (Sheet, no drag) preserved. **Live** (empty DB): the tape validates the property and the DB has **0 Property records**, so it shows an honest "property not found" retry error — the room-onboarding empty state + RTL bars + LTR were verified via `tape_chart` route-mock, dual-persona (gm CTAs, Front Desk gated note), 390/1024/1440 AR + 1024 EN, no overflow |
| `/housekeeping` | ResourceScreen(housekeepingConfig) | **Tested** (onboarding live dual-persona; populated route-mock) | (this commit) | **Shared ResourceScreen upgrade** (opt-in, other config screens unchanged): `config.onboarding` renders the role-gated `OnboardingEmptyState` when there are no records and no active filter; distinguishes "no matches" (filtered) from onboarding; captures the error status → a graceful **permission-denied** panel (+ suppresses the raw error banner + hides New) for 401/403. BADGE_TONES += Urgent(rose)/High(amber)/Verified(green). housekeepingConfig: room-led columns + colored Priority + Owner (assigned-user) + onboarding (prereq Rooms). **Live-verified dual-persona (clean logins)**: Housekeeping role → gated note (no dead /rooms link), gm → "Add rooms" CTA; onboarding no-overflow 390/768/1440. Populated table (room/type/priority-badge/owner/status) verified via `/api/resource/Housekeeping Task` route-mock. Note: no SLA field on the doctype |
| `/hk` | HkApp | Pending | — | mobile task app |
| `/laundry` | Laundry | Pending | — | |
| `/lost-found` | LostFound | Pending | — | |

### Phase 3 — Restaurant & POS
| Route | Component | Status | Commit | Notes |
|---|---|---|---|---|
| `/pos` | POS | Pending | — | 3 panels no page-scroll; teal send / amber pay 56px |
| `/kitchen` | Kitchen | Pending | — | KDS live |
| `/menu-items` | MenuItems | Pending | — | |
| `/outlets` | Outlets | Pending | — | |
| `/inventory` | Inventory | Pending | — | |
| `/menu/:outlet` | QrMenu | Pending | — | public |

### Phase 4 — Finance, revenue, reports
| Route | Component | Status | Commit | Notes |
|---|---|---|---|---|
| `/billing` · `/billing/:name` | Billing · FolioView | Pending | — | SAR/VAT trace, no calc change |
| `/accounting-export` | AccountingExport | Pending | — | |
| `/reports` · `/revenue-reports` | Reports · RevenueReports | Pending | — | real-data charts + table fallback |
| `/rate-plans` `/seasons` `/vouchers` `/meal-plans` | ResourceScreens | Pending | — | |
| `/travel-agents` `/companies` | ResourceScreens | Pending | — | |
| `/channel-manager` `/ota-mappings` `/guardrails` | screens | Pending | — | |

### Phase 5 — Operations & comms
| Route | Component | Status | Commit | Notes |
|---|---|---|---|---|
| `/tickets` | Tickets | Pending | — | inbox/queue + ContextPanel |
| `/whatsapp` `/channels` | WhatsAppChat · messaging | Pending | — | role isolation |
| `/ops-sla` `/shifts` | OpsSLA · Shifts | Pending | — | |
| `/assistant` `/agents` `/activity` | screens | Pending | — | |

### Phase 6 — Events & groups
| Route | Component | Status | Commit | Notes |
|---|---|---|---|---|
| `/banquet-month` `/banquet-diary` `/banquet-registers` `/banquet-catalogue` | Banquet screens | Pending | — | |
| `/banquet/:name` `/banquet/:name/:kind` | BanquetFunction · BanquetDocument | Pending | — | |
| `/groups` `/venues` `/venue-calendar` `/events` | screens | Pending | — | |

### Phase 7 — Admin & settings
| Route | Component | Status | Commit | Notes |
|---|---|---|---|---|
| `/apps` | AppLauncher | Pending | — | |
| `/settings` `/setup` | Settings · Setup | Pending | — | grouped sections, RBAC |
| `/developers` `/marketplace` | screens | Pending | — | |
| `/booking-settings` | BookingEngine | Pending | — | |
| (sweep) any App.tsx route not above | — | Pending | — | mark Done/Tested/Deferred |

### Phase 8 — Public guest experience
| Route | Component | Status | Commit | Notes |
|---|---|---|---|---|
| `/stay/:slug` | PublicListing | Pending | — | guest, no staff perms |
| `/book` · `/book/:…` | PublicBooking | Pending | — | (r1-improved; align hero+cards to v2-06) |
| `/checkin/:token` | PublicCheckin | Pending | — | |
| `/login` | Login | Done (r1) | c27b7a4 | |

---

## Mockup pattern notes (distilled from `redesign-screens/v2-*.html`)
- **v2-02 home (Today):** operations-centre, not a metric board. Order: greeting header (name + date + live
  "pulse" chip + "N tasks before arrival peak") → **"يحتاج منك الآن" queue** (max 3 `qcard`: colored icon +
  title + context + primary+secondary buttons; amber = money/attention) → 5 KPI **tiles** (hero occupancy = teal
  gradient + amber meter; rest clickable w/ hover arrow) → grid2(2fr/1fr): **Day Timeline** (08–18 track, 4 rows
  arrivals/departures/HK/restaurant, amber now-line) + live feed + night-audit callout → **rooms pulse** chips +
  legend → keyboard hints. Primitives: `.btn-pri`(teal)/`.btn-amber`/`.btn-tonal`/`.btn-sec`; `.tile`/`.tile.hero`;
  `.qcard`; `.badge b-*`; `.tbl` (micro headers, hover ivory, selected teal-50 + inset bar); `.panel` 372px.
- Shared token contract already live in `index.css` (brand=teal, gold=amber, zinc=warm). Build with existing
  `Card/StatCard/Button/Badge` (already rethemed) + new shared `QueueCard`; don't fork CSS.

## Per-page execution log
- **Today (`/`)** + **Dashboard (`/dashboard`)** — Phase 1.
  - New shared `components/QueueCard.tsx` (Oasis "needs your attention now" card; link + action-footer variants).
  - Today: pulse-chip greeting header + real, permission-aware priority queue (departures-with-balance→amber,
    overdue-HK→danger, unassigned/expected arrivals→teal; empty→"all clear"), loading skeleton (5th state),
    kept arrivals/departures/room-board/in-house/HK with all working actions. Fixed pre-existing mobile/tablet
    overflow (`min-w-0` on the two body columns so the in-house table scrolls internally). i18n via `t()` + keyed
    phrases (compound strings can't be matched by the live observer). New `ar.ts` keys added.
  - Dashboard recheck: swapped inline `AttentionCard`→ shared `QueueCard`; fixed leftover `?status=Open`→`Pending`.
  - Tests: `npm build` ✓; verify.js Front Desk (Today) + Hotel Admin (Dashboard) → **no overflow, 0 console
    errors, dir ar=rtl/en=ltr across 1440/1024/768/390 × AR/EN**. After-shots in `after/today`, `after/dashboard`.
- **Reservations (`/reservations`)** — Phase 1.
  - New `components/ContextPanel.tsx` (generic Oasis contextual panel: 372px inline-end side panel below the
    top bar on desktop with **no scrim** so the list stays visible — Mews pattern; full-screen sheet + scrim on
    mobile at `z-[60]` so it clears the `z-50` bottom-nav; Escape closes; saves/restores focus).
  - New `components/ReservationSummary.tsx` (glance panel built from the row, no extra fetch: ivory guest header
    w/ status + "No room" badges, stay/room/source/type KV, total/advance/**amber balance** box + "collect
    balance before checkout" callout when balance>0, actions Check-in/Check-out/Registration-card/Full-details).
  - New `screens/reservationCells.tsx` (composite cells: guest+ref/source, stay+nights `bdi`, room-or-amber,
    amber balance) so `configs.ts` stays plain data.
  - `ResourceScreen.tsx`: opt-in `contextPanel`/column `render`/`extraFields`; row is now a keyboard-operable
    button that opens the panel (falls back to edit-drawer when no `contextPanel`); selected-row highlight;
    desktop reserves `lg:pe-[392px]` so the list clears the panel. Generic + opt-in → other screens unchanged.
  - `configs.ts`: `reservationsConfig` → 5 scannable columns + `contextPanel: ReservationSummary`, kept its
    existing URL filters + wide `detailPanel: ReservationDetail` (opened via "Full details"). No duplicate filter
    system; no pricing/availability/permission changes. New `ar.ts` keys (No room / Full details / To be
    assigned / balance callout).
  - Fixes (pre-existing mobile defects): the date-range filter group now `flex-wrap`s (was +42px overflow at
    390 in RTL); mobile panel `z-[60]` so all 3 footer actions are hittable over the bottom-nav.
  - Tests: `npm build` ✓; MCP live Front Desk → **390/768/1024 × AR-RTL/EN-LTR no overflow, 0 console errors**,
    panel full-screen+actions-hittable on mobile, 372px side panel + visible list on desktop, "Full details"
    opens the wide editor. Hotel-Admin persona verified (12 rows, role-appropriate actions). 1440 + Hotel-Admin
    below. `e2e/auth-isolation.spec.ts` pending at batch close.
- **GRC (`/grc/:name`)** + **Cancellation letter (`/cancelled/:name`)** — Phase 1, print-safe AR/EN.
  - New i18n primitives in `lib/i18n.ts`: `fill(template, values)` interpolates a *translated* template's
    `{name}` tokens into ReactNode[] with bidi-isolated values (so a compound Arabic sentence stays ONE
    dictionary key = correct grammar/word-order); `child`/`children` added to the UNIT map for `qty()`.
  - GRC: fixed every compound i18n leak (guests `2 adults + 1 child`, `(incl. VAT)`, ledger → Oasis money rows
    with amber balance), whole-string AR keys for the certification paragraph + folio CTA + occupant-register
    copy, converted physical→logical CSS (text-end / pe- / ms-) and `bdi` on refs/dates/amounts/phone for RTL
    print, added error+retry. Backend calls all preserved; ID-type list + `Indian` default left alone (backend
    surface). Widened `Row` value to ReactNode.
  - Cancellation: rebuilt the letter body + closing as whole-sentence AR keys + `fill()`; amber Refund-due;
    error+retry; logical props + bidi.
  - New AR keys (~34) added under the GRC/Cancellation section of `ar.ts` (grepped for dupes first).
  - Tests: `tsc --noEmit` ✓ + `npm build` ✓. MCP live as Hotel Admin, **`screen` + emulated `print` media**,
    AR-RTL + EN-LTR: GRC on a real reservation and the letter on a real-shaped route-mock — dir carries into
    print, `print:hidden` hides all editors/links, no overflow, no UI-label leaks (only stored data/proper
    nouns remain English), 0 real console errors (only benign socket.io). Letter's live error path verified
    against a real non-cancelled reservation. After-shots: `after/grc`, `after/cancellation`.
- **BookingDialog (internal)** + **CRS (`/crs`)** — Phase 1, presentation-only (no pricing/availability/
  tax/reservation-creation/permission changes).
  - BookingDialog is observer-translated (no `useT`); added the reactive hook (aliased `tt` to avoid the local
    `setTimeout t` shadow) only for the compound `fill()` sentences. Fixed the Total-box stay-dates RTL bidi
    (`<bdi dir="ltr">`, was rendering `co → ci`), the capacity hint + over-capacity warning + `Split into N
    rooms` (qty/fill), the cancellation/no-show policy lines (fill templates), and translated the guest-search /
    voucher placeholders + `Meals` / `/night` / `/adult)`.
  - CRS: added `useT`; templated the result summary + per-property/room-type availability lines + the done
    banner; booking Sheet now shows a bidi-isolated date range and a translated `Book {roomType}` title — which
    needed the shared `Sheet` `title`/`description` widened from `string` to `ReactNode` (backward-compatible,
    no behaviour change; all existing string callers still valid).
  - New AR keys added under the booking + CRS sections (deduped; removed a `Sleeps up to` that already existed).
  - Tests: `tsc --noEmit` ✓ + `npm build` ✓. MCP live, 390px AR-RTL + EN-LTR: no dialog/page overflow, leaks
    gone, dates render in correct order, results + booking Sheet work. After-shots: `after/booking`, `after/crs`.
- **Guests (`/guests`)** + **GuestJourney (`/guests/:name`)** + **Room Blocks (`/room-blocks`)** — Phase 1,
  presentation + i18n only (backend contracts untouched).
  - Guests: r1 list already well-keyed — added the search placeholder key, logical CSS (ps-/pe-/ms-/text-start),
    bdi on the lifetime amount. Row→journey navigation was already correct (`useNavigate` on a keyboard-operable
    `role=button` row).
  - GuestJourney: observer-translated; added AR keys for every frontend static (legend, section titles, profile
    actions + descriptions, placeholders) + bidi on all frontend dates/amounts/timestamps/phone/ID + logical
    props fixing the timeline rail side in RTL (`border-s`, `-start-[13px]`, `ms-`, `ps-`). The timeline event
    `title`/`detail` are `guest_journey` API strings (data) → left as-is (translating them is a backend change).
  - Room Blocks: pure `ar.ts` additions (ResourceScreen already carries the round-2 behaviour) — description +
    reason/status enum labels + form date labels.
  - Tests: `tsc --noEmit` ✓ + `npm build` ✓. MCP live 390px AR-RTL + EN-LTR across all three: no overflow,
    frontend labels translated, timeline RTL rail correct, guest-row navigation works. After-shots:
    `after/guests`, `after/journey`, `after/roomblocks`.
- **Phase 1 batch-close sweep** — completed the full `1440/1024/768/390 × AR/EN` matrix the legend requires
  (each group had been verified at a subset when first committed): GRC + Cancellation (route-mock) at
  390/768/1024 AR; BookingDialog + CRS at 768/1024/1440 AR (incl. the `lg:` breakpoint where the Quote aside
  moves beside the form); Guests/Journey/Room Blocks at 768/1024/1440 AR — **all no overflow, no frontend
  leaks**, EN spot-checked. Front Desk `/grc/:name` loads clean (permission spot-check on a new surface).
  **`frontend/e2e/auth-isolation.spec.ts` → 1 passed** (Finance vs POS session isolation, role routing, and
  the New-booking / nav gating all intact). Phase 1 is fully Tested.

## Amber-discipline hit-list (`btn-gold`/`text-gold` → teal unless attention/money/VIP)
_grep results + per-screen reclassification, filled as reached_
