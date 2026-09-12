<!-- bildfast:contract-change id=0003 status=proposed target=api-spec#check_out -->

# Contract change 0003 — directed housekeeper dispatch on checkout

**Epic:** epic-001-room-status-notifications · **Story:** 003
**Targets:** `api-spec#check_out` (changed behavior), `data-models#Housekeeping Task` (assignment)

## Why
`handle_check_out` already sets the room Vacant+Dirty and auto-creates a "Checkout Clean" Housekeeping
Task — but **Unassigned** (pull/claim queue); the housekeeper is only WhatsApped on SLA breach. We add an
optional directed dispatch so a housekeeper gets a proactive *"نظّف الغرفة ٩ / Clean room 9"* alert
immediately, through the existing channels only.

## Proposed api-spec section

### `## check_out` (changed behavior)
- `Reservation.handle_check_out()` posts remaining nights, sets the room
  `occupancy_status=Vacant, housekeeping_status=Dirty`, and creates a High-priority "Checkout Clean"
  Housekeeping Task linked to the reservation. **New:** when the property has **auto-dispatch** enabled,
  the task is assigned to an on-shift housekeeper (chosen among `Housekeeping`-role users) and a proactive
  **bilingual (Arabic-default)** alert naming the room is emitted through **both existing channels only** —
  `publish_realtime("hotelpms_changed")` (refreshes the HK app) and `agents_channels.send_outbound`
  (WhatsApp). WhatsApp failure is non-blocking. When auto-dispatch is off, the task is created Unassigned
  exactly as today. **No FCM / native push / notification center.**

## Proposed data-models clarification
- `data-models#Housekeeping Task` — records an **assignee** (the on-shift housekeeper) when auto-dispatch
  is on; otherwise Unassigned (claimable). (Full backfill in proposal 0004.)
