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
| `/reservations` | ResourceScreen(reservationsConfig) + ReservationDetail | Pending | — | table + saved filters + 372px ContextPanel |
| `/grc/:name` | RegistrationCard | Pending | — | print-safe |
| `/cancelled/:name` | CancellationLetter | Pending | — | print-safe |
| (internal) BookingDialog | components/BookingDialog | Pending | — | guest→stay→price→confirm sequence |
| `/crs` | CRS | Pending | — | |
| `/guests` | Guests | Pending | — | (r1-improved list; apply Oasis panel) |
| `/guests/:name` | GuestJourney | Pending | — | |
| `/room-blocks` | ResourceScreen(roomBlocksConfig) | Pending | — | |

### Phase 2 — Inventory & housekeeping
| Route | Component | Status | Commit | Notes |
|---|---|---|---|---|
| `/rooms` | ResourceScreen(roomsConfig) | Pending | — | occupancy × readiness dual badges |
| `/room-types` | ResourceScreen(roomTypesConfig) | Pending | — | |
| `/calendar` | CalendarView | Pending | — | date nav, filters(url), click cell→booking |
| `/tape` | TapeChart | Pending | — | click-to-edit (no drag unless API-safe), legend, now-line |
| `/housekeeping` | ResourceScreen(housekeepingConfig) | Pending | — | task board, priority/owner/SLA |
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

## Amber-discipline hit-list (`btn-gold`/`text-gold` → teal unless attention/money/VIP)
_grep results + per-screen reclassification, filled as reached_
