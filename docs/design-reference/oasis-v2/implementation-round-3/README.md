<!-- Oasis v2 — Implementation Round 3 tracker -->
# Oasis UI v2 — Implementation Round 3 (screen-by-screen, benchmarked to the reference)

Base commit: `4649388`. Identity per `design-system.md`: Emerald Teal + warm ivory + apricot amber,
Alexandria font, Arabic RTL default + complete English LTR. Preserve all real data/APIs and the
server-enforced auth; POS service-mode logic from `4649388` preserved.

Concurrent work already merged (build on, do not revert): `b1b1eca` (dual-layer shell),
`4eb291b` (elevated resource pages + data views), `4649388` (POS service mode).

## Package 1 — Calendar · Tape Chart · Rooms · Booking modal + room-selection
| Screen | Reference | Status | Intended differences from reference |
|---|---|---|---|
| Calendar (`/calendar`) | (design-system, no direct mockup) | **done** (1440 AR ✓, build ✓, auth-isolation 5/5, 0 console err) | New shared `ScreenHeader` (title + hotel/date context + role-gated "New booking" + KPI row: occupancy meter, rooms-free, arrivals/departures/to-clean); per-date occupancy %; semantic legend now icon+text (Available / Limited⚠ / Sold-out🚫). Enrichment uses existing calendar/snapshot APIs, batched (no per-cell N+1). |
| Tape Chart (`/tape`) | v2-04 | **done** (1440+390 AR ✓, build ✓, auth-isolation 5/5, 0 console err) | ScreenHeader + 5 derived KPI tiles (occupancy meter, rooms-free, arrivals, departures, out-of-service); **sticky date-header + sticky room column** (RTL corner verified); bars keep `insetInlineStart` (RTL mirror), status = colour+icon+text; filter selects → removable chips + Clear; day/hourly zoom; mobile 390 = day-chip picker + grouped room list (no overflow); all tape/allocation APIs preserved, no new fetch. Intended diffs: Auto-assign now role-gated; arrivals/departures derived from tape payload (may undercount unassigned vs Calendar snapshot); house-position folded into date header; no content-visibility (protects frozen header/bars). |
| Rooms (`/rooms`) | (resource pattern) | **done** (already elevated by 4eb291b; gap-filled) | 4eb291b already gave the strong header + filter bar + record count. Gap-fill: new `roomCells.tsx` renders housekeeping + occupancy status as colour **+ icon + text** (Clean✨/Ready🚪/Inspected✓/Dirty🖌/OOO🔧; Occupied🛏/Vacant🚪); added missing **"Ready"** status to the filter + form options (was the plan-0009 E1 gap). |
| Booking modal + room selection | v2-06 | **done** (1440+390 AR/EN ✓, build ✓, auth-isolation 5/5, 0 console err) | BookingDialog: bare room-type `<select>` → selectable room cards showing capacity + from-price + **availability badge (colour+icon+text)** — Available✓ / {n} left⚠ / Sold-out🚫 (sold-out disabled with reason). Availability via one batched `getCalendar` (existing export, debounced, no N+1, fails-open). Confirm gated by a single visible `blockReason` (missing name/date/ID → over-capacity + "Split into N rooms" CTA → over-committed availability), Waitlist always enabled. Sticky summary: `<bdi>` amounts + nights + deposit/policy + quote-error Retry. RTL physical→logical props; 390 stacks summary below form, no overflow. CheckInDialog room `<select>` → chip grid with HK status colour+dot+text. All booking/quote APIs byte-identical; no test booking persisted; +2 AR keys. |

**Package 0 complete** (`d9263f8` Calendar · `1496cb5` Tape · `23d6ea0` Rooms · Booking below). All: tsc 0, build green, auth-isolation 5/5, 0 app console errors (only the pre-existing unrelated socket.io 400), AR/EN parity, no 390 overflow, real APIs preserved, no locked file touched, POS untouched.

Before/after screenshots: `./before/` and `./after/` (1440 / 1024 / 390, AR + EN).

## Checkpoint (2026-09-07)
- **Package 0: DONE + committed** (4 commits above). Base `4649388` → HEAD `7f5d03a`.
- **Next: Package 1** — Today, Dashboard, Role Home, Apps launcher.
  - **AppShell + core navigation are treated as already-done (b1b1eca dual-layer shell) AND locked**
    (auth-boundary + concurrent-author turf) → NOT rebuilt. Package 1 covers the *screens* only, plus
    the shared `ScreenHeader`/KPI system already introduced in package 0.
