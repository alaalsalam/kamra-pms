<!-- bildfast:contract-change id=0002 status=proposed target=api-spec#search_stay -->

# Contract change 0002 — sold-out booking conflict → change-dates + notify

**Epic:** epic-001-room-status-notifications · **Story:** 002
**Targets:** `api-spec#search_stay` (changed response), `api-spec#book` (changed behavior)

## Why
When the requested room type has no inventory for the dates, the guest currently gets only a desk-side
`frappe.throw` — no alternatives, no guest notification (the guest is messaged only on a *successful*
booking). We turn the sold-out case into an actionable response so the guest can change dates
(*حتى يستطيع تغيير التاريخ*), plus a Front Desk conflict alert.

## Proposed api-spec sections

### `## search_stay` (changed response)
- `hotelpms.public_api.search_stay(property, check_in_date, check_out_date, adults, children)` — returns
  live availability + quotes. **New:** when no inventory exists for the requested room type + dates, it
  returns a **structured sold-out result** carrying the **nearest available dates** for that room type
  (so the booking page can render clickable alternatives) instead of only throwing.

### `## book` (changed behavior)
- `hotelpms.public_api.book(...)` — creates a direct reservation. **New sold-out behavior:** fires a
  Front Desk conflict alert via `realtime.notify` / `publish_realtime("hotelpms_changed")`; when a
  phone/booking context exists (desk-initiated or waitlisted), sends the guest a WhatsApp with the nearest
  dates via `agents_channels.send_outbound` (non-blocking on failure). Reuses the existing
  `create_booking(waitlist=1)` park path (status "Waitlist", no room) when the guest opts to wait. All
  new inputs validated; response limited to public booking data.
