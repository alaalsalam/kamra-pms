---
bildfast: story
id: "004"
epic: epic-001-room-status-notifications
slug: backfill-contracts
title: Backfill the data-model & API contracts (repay contract debt)
status:
  frontend: n/a
  backend: n/a
  unit_tests: todo
  ui_tests: todo
  approved: false
depends_on: ["001", "002", "003"]
touches:
  - apps/hotelpms/.bildfast/contracts/data-models.md
  - apps/hotelpms/.bildfast/contracts/api-spec.md
contracts_used: ["data-models#Room", "data-models#Housekeeping Task", "data-models#Service Ticket", "data-models#Lost And Found Item", "data-models#Laundry Order", "api-spec#check_in", "api-spec#check_out", "api-spec#set_housekeeping_status", "api-spec#hk_task_apis"]
ui_flows: []
size: S
created: 2026-09-06
updated: 2026-09-06
---

## User Story
**As a** Front Desk / operations owner (and any future story planner), **I want** the `contracts/*` docs
to actually describe the shipped room-status + housekeeping + notification behavior, **so that** future
work plans from an accurate map instead of the current thin, behind-the-code contracts.

## Overview
The requested behaviors are already implemented but undocumented — the `contracts/*` files are thin and
behind the code. This is the closing reconciliation story of the epic: it lands the **five contract-change
proposals** authored under `.bildfast/contracts/changes/` (0001–0005) into the frozen contract files, and
folds in any *as-built* deviations recorded in stories 001–003's Implementation notes so the contracts
match what actually shipped. It writes **no application code** (both build tracks are documentation only);
verification is a manual spot-check of the documented anchors against the code.

## Acceptance Criteria

**Binding:**
- [ ] All five approved proposals are applied to the contract files:
      `0001` (check-in cleanliness guard + `swap_room`), `0002` (sold-out search_stay/book response +
      change-dates + notify), `0003` (directed checkout dispatch + HK task assignment), `0004`
      (data-models backfill), `0005` (api-spec backfill).
- [ ] `data-models.md` documents: **Room** `housekeeping_status` (values incl. **Ready** — the value the
      doctype + `turnover.mark_room_ready` already use — plus Clean / Dirty / Inspected / Out of Order)
      and `occupancy_status` (Vacant / Occupied); **Housekeeping Task** (task_type, priority, status
      Pending/In Progress/Done/Verified, assignment, reservation/room links); **Service Ticket**;
      **Lost And Found Item**; **Laundry Order** — each with the fields that carry meaning.
- [ ] `api-spec.md` documents the shipped operational surface referenced by this epic: the `hk_*` task
      APIs (`hk_queue`, `hk_assign_task`, `hk_claim_task`, `hk_accept_task`, `hk_reject_task`,
      `hk_update_task`, `hk_post_consumable`, `hk_log_item`), `create_ticket` / `tickets_list` /
      `advance_ticket`, `set_housekeeping_status`, reservation check-in / check-out behavior, and the
      realtime (`hotelpms_changed`) + WhatsApp (`agents_channels.send_outbound`) notification behavior.
- [ ] Each documented anchor is **spot-verified against the code** (function exists at the cited module;
      status values match the doctype JSON); as-built deviations from stories 001–003 are reflected.
- [ ] No application code, doctype JSON, or frontend is changed by this story (docs only).

## Test Cases
**Unit:**
- n/a — documentation-only story (no application code to unit-test).
**UI-flow:**
- n/a — documentation-only story (no UI to drive).

_Verification is a manual spot-check: each `api-spec#` anchor names a function that exists in the cited
module, and each `data-models#` status/field set matches the doctype JSON._

## Implementation notes
_Filled by the developer during the build — decisions, gotchas, and any deviation from a hint-level
acceptance criterion. (Empty at planning time.)_

## Changelog
_Dated, newest first — the done-gate reads this._
- 2026-09-06 — Story drafted.
