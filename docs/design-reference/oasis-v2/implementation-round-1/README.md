# Oasis UI v2 — implementation round 1

Date: 2026-09-05

## Scope

This round establishes the shared design foundation before screen-by-screen redesign:

- Alexandria is bundled locally for Arabic and English.
- The former navy/gold utility contract now maps to the Oasis teal/ivory/amber tokens, allowing existing screens to inherit the new identity safely.
- Light, dark, and print token maps were aligned.
- The shared shell now uses a 248px ivory sidebar, clearer active navigation, a quiet 62px command bar, a 1180px content container, a persistent property/user card, and a single teal booking CTA.
- Mobile now has a five-slot bottom navigation (four direct destinations plus an accessible More sheet), so operational pages no longer depend on the desktop sidebar.
- Buttons, cards, metric tiles, focus states, selection, and the inline/static logo palette were aligned to Oasis.
- Login was restyled around the new identity while preserving demo role authentication and session isolation.
- Dashboard became an operations centre and gained a real-data, permission-aware "Needs your attention now" queue.

## Evidence

- `login.png` — live Arabic RTL capture at 1440px.
- `dashboard.png` — live Hotel Admin capture with real demo data at 1440px.
- `login-mobile.png`, `dashboard-mobile.png`, and `mobile-navigation.png` — live 390px RTL captures.
- `npm run build` passed.
- `bench build --app hotelpms` passed. The bench emitted one unrelated warning for the missing `apps/doppio/node_modules` link; HotelPMS compiled successfully.
- `npx playwright test e2e/auth-isolation.spec.ts --reporter=line` passed (1/1).
- Both live captures produced zero console errors.
- Mobile document width matched its 390px viewport exactly (no horizontal overflow).

## Guardrails for round 2

Keep all RBAC, pricing, availability, booking, payment, and property-scoping logic intact. Apply the new hierarchy page-by-page, starting with Today, Reservations and contextual reservation details, then Calendar/Tape Chart, POS, and public booking.
