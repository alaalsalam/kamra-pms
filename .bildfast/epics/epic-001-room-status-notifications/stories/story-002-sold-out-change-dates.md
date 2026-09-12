---
bildfast: story
id: "002"
epic: epic-001-room-status-notifications
slug: sold-out-change-dates
title: Sold-out booking conflict → notify guest & offer change-dates
status:
  frontend: todo
  backend: todo
  unit_tests: todo
  ui_tests: todo
  approved: false
depends_on: []
touches:
  - apps/hotelpms/hotelpms/public_api.py
  - apps/hotelpms/hotelpms/tests/test_public_booking.py
  - apps/hotelpms/hotelpms/realtime.py
  - apps/hotelpms/hotelpms/agents_channels.py
  - apps/hotelpms/frontend/src/screens/PublicBooking.tsx
  - apps/hotelpms/frontend/src/lib/api.ts
contracts_used: ["api-spec#search_stay", "api-spec#book", "data-models#Reservation", "data-models#Room Type"]
ui_flows: []
size: M
created: 2026-09-06
updated: 2026-09-06
---

## User Story
**As a** Guest booking online, **I want** to be told when my chosen dates are sold out and shown the
nearest available dates (or a way to change my dates), **so that** I can still complete a stay instead of
hitting a dead-end — *حتى أستطيع تغيير التاريخ*.

## Overview
Today, when the requested room type has no inventory for the dates, the guest only gets a thrown error
(and is messaged only on a *successful* booking). This story turns the sold-out case into a helpful,
actionable response: the public booking page shows a "these dates are sold out — here are the nearest
available dates / change your dates" panel, Front Desk gets a realtime conflict alert, and — when a
phone/booking context exists — the guest gets a WhatsApp with the alternatives. It reuses the existing
`create_booking(waitlist=1)` park path and the `agents_channels.send_outbound` / realtime channels; no
new notification infrastructure.

## Acceptance Criteria

**Binding (contract-level — cover with tests):**
- [ ] When `search_stay` / `book` (public_api.py) find no inventory for the requested room type + dates,
      the response is a **structured sold-out result** (proposed `api-spec#search_stay` / `api-spec#book`
      change) — not only a bare `frappe.throw` — carrying nearest-available alternative dates for that
      room type so the frontend can render options.
- [ ] The sold-out path fires a **Front Desk conflict alert** via `realtime.notify` /
      `publish_realtime("hotelpms_changed")` (reusing the existing backbone), so the desk sees the
      conflict live.
- [ ] A guest WhatsApp is sent via `agents_channels.send_outbound` **only when a phone/booking context
      exists** (desk-initiated booking or a waitlisted stay) — never a blank/guestless send; failure to
      send is non-blocking (mirrors `send_outbound`'s existing no-channel behavior).
- [ ] Reuse the existing `create_booking(waitlist=1)` behavior to park a sold-out stay (status
      "Waitlist", no room) when the guest opts in — no new waitlisting mechanism is introduced.
- [ ] All new/changed public inputs are validated and remain limited to public booking data
      (per the api-spec "public endpoints" rule); no private data is exposed to the guest.

**Hint-level (developer MAY deviate):**
- [ ] `PublicBooking.tsx` renders a "sold out — nearest dates / change dates" panel (with the returned
      alternatives clickable to re-run the search); exact copy/layout and whether a waitlist opt-in is a
      button or a checkbox are the developer's call, kept bilingual (Arabic default) and RTL-safe.
- [ ] `lib/api.ts` typed wrapper(s) for the sold-out response shape.

## Test Cases
**Unit:**
- `test_public_booking.py` — searching sold-out dates returns the structured sold-out result with nearest
  available dates (happy path: available dates return a normal quote; sold-out path returns alternatives).
- `test_public_booking.py` — a sold-out `book` with a phone context triggers `send_outbound` (mock the
  provider) and a realtime notify; a guestless/phoneless sold-out search does **not** attempt a send.
- `test_public_booking.py` — opting into waitlist parks a Reservation with status "Waitlist" and no room.
**UI-flow:**
- Guest → PublicBooking → choose sold-out dates → sees the "sold out / nearest dates" panel → clicks a
  suggested date → the search re-runs and shows availability for the new dates.

## Implementation notes
_Filled by the developer during the build — decisions, gotchas, and any deviation from a hint-level
acceptance criterion. (Empty at planning time.)_

## Changelog
_Dated, newest first — the done-gate reads this._
- 2026-09-06 — Story drafted.
