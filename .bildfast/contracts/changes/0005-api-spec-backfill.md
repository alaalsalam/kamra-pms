<!-- bildfast:contract-change id=0005 status=proposed target=api-spec#hk_task_apis -->

# Contract change 0005 — api-spec backfill (housekeeping, room status, notifications)

**Epic:** epic-001-room-status-notifications · **Story:** 004
**Targets:** `api-spec#hk_task_apis`, `api-spec#set_housekeeping_status`, `api-spec#check_in`,
`api-spec#check_out`, `api-spec#notifications`

## Why
The shipped operational APIs + notification behavior this epic reuses are undocumented in `api-spec.md`.
Backfill them so stories can cite real anchors. All are authenticated + permission-gated (housekeeping
lives in `hotelpms.api`).

## Proposed api-spec sections

### `## hk_task_apis`
- `hotelpms.api.hk_queue(property)` — the housekeeping board / task queue for a property.
- `hotelpms.api.hk_assign_task(task, user)` / `hk_claim_task(task)` / `hk_accept_task(task)` /
  `hk_reject_task(task, reason)` — task assignment + accept/reject workflow.
- `hotelpms.api.hk_update_task(task, status)` — advance a task (Pending → In Progress → Done → Verified);
  Done drives the room back to Clean/Ready via the turnover flow.
- `hotelpms.api.hk_post_consumable(room, charge_type, description, ...)` — post a consumable charge.
- `hotelpms.api.hk_log_item(property, item_description, condition, ...)` — log a Lost And Found Item.
- `hotelpms.api.create_ticket(property, subject, category, ...)` / `tickets_list(property, show_closed)` /
  `advance_ticket(ticket, status, resolution_note)` — guest requests / room needs; a Maintenance ticket
  auto-spawns a Maintenance Housekeeping Task.

### `## set_housekeeping_status`
- `hotelpms.api.set_housekeeping_status(room, status)` — set a room's `housekeeping_status`
  (Ready / Clean / Dirty / Inspected / Out of Order); permission-gated.

### `## check_in` / `## check_out`
- Reservation `handle_check_in` / `handle_check_out` behavior — see proposals 0001 and 0003 for the
  current behavior + this epic's changes; document the as-built result here.

### `## notifications`
- Realtime: `hooks.doc_events` → `realtime.notify` → `publish_realtime("hotelpms_changed")` for
  Reservation / Room / Housekeeping Task / Service Ticket / Laundry Order, etc.; the frontend
  `lib/realtime.ts` subscribes via socket.io with a ~25s polling fallback.
- WhatsApp: `whatsapp.py` + `agents_channels.send_outbound(property, channel, to, body, agent_name=...)`;
  non-blocking when no active channel exists. Used for booking-confirm, HK SLA escalation,
  room-ready-to-front-desk, and (this epic) sold-out alternatives + directed-clean dispatch.
