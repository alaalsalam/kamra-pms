# Performance Review

_Written by the **performance** agent: issues found, severity, and fixes applied or recommended._

## Findings

### Product runtime

- **[HIGH, fixed 2026-09-04] Cross-persona session residue:** the client swallowed a failed logout and
  immediately painted an anonymous state even if the server cookie survived. Logout now has a server-side
  `whoami` postcondition, keeps the user signed in with an error when termination fails, clears the selected
  property, and hard-reloads the SPA after success. Playwright verified Finance → Guest → Restaurant POS and
  direct-route denial for `/billing`.
- **[HIGH, fixed] Inconsistent module navigation:** shell, launcher, command palette and route guard did not
  share the same `Property.enabled_modules` value. A shared/unowned route also fell back visually to the first
  allowed app. They now use one cached/in-flight module loader; route access enforces `role ∩ enabled module`;
  `/apps` has neutral navigation instead of borrowing the first app's sidebar.
- **[HIGH, fixed] Public booking unavailable after nightly reset:** reset deleted the governed writer account.
  The account is now preserved and repaired by every demo seed; public booking was verified live with
  `RES-2026-01105`.
- **[MEDIUM] Main frontend chunk:** current production build reports ~545 kB minified / ~166 kB gzip for the
  shared index. Screens are already lazy-loaded; a future pass should split command/search and large shared
  registries, then compare cold-load LCP before/after rather than changing the warning threshold.

### BildFast execution path review

- The prior UI round completed useful work but consumed about **69.5 minutes, 197 turns, 179k output tokens
  and $83.63**, with no delegated agents, while explicitly leaving backend/RBAC/session flows untested.
- For future improvement rounds: begin with one smoke matrix (Guest + each demo persona), split visual and
  auth/data tracks, cap each track to a concrete screen list, reuse a single browser session, and preserve a
  small evidence manifest (URL, role, viewport, console/network errors). Run `tsc`, the targeted Playwright
  spec and one public booking probe before declaring the round complete.
- Do not repeatedly regenerate broad project context after `.bildfast/project-memory.md` is current. Read the
  memory plus only the files owning the selected flow, then append verified deltas once.

## Calendar/Dashboard/Rooms performance audit (2026-09-04)

_Read-only request-path audit of the endpoints behind the Calendar, Tape Chart, Dashboards and Rooms
screens. Per the audit instruction **nothing was changed** — every item below is a recommendation, not an
applied fix. Query counts are derived from the code and expressed against the current demo DB scale
(Reservation 16, Room 24, Room Type 9, Sellable Unit 25, Property 3, Folio 5, Folio Charge 0,
Folio Payment 0). The demo is tiny, so none of this is visible today — the risk is the query **pattern**,
which scales with room-types × days × properties × reservations at production volume._

### availability_calendar — `hotelpms/api.py:2565` — [HIGH, recommended]
- **N+1 full-doc load per room type.** `frappe.get_doc("Room Type", rt.name)` at line 2586 loads a complete
  Room Type doc for every type, purely to feed `occupancy_rate` — which only reads `base_price`,
  `single_occupancy_price`, `base_occupancy`, `extra_adult_price`, `child_price`. Cost: 9 doc loads / render.
  **Fix:** add those 5 fields to the `frappe.get_all("Room Type", …)` already at line 2575 and drop the
  per-row `get_doc` → 0 extra queries.
- **`season_adjust` per cell = Room Types × Days Season queries.** Called at lines 2596 and 2623 inside the
  date loop (`pricing.season_adjust`, `hotelpms/pricing.py:88`, one `frappe.get_all("Season", …)` each).
  Cost: 9 × 14 = **126 Season queries** for a default 14-day render, up to 9 × 31 = 279 at `days=31`. The
  Season lookup depends only on `(property, date)`, not room type. **Fix:** fetch Seasons once for the
  `[start, end)` range and evaluate the priority + day-of-week logic in Python → collapses 126 → 1.
- **SIU path reloads the whole property per room type.** `has_active_sius` runs twice per type (line 2588,
  then again inside `capacity_by_night` at `hotelpms/siu/availability.py:119`), and each `capacity_by_night`
  calls `availability()`, which re-runs `_load_units` / `_load_bookings` / `_load_room_blocks` for the entire
  property (`siu/availability.py:47-53`). With SIUs live (25 units) that is the whole property's units +
  bookings + blocks reloaded 9× per render. **Fix:** call `availability()` once for all types and bucket the
  result per room type in Python.
- **Estimated total: ~200+ queries for one default calendar render**, dominated by `season_adjust`. This is
  the single hottest endpoint in the audit.

### property_dashboard — `hotelpms/dashboards.py:65` — [HIGH, recommended]
- **MTD day-loop N+1.** `manager_flash` (`hotelpms/reports.py:128-134`) calls `_day_stats` once per
  day-of-month, and each `_day_stats` runs 2 SQL aggregates (`reports.py:14` charges, `:38` pax). Cost grows
  through the month: 2 queries on the 1st → **62 queries on the 31st**. Plus the 7-day `outlook` loop
  (`reports.py:160-167`) = 7 more SQL. **Fix:** replace the day loop with one
  `GROUP BY posting_date` charge aggregate over `[month_start, date]` plus one reservation-overlap fetch
  expanded in Python for pax.