- Shared component layer emerging: `ScreenHeader` (title + hotel/date context + role-gated action + KPI
  tiles), `roomCells` (semantic status), Legend (icon+text). Reuse across screens.

## Package 1 — Today · Dashboard · Apps launcher (screens only)
| Screen | Reference | Status | Notes |
|---|---|---|---|
| Today `/` (role home) | v2-02 | **done** (1440 AR ✓, build ✓, auth-isolation 5/5, 0 console err) | Task-organised command centre: ScreenHeader + 5 live KPI tiles (arrivals/departures/in-house/occupancy meter/to-clean); priority "Needs attention now" band (arrivals, dirty rooms, overdue tasks) with gated deep-links; arrivals→check-in + departures→check-out worklists (real dialogs); in-house list + room-status pulse strip (colour+icon+text, click→quick action); skeleton/error+retry/permission-denied/onboarding states. Removed fabricated sparklines + revenue tiles (no mock data; revenue is pkg 9). APIs unchanged (front_desk_snapshot, property_dashboard fail-soft, check_in/out, set_housekeeping_status). +15 AR keys. |
| Dashboard `/dashboard` | v2-02 | **done** (1440 AR ✓, build ✓, auth-isolation 5/5, 0 console err) | Management cockpit from the real `property_dashboard`/`portfolio_dashboard` payload. Header + period control (native date, capped today) + scope toggle + 5 KPIs (occupancy meter, ADR, RevPAR, revenue, collections) + Revenue-reports action. New **dependency-free** `ui/charts.tsx` (inline SVG/CSS): occupancy-pace line (RTL-flipped, %-LTR, a11y title), room-readiness stacked bar + gated status rows, collections-by-mode BarList (+empty state), movement bars, portfolio revenue BarList. States: skeleton/onboarding/error+retry/permission-denied. +3.5 kB lazy chunk only (no new dep). +17 AR keys. Intended diffs: dropped duplicate needs-attention band (lives on Today); added period control; MTD moved to its own card. |
| Apps launcher `/apps` | — | **done** (i18n gap-fill; 1440 AR ✓, 0 console err) | Card grid already from b1b1eca shell; fixed the AR English-leak — added 4 missing keys (launcher subtitle + Operations/Revenue/Events app descriptions). |

## Package 2 — Reservations · CRS · group/edit/cancel (Calendar/Tape/room-select already in pkg 0)
| Screen | Reference | Status | Notes |
|---|---|---|---|
| Reservations `/reservations` | v2-03 | **done** (already elevated by 4eb291b; gap-filled) | ResourceScreen already gives header + filter bar + record count + guest/stay/room/balance cells. Gap-fill: new `reservationStatusCell` renders the lifecycle status as colour **+ icon + text** (Confirmed✓ / Checked-in→ / Checked-out→ / Pending-payment💳 / Waitlist⏱ / Cancelled✕ / No-show🚫), replacing the colour-only badge. Verified 1440 AR, 0 console err. |
| CRS `/crs` | — | **done** (1440 AR ✓, build ✓, 0 console err) | Full rebuild: ScreenHeader + KPI bar (properties-with-space / rooms-available / from-rate / nights); search-as-hero (stays mounted, dims on re-search); active-query + property-scope chips + Clear; results = property cards → room-type rows with availability badge (colour+icon+text, BookingDialog vocab) + capacity + taxes-in total; invalid-pick guard (children>capacity → non-interactive + reason); role-gated Book; skeleton/empty/error+retry/permission-denied states; inline Sheet books the correct FOREIGN property (openBooking would use current property). Fixed a UTC date bug collapsing 1-night stays. crs_search/create_booking byte-identical. +13 AR keys. |

## Checkpoint 2 (2026-09-07) — 9 screens committed
Base `4649388` → HEAD `dd15b0c`. Done: **Pkg 0** (Calendar/Tape/Rooms/Booking), **Pkg 1**
(Today/Dashboard/Apps), **Pkg 2** (Reservations/CRS). Pkg 2 remainder (group/edit/cancel) live inside
BookingDialog/ReservationDetail already touched. **Next: Guests, then Folio/Billing, Housekeeping,
POS/Kitchen, Revenue/Events/Reports, Settings, Login + public.** Many remaining internal screens are
ResourceScreens already elevated by 4eb291b → semantic-status gap-fill pattern (`roomCells` /
`reservationStatusCell`) applies. Every commit: build green, tsc 0, auth-isolation 5/5 where nav/role
touched, 0 app console errors, real APIs preserved, no locked file, POS untouched.

