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
| Rooms (`/rooms`) | (resource pattern) | _pending_ | (check 4eb291b coverage first) |
| Booking modal + room selection | v2-06 | _pending_ | |

Before/after screenshots: `./before/` and `./after/` (1440 / 1024 / 390, AR + EN).
