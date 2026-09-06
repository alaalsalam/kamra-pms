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
| Dashboard `/dashboard` | v2-02 | _next_ | |
| Apps launcher `/apps` | — | _pending_ | |
