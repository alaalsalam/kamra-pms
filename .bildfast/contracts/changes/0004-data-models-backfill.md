<!-- bildfast:contract-change id=0004 status=proposed target=data-models#Room -->

# Contract change 0004 — data-models backfill (room status + housekeeping entities)

**Epic:** epic-001-room-status-notifications · **Story:** 004
**Targets:** `data-models#Room`, `data-models#Housekeeping Task`, `data-models#Service Ticket`,
`data-models#Lost And Found Item`, `data-models#Laundry Order`

## Why
The shipped room-status + housekeeping data model is undocumented in `data-models.md`. This backfills the
entities this epic depends on so future stories plan from an accurate map.

## Proposed data-models sections

### `## Room` (expand)
- Physical room attached to a Property + Room Type. Live state fields:
  - `housekeeping_status`: **Ready | Clean | Dirty | Inspected | Out of Order** (Ready/Clean/Inspected =
    ready to sell; Dirty = needs cleaning; Out of Order = unsellable). `turnover.mark_room_ready` sets
    Ready; checkout sets Dirty; a Done Housekeeping Task sets Clean.
  - `occupancy_status`: **Vacant | Occupied** (checkout → Vacant; check-in → Occupied).

### `## Housekeeping Task`
- Cleaning / inspection / maintenance work item. Fields: `property`, `room`, `reservation` (link),
  `task_type` (**Checkout Clean | Stayover Clean | Deep Clean | Inspection | Maintenance**), `priority`,
  `status` (**Pending | In Progress | Done | Verified**), assignee (on directed dispatch). Auto-created on
  checkout; `status→Done` sets the room Clean (turnover → Ready/Inspected). Workflow via the `hk_*` APIs.

### `## Service Ticket`
- Guest request / room need / maintenance ticket. Created via `create_ticket`; advanced via
  `advance_ticket`; a Maintenance ticket auto-spawns a Maintenance Housekeeping Task. Status Open/Closed
  (+ workflow states). Surfaced in the Tickets screen.

### `## Lost And Found Item`
- Item logged by housekeeping via `hk_log_item`. Fields: description, condition (Found/…), status
  (**In Storage | Returned | Disposed**), property/room context.

### `## Laundry Order`
- Guest/room laundry order (Laundry Order + Laundry Item + Laundry Rate). Managed via `laundry.py`;
  surfaced in the Laundry / HK Laundry screens.
