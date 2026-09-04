<!-- bildfast:plan id=0002 status=approved agent=bildfast task="Improve Calendar and Rooms screens" -->
# Plan: Calendar & Rooms UX/functional improvement

## Overview
Approved follow-up in the same UX round: make the availability calendar and the rooms/occupancy screens faster
to read and operate for front-desk staff, within the approved identity (navy/gold, IBM Plex Sans Arabic /
Manrope, no new colours/fonts/logo, no glassmorphism). Real screens/components identified from the code:
`components/CalendarView.tsx` (`/calendar`), `screens/TapeChart.tsx` (`/tape`), and the metadata-driven
`ResourceScreen` + `roomsConfig`/`roomTypesConfig`/`roomBlocksConfig` (`/rooms`, `/room-types`, `/room-blocks`).
VenueCalendar is banquet/events, out of scope. Constraints: no availability/pricing/API/RBAC/backend changes.

## Plan
- `@bildfast-frontend` scope (executed inline by the orchestrator):
  - **Shared foundations:** move `<Bilingual>` to `components/Bilingual.tsx` (reuse, not fork); add
    `components/Legend.tsx` (colour key); add `dateLocale()` to `lib/money.ts` that follows the UI language and
    forces the Gregorian calendar on Arabic (`ar-SA` is Hijri) — replacing hardcoded `en-IN` date formatting.
  - **Calendar:** locale-aware dates, colour legend (Available/Limited/Sold out), translated title, bilingual-
    clean room-type labels, skeleton loading + empty state, Today-column highlight, RTL-logical spacing.
  - **Tape chart:** locale-aware dates, colour legend (booking + room-status tones), bilingual-clean group
    headers, translate Position/in-use/Days/Hourly/Auto-assign, fix the `rooms`/conflict plurals via `qty()`.
  - **Rooms:** keep the solid table; the Type column showing a link ID is deferred (needs `room_type_name` from
    the list API — data/config follow-up, no backend change here).

## Execution Note
Implemented in `lib/money.ts`, `components/Bilingual.tsx` (new), `components/Legend.tsx` (new),
`components/CalendarView.tsx`, `screens/TapeChart.tsx`, `screens/PublicBooking.tsx` (import the shared
`<Bilingual>`), and `lib/translations/ar.ts` (new keys). Built with `bench build --app hotelpms` (clean) and
verified live:
- **Calendar:** title → "التوفر", Arabic Gregorian weekdays/dates ("الخميس ١٧"), Arabic-only room-type names,
  colour legend (متاح/محدود/نفدت الغرف), Today column tinted, skeleton/empty states; EN shows English dates.
- **Tape chart:** colour legend (مقيم/مؤكد/محجوز·محظور/بحاجة للتنظيف/خارج الخدمة), "الإشغال" occupancy row,
  bilingual-clean group headers ("غرفة نُزُل ديلوكس ٥ غرف · ٢ قيد الاستخدام"); booking-bar click still opens the
  reservation sheet (interaction intact).
- A bug found + fixed during verification: `dateLocale()` first keyed off the property money-locale (`ar-SA`),
  leaking Arabic dates into the English UI — changed to `getLang()`.
- AR + EN, light + dark, desktop 1440 + tablet 834: no horizontal overflow, 0 console errors, no broken images.
No API/RBAC/backend/data change. Committed with rebuilt assets; `checkpoints.jsonl` untouched.
Deferred: Rooms Type-column friendly name (needs `room_type_name` in the list API).