- **Redundant `cash_summary`.** `manager_flash` computes `collections = cash_summary(property, date)`
  (`reports.py:157`), but `property_dashboard` discards `flash["collections"]` and `_finance_slice`
  (`dashboards.py:47-48`, invoked at `:75`) recomputes `cash_summary(property, date)` with identical args —
  one wasted `Folio Payment` aggregate per load. **Fix:** pass flash's already-computed collections into the
  finance slice instead of recomputing.
- **Estimated total: ~75-80 queries per dashboard load near month-end.**

### tape_chart — `hotelpms/api.py:2637` — [MEDIUM, recommended]
- **Main grid is well batched** — rooms, room-type labels, bookings, VIP guests and room blocks are each a
  single `get_all` (~5 queries). No change needed there.
- **`position` day-loop is not** (lines 2723-2735). Per date it calls `forecast_occupancy` (Room count +
  reservation SQL = 2, `pricing.py:37`) and `demand_tier` (one `Hurdle Rate` get_all = 1, `pricing.py:53`) =
  3 queries/date → **42 at `days=14`, 93 at `days=31`**.
- **Wasted per-date COUNT.** `forecast_occupancy` re-runs `frappe.db.count("Room", …)` every iteration
  (`pricing.py:40`) even though `capacity = len(rooms)` is already known at line 2721 — D redundant COUNTs.
  **Fix:** hoist the room count (reuse `capacity`); fetch Hurdle Rates once and tier in Python; replace the
  per-date sold count with one grouped range SQL. Note: `forecast_occupancy` counts **unassigned**
  reservations too, so the room-filtered `bookings` list already fetched cannot be reused for this — use a
  dedicated `GROUP BY` range query to preserve semantics.

### tape_chart_hourly — `hotelpms/api.py:2933` — [OK]
- Well batched: rooms + room-type labels + one reservation fetch + VIP set = 4 queries, no per-row/date loop.
  No action.

### portfolio_dashboard — `hotelpms/dashboards.py:145` — [MEDIUM, recommended]
- **N+1 over properties.** `rows = [_property_summary(p, date) for p in props]` (line 151); each
  `_property_summary` (`dashboards.py:116`) runs ~10 queries — Room count, `_day_stats` (2 SQL),
  `cash_summary`, outstanding SQL, Folio count, 3× Reservation count, Property `get_value`. Cost: ~10 × P →
  **~30 at the demo's 3 properties, ~100+ for a 10-property chain**, and it also re-hits the same MTD-less
  `_day_stats` path per property. **Fix:** replace the per-property loop with `GROUP BY property`
  conditional-aggregation queries across the accessible property list.

### _competition_state (SIU availability) — `hotelpms/siu/availability.py:352` — [MEDIUM, recommended]
- **Per-booking N+1 on the SIU path.** `frappe.db.get_value("Room Type", rt, "room_category")` sits inside
  `for b in bookings` (lines 341-357), hit for every pre-migration reservation that has no `sellable_unit`.
  This runs under every `availability()` call (calendar SIU path, CRS, public search). **Fix:** build a
  `{room_type: room_category}` map with one `get_all` over the distinct room types before the loop.

### Rooms list — `ResourceScreen` → `/api/resource/Room` (`frontend/src/screens/configs.ts:9`) — [LOW]
- Already correct: `pageSize: 25` (paginated via `limit_start`), `propertyScoped: true` (filters
  `property = current`), standard Frappe `get_list` with permission checks
  (`frontend/src/lib/resource.ts:7`). Filters on `property` and orders by `room_number`, neither indexed
  (see below), but at 24 rooms this is invisible and would only matter at thousands of rooms per property.
  No action.

### Missing indexes on hot filter columns — [MEDIUM, recommended — production scale]
- Verified against the demo DB via `information_schema.STATISTICS`; the heavily-filtered columns are
  **unindexed**. Indexed columns per table today:
  - `tabReservation`: `name`, `creation` only — yet filtered everywhere on
    `property` + `status` + `check_in_date` + `check_out_date` + `room` + `guest`
    (tape_chart, availability_calendar, forecast_occupancy, `_load_bookings`, dashboard movement counts).
  - `tabFolio`: `name`, `creation` — filtered on `property` + `status`.
  - `tabFolio Charge`: `name`, `parent` — aggregated on `posting_date` + `charge_type` (`_day_stats`).
  - `tabFolio Payment`: `name`, `parent` — filtered/joined on `posting_date` + `mode` (`cash_summary`).
  - `tabRoom`: `name`, `creation` — filtered on `property` + `room_type`.
- Every date-range query above is currently a full table scan. Invisible at demo scale (16 reservations,
  0 folio charges); a real concern at production volume (tens of thousands of reservations, months of
  posted charges). **Recommended (via a patch that calls `frappe.db.add_index`, NOT `bench migrate` here):**
  - Reservation: composite `(property, status, check_in_date, check_out_date)` — the highest-leverage index,
    covers tape_chart / availability_calendar / forecast_occupancy / `_load_bookings` / dashboard counts.
  - Folio Charge: `(posting_date)` (parent already indexed) — `_day_stats`.
  - Folio Payment: `(posting_date)` — `cash_summary`.
  - Folio: `(property, status)`.
  - Room: `(property, room_type)`.
- Deliberately **not** recommending indexes on `Season` / `Hurdle Rate` — they are 2-row config tables where
  an index buys nothing and only adds write overhead.
