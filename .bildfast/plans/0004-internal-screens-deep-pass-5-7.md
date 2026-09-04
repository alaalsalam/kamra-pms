<!-- bildfast:plan id=0004 status=approved agent=bildfast task="Page-by-page UX deep pass: Calendar, Tape, BookingDialog (+ secondary-screen audit)" -->
# Plan: Internal screens deep pass — Calendar · Tape · BookingDialog

## Overview
Continuation of the binding page-by-page UX/UI pass (one screen at a time, verified live for
Front Desk + Hotel Admin, small commit each). This plan covers screens ⑤–⑦ and the follow-up
audit of the booking-connected secondary screens. Constraint honored throughout: **no changes to
pricing/quote/RBAC logic** — presentation, validation, states, and i18n only.

## Plan
- `@bildfast-frontend` (done inline): ⑤ **Calendar** (`CalendarView.tsx`) — error state + room-type
  filter; ⑥ **Tape** (`TapeChart.tsx`) — loading/empty/error states + clean filter labels via a
  shared `primaryLabel()` in `lib/dir.ts`; ⑦ **BookingDialog** (`BookingDialog.tsx`) — section
  headings, required marker + helper explaining the disabled Confirm, deposit summary line,
  Arabic-clean success message. Plus a page-2 defect repair (Housekeeping "Open tasks" deep link +
  filter status vocabulary).
- `@bildfast-backend`: one finding handed off — see `0003-release-deposit-on-cancel.md` (planned).

## Execution Note
Delivered + built + verified live (Front Desk + Hotel Admin), each its own commit; `.bildfast/checkpoints.jsonl`
never staged; `auth-isolation` e2e green after each.
- ⑤ Calendar — `2b62446`. Failed `availability_calendar` used to hang on the skeleton forever (no `.catch`);
  now error card + inline Retry over stale data + recovery; optional room-type filter. Verified incl. forced-
  failure recovery.
- ⑥ Tape — `bd8bbb3`. Same latent no-`.catch` bug fixed; added skeleton / error card / inline Retry / empty
  state (+ Clear filters); room-type dropdown cleaned to primary-language label. Verified both roles incl.
  empty (Executive+floor-1) and forced failure.
- ⑦ BookingDialog — `5ce1e49`. Visual sequence (Guest details / Stay & rate), required marker + `aria-required`,
  helper explaining the disabled Confirm, "Deposit due now" summary line (guard unchanged; not exercisable —
  all demo properties `deposit_pct=0`), and a fully-Arabic success panel. **No pricing/quote/payload change.**
  Create + real-UI-cancel verified from the bench: no money moved (fee 0, folio 0, charges 0, advance 0). One
  pre-existing backend finding recorded → plan `0003` (uncollected Required deposit not released on cancel).
- Housekeeping deep-link/filter repair — `c5274f2`. Status vocab is Pending/In Progress/Done/Verified (no
  "Open"); Today's "Open tasks" KPI linked to an always-empty `?status=Open`. Fixed link → `?status=Pending`
  and aligned the config filter options (+ `ar.ts`). Verified live.
- Secondary-screen audit (Rooms/Housekeeping/Guests) recorded in `project-memory.md` (findings list only, no
  fixes) — `1f0c99c`. EN spot-check of ⑤–⑦ passed (LTR, English strings; only bilingual seed data remains).
