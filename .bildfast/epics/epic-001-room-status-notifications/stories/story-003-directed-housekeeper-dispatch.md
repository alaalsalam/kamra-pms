---
bildfast: story
id: "003"
epic: epic-001-room-status-notifications
slug: directed-housekeeper-dispatch
title: Directed housekeeper dispatch on checkout
status:
  frontend: todo
  backend: todo
  unit_tests: todo
  ui_tests: todo
  approved: false
depends_on: []
touches:
  - apps/hotelpms/hotelpms/hotelpms/doctype/reservation/reservation.py
  - apps/hotelpms/hotelpms/hotelpms/doctype/housekeeping_task/housekeeping_task.py
  - apps/hotelpms/hotelpms/hotelpms/doctype/housekeeping_task/test_housekeeping_task.py
  - apps/hotelpms/hotelpms/agents_channels.py
  - apps/hotelpms/hotelpms/realtime.py
  - apps/hotelpms/frontend/src/screens/HkApp.tsx
  - apps/hotelpms/frontend/src/lib/api.ts
contracts_used: ["api-spec#check_out", "data-models#Housekeeping Task", "data-models#Room"]
ui_flows: []
size: M
created: 2026-09-06
updated: 2026-09-06
---

## User Story
**As a** Housekeeper, **I want** a proactive *"نظّف الغرفة ٩ / Clean room 9"* alert on my device the
moment a guest checks out, **so that** I can go clean the room right away instead of waiting to notice it
in the pull queue (or waiting for an SLA-breach escalation).

## Overview
Today `handle_check_out` auto-creates the "Checkout Clean" Housekeeping Task **Unassigned** (pull/claim
queue) and the housekeeper is only WhatsApped later on SLA breach. This story adds an **optional directed
dispatch**: when a property has auto-dispatch enabled, the new checkout task is assigned to an on-shift
housekeeper and a proactive bilingual alert goes out immediately through the **existing** channels
(`publish_realtime("hotelpms_changed")` refreshes the HK phone app; `agents_channels.send_outbound` sends
the WhatsApp). When auto-dispatch is off, behavior is unchanged (today's claim queue). No FCM / native
push / notification center.

## Acceptance Criteria

**Binding (contract-level — cover with tests):**
- [ ] When auto-dispatch is enabled for the property, the "Checkout Clean" task created by
      `handle_check_out` is **assigned** to an on-shift housekeeper (see epic Notes decision for how the
      housekeeper is chosen) instead of being left Unassigned; when disabled, the task is created
      Unassigned exactly as today (no regression to the existing claim flow).
- [ ] On dispatch, a proactive alert is emitted through **both existing channels only**:
      `publish_realtime` (so `lib/realtime.ts` refreshes the HK app) **and**
      `agents_channels.send_outbound` (WhatsApp to the assigned housekeeper). No new channel, no FCM /
      native push, no in-app notification center.
- [ ] The alert message is **bilingual with Arabic as the default** and names the room, e.g.
      *"نظّف الغرفة 9 / Clean room 9"*.
- [ ] WhatsApp send failure is **non-blocking** — a failed send must not roll back the checkout or the
      task creation (mirror `send_outbound`'s existing no-channel behavior).
- [ ] The dispatch/assignment reuses the existing HK task workflow (it does not bypass or duplicate
      `hk_assign_task`'s assignment semantics); no `ignore_permissions` abuse beyond the existing
      system-created-task pattern.

**Hint-level (developer MAY deviate):**
- [ ] `HkApp.tsx` visibly distinguishes a **directed (assigned-to-me)** task from a claimable queue task
      (e.g. a badge / highlighted row); exact treatment is the developer's call.
- [ ] The auto-dispatch toggle + housekeeper-selection default follow the epic Notes decision
      (property-level toggle + pick among `Housekeeping`-role users, round-robin/least-loaded); a simpler
      or better mechanism is acceptable if recorded in Implementation notes.

## Test Cases
**Unit:**
- `test_reservation.py` / `test_housekeeping_task.py` — checkout with auto-dispatch **on** creates a
  "Checkout Clean" task **assigned** to a housekeeper and emits the realtime + outbound alert (mock the
  provider); checkout with auto-dispatch **off** creates the task **Unassigned** (regression) and does
  not send a directed alert.
- `test_housekeeping_task.py` — a failing/unavailable WhatsApp channel does not block task creation
  (the task still exists and the checkout completes).
**UI-flow:**
- Housekeeper → HkApp → after a checkout with auto-dispatch on → the "Clean room N" task appears assigned
  to them (directed) without them claiming it, and is visually distinct from queue tasks.

## Implementation notes
_Filled by the developer during the build — decisions, gotchas, and any deviation from a hint-level
acceptance criterion. (Empty at planning time.)_

## Changelog
_Dated, newest first — the done-gate reads this._
- 2026-09-06 — Story drafted.
