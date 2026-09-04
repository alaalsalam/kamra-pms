<!-- bildfast:plan id=0001 status=approved agent=bildfast task="Improve public booking page design" -->
# Plan: Public booking page design polish

## Overview
The public booking page (`/hotelpms/book`, `screens/PublicBooking.tsx`) is the product's marketing-facing
landing. Its dominant design weakness was pervasive **bilingual "AR | EN" clutter** rendered raw inline
everywhere — hero title, the property description shown in *both* full languages, room-type names, amenity
chips, gallery captions, FAQ questions/answers, and the address. On an Arabic-first page this read as
unpolished. Goal: elevate the design within the approved identity (navy/gold, IBM Plex Sans Arabic / Manrope,
no new colors/fonts/logo, no glassmorphism), without touching availability/pricing logic, APIs, or RBAC.

## Plan
- `@bildfast-frontend` scope (executed inline by the orchestrator, single frontend surface):
  - Add a self-contained `<Bilingual>` helper that **script-detects** the Arabic vs Latin segment of an
    "AR | EN" (or "EN | AR") string and renders the current language prominent + the other as a smaller muted
    secondary line. Secondary carries `data-no-translate` (the live translator's skip hook); language comes
    from `useT().lang` so the EN/ع toggle flips the hierarchy live.
  - Apply it to: hero title, description, property + room amenity chips (primary only), gallery captions
    (primary only), room-type names (cards + summary sidebar), room view badge, room descriptions, FAQ Q&A,
    hero location, and the address.
  - Fold in two found defects: translate the booking-widget subtitle (`ar.ts`) and fix residual
    `night{s}`/`listing{s}` plurals via the existing `qty()` helper.
  - Do NOT change the Google-Maps `<iframe>` (renders blank only in headless), APIs, RBAC, or any money logic.

## Execution Note
Implemented in `frontend/src/screens/PublicBooking.tsx` (+ one `ar.ts` entry). Built with
`bench build --app hotelpms` (clean) and verified live on `hotelpms.yemenfrappe.com/hotelpms/book`:
- Raw "AR | EN" body nodes **20 → 0** (only the shared `PublicChrome` footer note remains).
- EN/ع toggle flips the hierarchy live (h1 "فندق نُزُل الرياض" ⇄ "Nuzul Riyadh Hotel"); secondary language
  preserved and not re-translated.
- AR (default) + EN, light + dark, desktop 1440 + mobile 390: no horizontal overflow, 0 console errors, no
  broken images; FAQ accordion opens; widget subtitle now Arabic; nights plural renders "2 ليال".
- No API / RBAC / backend / data changes. Committed with rebuilt assets; `checkpoints.jsonl` left untouched.
Owner decision noted: single-language display (dropping a language) and extending the same treatment to the
footer / other public screens (PublicListing, PublicCheckin, QrMenu) + English policy text.
