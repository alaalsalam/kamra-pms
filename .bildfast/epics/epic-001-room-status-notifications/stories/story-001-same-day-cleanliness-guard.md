---
bildfast: story
id: "001"
epic: epic-001-room-status-notifications
slug: same-day-cleanliness-guard
title: Same-day cleanliness guard at assignment & check-in (+ "Ready" status fix)
status:
  frontend: todo
  backend: todo
  unit_tests: todo
  ui_tests: todo
  approved: false
depends_on: []
touches:
  - apps/hotelpms/hotelpms/hotelpms/doctype/reservation/reservation.py
  - apps/hotelpms/hotelpms/hotelpms/doctype/reservation/test_reservation.py
  - apps/hotelpms/hotelpms/turnover.py
  - apps/hotelpms/hotelpms/allocation.py
  - apps/hotelpms/hotelpms/api.py
  - apps/hotelpms/hotelpms/tests/test_room_cleanliness.py
  - apps/hotelpms/frontend/src/components/CheckInDialog.tsx
  - apps/hotelpms/frontend/src/screens/PublicCheckin.tsx
  - apps/hotelpms/frontend/src/screens/configs.ts
  - apps/hotelpms/frontend/src/lib/api.ts
contracts_used: ["api-spec#check_in", "api-spec#swap_room", "data-models#Room"]
ui_flows: []
size: L
created: 2026-09-06
updated: 2026-09-06
---

## User Story
**As a** Front Desk agent, **I want** to be warned (and offered a clean, Ready room to swap to) when the
room I'm about to assign or check a guest into is *dirty right now*, **so that** no guest is walked to a
room that hasn't been cleaned since the last checkout.

## Overview
Wire the already-existing-but-dead `turnover.room_is_ready()` helper into the two moments where
cleanliness actually matters: **same-day room assignment** and **check-in**. When the target room is not
ready (housekeeping_status not in Ready / Clean / Inspected), Front Desk sees a warning and a one-click
path to swap the reservation to another Ready room of the same type; they may still override and check in
with an explicit confirmation. Future-dated availability is untouched — a room dirty today stays fully
bookable for next month. Also fixes the "Ready" status omission in the rooms config dropdown and the
frontend Room type so the UI can display and select the real status the doctype already uses.

## Acceptance Criteria

**Binding (contract-level — cover with regression tests):**
- [ ] `handle_check_in` (reservation.py) calls `turnover.room_is_ready(self.room)` and, when the room is
      **not** ready, does **not** silently proceed: it surfaces a "room not ready" condition to the caller
      (warning + swap offer), not a bare success. Ready semantics = housekeeping_status in
      `("Ready", "Clean", "Inspected")` (as `room_is_ready` already defines).
- [ ] **Future availability is UNCHANGED:** a room that is Dirty *today* is still returned as bookable for
      a stay that starts in the future. The cleanliness guard fires **only** for same-day/imminent
      assignment and at check-in — `available_rooms` for future date ranges must not start excluding Dirty
      rooms. (Explicit regression test required.)
- [ ] Same-day auto-assignment (`create_booking` → allocation) prefers a **Ready** room; if none of the
      free same-day rooms is ready, assignment still succeeds but the reservation/response is flagged so
      Front Desk is warned rather than the dirty room being chosen silently.
- [ ] A new whitelisted endpoint (proposed `api-spec#swap_room`, e.g. in `turnover.py`) reassigns a
      reservation to another **Ready** room of the same room type, starts with an access check
      (`frappe.has_permission` / Front Desk role), validates the target room is Ready and free for the
      dates, and returns the new room. It does **not** use `ignore_permissions=True` for the user action.
- [ ] Front Desk may **override** the warning and check in anyway via an explicit confirmation
      (see epic Notes decision); the override is the only way a not-ready room gets occupied, and it is
      recorded (e.g. via the existing `log_action`).

**Hint-level (developer MAY deviate — record deviations in Implementation notes):**
- [ ] `CheckInDialog.tsx` shows the not-ready warning inline with a "Swap to a Ready room" action and an
      "Check in anyway" confirm; exact component/lay-out is the developer's call.
- [ ] `PublicCheckin.tsx` guest self-check-in degrades to a "please see the front desk" message when the
      assigned room is not ready (it must not block the whole flow or seat silently).
- [ ] **E1 fix:** add `"Ready"` to the room housekeeping-status options in `screens/configs.ts`
      (both the filter list ~line 20 and the edit-form select ~line 36) **and** to the
      `housekeeping_status` union type in `lib/api.ts` (~line 202). "Ready" is existing doctype/turnover
      behavior; this only surfaces it in the UI (documenting it lives in story 004).

## Test Cases
**Unit:**
- `test_reservation.py` — checking in a reservation whose room is Dirty raises/returns the not-ready
  signal (happy path: a Ready room checks in cleanly; error path: Dirty room is guarded).
- `test_room_cleanliness.py` — (a) **regression:** a Dirty room is still in `available_rooms` for a
  future date range; (b) `swap_room` moves a reservation to a Ready same-type room and rejects a
  swap to a Dirty or occupied room; (c) `swap_room` denies a caller without Front Desk permission.
- `test_reservation.py` — override path: an explicit override checks the guest into a not-ready room and
  logs the action.
**UI-flow:**
- Front Desk → open Check-in for a reservation on a Dirty room → sees the not-ready warning → clicks
  "Swap to a Ready room" → reservation now shows the new Ready room → check-in succeeds.
- Admin → Rooms screen → edit a room → the housekeeping-status dropdown now lists **Ready** and it can be
  selected and saved.

## Implementation notes
_Filled by the developer during the build — decisions, gotchas, and any deviation from a hint-level
acceptance criterion. (Empty at planning time.)_

## Changelog
_Dated, newest first — the done-gate reads this._
- 2026-09-06 — Story drafted.
