<!-- bildfast:contract-change id=0001 status=proposed target=api-spec#swap_room -->

# Contract change 0001 — same-day cleanliness guard + room swap

**Epic:** epic-001-room-status-notifications · **Story:** 001
**Targets:** `api-spec#swap_room` (new), `api-spec#check_in` (changed behavior), `data-models#Room` (clarify status value)

## Why
`turnover.room_is_ready()` exists but has zero callers; `handle_check_in` only errors on a *missing*
room, and `available_rooms` excludes only Occupied / Out of Order — so a **Dirty** room can be assigned
and checked into silently. We add a cleanliness guard at the two moments it matters (same-day assignment
+ check-in) and an endpoint to swap to a Ready room. Future availability stays unchanged.

## Proposed api-spec sections

### `## swap_room` (new)
- `hotelpms.turnover.swap_room(reservation, target_room)` — reassign a reservation to another **Ready**
  room of the same room type. Access-checked (Front Desk / `write` on Reservation). Validates the target
  room is Ready (`housekeeping_status in (Ready, Clean, Inspected)`) and free for the stay dates.
  Returns the new room. Rejects a swap to a Dirty / Out of Order / occupied room.

### `## check_in` (changed behavior — document current + new)
- `Reservation.handle_check_in()` requires an assigned room, opens the folio, sets the room
  `occupancy_status=Occupied`. **New:** it checks `turnover.room_is_ready(room)`; a not-ready room yields
  a warning + swap offer to Front Desk rather than a silent proceed. Front Desk may override and check in
  anyway with explicit confirmation (the override is logged via `log_action`). **Same-day assignment**
  (`create_booking` → `allocation.apply_allocation`) prefers a Ready room and flags the reservation when
  no free same-day room is ready. **Future-dated availability is unchanged** — Dirty is never excluded
  from future `available_rooms`.

## Proposed data-models clarification
- `data-models#Room` — `housekeeping_status` includes **Ready** (used by `turnover.mark_room_ready`) in
  addition to Clean / Dirty / Inspected / Out of Order. (Full backfill in proposal 0004.)