## Package 4 — Guests · Guest Journey · Check-in · GRC
| Screen | Reference | Status | Notes |
|---|---|---|---|
| Guests `/guests` | — | **done** (1440 AR ✓, build ✓, 0 console err) | Full rebuild: ScreenHeader + 4 KPI tiles (Guests/VIPs/Returning/Lifetime value); debounced server search + VIP/Returning removable filter chips + Clear (results dim, no unmount); table→link-rows to `/guests/:name` (avatar, VIP/Returning badges colour+icon+text, phone/email `<bdi>`, stays·nights, recency chip Upcoming/Last-stay/None, lifetime value); skeleton/empty/error+retry/permission-denied states; table-free responsive (no 390 overflow). `guests_with_stats` unchanged. +10 AR keys. Intended diffs: email search omitted (backend matches name/phone only; email still shown), In-house KPI→Returning, 200-row cap shown as "200+". |

## Package 5 — Billing · Folio detail · Night audit
| Screen | Reference | Status | Notes |
|---|---|---|---|
| Billing `/billing` | — | **done** (1440 AR ✓, build ✓, 0 console err) | Full rewrite. ScreenHeader + 4 KPI tiles (Folios / Outstanding balance [gold] / Today's collections / Open folios). Fixed locale bug: `fmtDate`/`fmtWhen` hardcoded `en-IN` → `dateLocale()`. Night-audit card + collections card + Folios view translated, `<bdi>`-isolated amounts/dates/invoice/folio-ids, `qty(n,"night")` for nights. Status → semantic pill colour+icon+text (Open→amber/credit-card, Settled·Closed→emerald/check). Responsive folios: dense table ≥640px, stacked tappable cards below. States: skeleton / error+Retry / permission-denied. Logical props throughout. All 4 APIs byte-identical (`Folio` list, `cash_summary`, `Night Audit Run` list, `run_night_audit` behind button). +13 AR keys. Intended diffs: KPIs computed over the loaded page (byte-identity forbade adding `limit`); no meter on Outstanding; cash_summary/audit-runs failures degrade to null/empty (only Folio load drives error/denied); "Open"→shared key "فتح". |

## Package 6 — Housekeeping · Tickets · Laundry (semantic-status gap-fill)
| Screen | Reference | Status | Notes |
|---|---|---|---|
| Housekeeping tasks `/housekeeping` | (resource pattern) | **done** (already elevated by 4eb291b; gap-filled) | New `hkCells.tsx`: task `status` (Pending→amber/clock, In Progress→sky/dashed, Done→emerald/check, Verified→brand/badge) + `priority` (Urgent→rose/alert, High→amber/chevrons-up, Medium→sky/equal, Low→zinc/chevron-down) now render as colour **+ icon + text** (was colour-only badges). All 8 status/priority AR keys pre-existed → 0 ar.ts edits. Verified live 1440 AR: 6/6 pills iconed, 0 console err. |

## Package 6b — cross-doctype semantic status sweep
| Screens | Status | Notes |
|---|---|---|
| Groups `/groups`, Room Blocks `/room-blocks`, Lost & Found `/lost-found`, Shifts `/shifts`, Events `/events` | **done** (room-blocks verified live 1440 AR, 0 console err) | New `statusCells.tsx` `statusCellFor(field)` — one keyword-mapped cell (Confirmed/Completed/Returned/Found→emerald·Active→brand·Released/Open/Tentative/Enquiry→sky·In Storage/Missing/Damaged/Pending→amber·Closed→zinc·Cancelled/Lost/Disposed→rose; neutral fallback for unknowns, never worse than the badge it replaces). Wired: Group Booking `status`, Room Block `block_status`, Lost&Found `status`+`condition`, Shift Handover `status`, Venue Booking `status`. All 16 status AR keys pre-existed → 0 ar.ts edits. Lost&Found showed the permission-denied state correctly for System Manager (feature, not defect). |

## Backend findings surfaced during the redesign (for the BACKEND phase — not fixable in the frontend lane)
These are **pre-existing** backend/permission/data issues found while verifying screens. The frontend loop only *surfaces* them; the fix belongs to the backend phase.

- **[P1] Lost & Found list denies authorized roles.** `frappe.client.get_list` for **Lost And Found Item** returns **403 PermissionError** for both **Hotel Admin** (`gm@`) and **System Manager** (`admin@`), even though `lost_and_found_item.json` grants `read=1` to System Manager, Hotel Admin, Front Desk, Housekeeping and HotelPMS Agent. The 403 is on the list call itself (before any cell renders), so it is independent of the round-3 status-cell change. Effect: management + housekeeping cannot view the Lost & Found register at all. Likely cause: live DocPerm out of sync with source JSON (perms never migrated), or a `has_permission`/hook denial. **Fix (backend):** re-sync/migrate the doctype permissions or review the permission hook; add an auth-isolation/e2e assertion that `gm@`+`housekeeping@` can read Lost & Found. (The frontend already renders the permission-denied state correctly.)
- **[P1] Billing "Outstanding balance" KPI is page-scoped.** The Billing KPIs (Outstanding balance, Open/Total folio counts) are computed client-side over the folios returned by `listResource("Folio")`, which defaults to ~100 most-recently-modified rows. Correct today (9 folios); silently under-reports once a property exceeds 100 folios — a wrong gold financial figure. **Fix (backend):** add a server-side aggregate endpoint (e.g. `hotelpms.api.billing_summary(property)` returning Σ balance, open count, total count) and read the KPI from it. Root-cause note: the frontend brief's "byte-identical API" rule was over-strict — standard list args (`limit`, extra `fields`, `orderBy`) don't break the architecture contract; only method names, filters and scope do. Future briefs should allow additive list args.

## Scheduled polish (frontend, next commits)
- **"فتح" (Open) folio-status wording**: the Billing list reuses the shared `Open`→`فتح` key, which reads oddly next to `الحسابات المفتوحة`. Fix with a correctly-scoped folio-status pill in **FolioView** and swap the Billing list cell to it in the same commit (do NOT touch the shared key).
- **Live spot-check `/groups` and `/shifts` with data** (status sweep verified only `/room-blocks` live; shared cell + graceful `—` fallback make this low-risk).

### Package 5 (cont.) — Folio detail
| Screen | Reference | Status | Notes |
|---|---|---|---|
| Folio detail `/billing/:name` | — | **done** (1440 AR ✓, build ✓, auth-isolation 5/5, 0 console err) | Tightly-bounded **elevation** (no rewrite). New `folioCells.tsx` `folioStatusCell` (colour+icon+text; scoped labels Open→«مفتوحة» / Settled→«مسوّاة» / Closed→«مغلقة» via folio-scoped observer keys — shared `"Open"` key untouched) reused in **Billing** list (fixes the «فتح» wording on both). `ScreenHeader` (guest+folio id, reservation·room·stay context, KPI row Grand total/Paid/Balance[gold]/Status; print:hidden so it stays off the tax invoice). `<bdi>`+`dateLocale()`/`moneyLocale()` audit across header, printable doc, facts, charge table, tax/summary/payments, sibling tabs. RTL logical props in header/totals/table (intricate move/split/refund/PIN dialogs left untouched to avoid breakage). States: skeleton / error+Retry / permission-denied (replaces a dead-end "Loading…" that could hang). **Zero backend calls changed** (all ~24 hotelpms.api.* posting/settlement/PIN methods byte-identical; only the folio_invoice load's .then/.catch gained error/denied state). **Zero test writes.** +4 AR keys. Known follow-up: deep dialog/print labels (Payment link, Move, Void, PROVISIONAL BILL, Place of supply, STD/CP, "Yemeni") still English — low-priority polish, pre-existing. English mode now reads "Folio open/settled/closed" for the status. |

## Independent review (batch, 4649388..HEAD) — fixed + logged
Ran `bildfast-review` over the whole round-3 diff. Locked auth files confirmed untouched; all backend method names preserved (only safe additive arg `date` on `property_dashboard`/`portfolio_dashboard`, both Python sigs already default `date=None`).
- **[P0 — FIXED] Today crash on a "Ready" room.** `HK_META`/`HK_CYCLE` in `Today.tsx` predated the round-3 introduction of the "Ready" housekeeping state → `HK_META["Ready"].icon` = TypeError, taking down the front-desk cockpit; tapping a Ready room also mis-cycled it to Dirty. Fixed: `HK_META` is now `Record<string, HkMeta>` with a `?? HK_FALLBACK` (mirrors `roomCells`), added the "Ready" entry (DoorOpen/brand) + a Ready legend item, and `HK_CYCLE` now includes "Ready" (after Inspected) with an `indexOf < 0` guard. tsc 0, build green, auth 5/5.
- **[P2 — FIXED] Reservation statuses leaked English in AR.** `Pending Payment`, `Held`, `Quoted`, `Requested` are real Reservation statuses (confirmed in the doctype) with no `ar.ts` key. Added the 4 keys + gave `Held`/`Quoted`/`Requested` proper icon+colour entries in `reservationStatusCell` (were hitting the zinc fallback). Also added missing aria-label keys (`Loading billing/folio/dashboard/calendar`, `View`) and removed a dead `Missed` entry from `statusCells`.
- **[P1 — LOGGED for backend] Client-side aggregate caps (extends the Billing finding).** Same root cause as the logged Billing "Outstanding balance": **Billing "Open folios" + "Folios" counts** (list-capped at 100) and **Guests "VIPs" / "Returning" / "Lifetime value" tiles** (capped at 200; the Total tile already shows "200+"). Fix (backend): small aggregate endpoints (`billing_summary`, guest-stats totals) computed over the full set; the frontend reads the KPI from them. Frontend can't fix without changing the list scope.
- **Verified clean by the review:** a11y (colour+icon+text pills, role=img charts, real buttons w/ min-h-11), RTL (only 6 pre-existing physical props remain), date math (CRS UTC fix correct), div-by-zero guards, list keys. No further P0/P1 in those areas.

## Backend finding — systemic ₹ (rupee) currency symbol + English server strings
Found while verifying **GuestJourney** (`/guests/:name`). The frontend is already strong (translated labels, `cur()` = ر.س, KPI header, stay-status timeline, notes/VIP, GDPR profile actions) — but the **backend** leaks:
- **[P1] 38 hardcoded `₹` (Indian rupee) symbols in server-generated money strings** — a SAR product must never render ₹. Occurrences: `api.py`×15 (guardrail messages, rate suggestions, advance/charge rationales, refund errors, `guest_journey` "Folio ₹…"), `folio.py`×5, `banquet.py`×5, `public_api.py`×4, `payments.py`×2, `inventory.py`×2, `laundry.py`, `assistant.py`, `menu_import.py`. Effect: guest-journey details, folio/payment messages, assistant replies, public API and revenue-guardrail toasts all show ₹ instead of ر.س. **Fix (backend):** replace the hardcoded `₹` with the property currency symbol (a `money(amount, property)` helper), everywhere. This is the single most visible currency defect in the product.
- **[P2] `guest_journey` builds English event titles/details** ("Booked …", "Checked in · Room …", "Checked out", "Booking cancelled", "via {channel}") that reach the AR journey timeline untranslatable (they're server strings, not observer-reachable). **Fix (backend):** emit structured event `type` + fields (already partly present) and let the frontend render/translate the label, OR localise server-side.

Frontend verdict: GuestJourney needs **no rebuild** — only the backend journey/currency fixes above.

## Health sweep of remaining custom screens (Pkg 9–10) — 2026-09-07
Verified live (1440 AR, Hotel Admin `gm@`). All structurally sound: RTL correct, no horizontal overflow, only the benign socket.io 400 in console, no ₹ leak in-page (₹ is backend-string-only, logged above).
- **`/reports` (ملخص المدير)** — English KPI **subtitles** leak (room rate / room sold · total spend / guest · RevPAX explanation · Last 14 days · Month to date). → being fixed (i18n polish agent).
- **`/revenue-reports`** — checked in the same polish pass.
- **`/tickets` (تذاكر الخدمة)** — healthy; the English seen is user-entered ticket content (guest requests), not UI chrome.
- **`/laundry` (المغسلة)** — healthy; no label leaks.
- **`/settings` (المنشأة)** — structurally fine; scattered UI-label leaks remain (e.g. "Slab threshold", "staff", "Your … data model", "book"; proper-noun integrations TripAdvisor/Razorpay/Frappe/Webhook are acceptable). Also note **Razorpay** appears as a payment option — an India-market gateway; a Saudi/SAR product likely wants a regional PSP (config/backend decision).

**Deep-screen label-i18n backlog (frontend polish, lower priority):** a long tail of scattered English UI labels remains on the Pkg 9–10 config/report/admin screens (Settings, Revenue, Assistant, Marketplace, Channel Manager, Developers, Setup, etc.). None are broken — RTL/overflow/console all clean — they just need exact-match `ar.ts` keys (or `fill()` for interpolated labels). Best done as a dedicated i18n sweep, one owner for `ar.ts`, after the higher-value screens (all done). The marquee operational/financial/guest/calendar surfaces are complete.
