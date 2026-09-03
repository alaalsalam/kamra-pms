# HotelPMS

## Vision

HotelPMS is a bilingual Arabic/English hotel-management system for Saudi and regional hospitality operators. It provides direct booking, reservations, front-desk operations, rooms, guests, housekeeping, folios, Saudi VAT billing, POS, inventory, laundry, banquets, reports and an in-product assistant. The live demo is https://hotelpms.yemenfrappe.com/hotelpms/book and contains realistic Arabic/English hotel data for product marketing.

## Product identity

- Customer-facing product name: **HotelPMS**.
- The product wordmark is always the exact Latin **HotelPMS**; never translate,
  split, duplicate or reorder it. `PMS` stays brand gold. Interface copy may be Arabic.
- Brand palette: deep navy `#082B5C`, wordmark gold `#B8892E`, and interface champagne gold `#C9A24B` (`gold-500`).
- Brand mark: navy hospitality-gateway tile with a gold portal, ivory `H`, central
  guest door and curved arrival line. Do not restore the former tower or bare-H marks.
- Typography: `IBM Plex Sans Arabic` for Arabic UI; `Manrope` for English, Latin
  identifiers and the wordmark. Both are bundled locally in the frontend.
- Arabic is the default on new devices; an explicit English choice is remembered.
- Public booking and operational screens must be responsive, polished and marketing-ready.

## Stack and locations

- Frappe v16 / Python backend: `apps/hotelpms/hotelpms/`.
- React 19 + TypeScript + Vite + Tailwind frontend: `apps/hotelpms/frontend/src/`.
- Built frontend assets: `apps/hotelpms/hotelpms/public/frontend/` — never edit these directly; run `npm run build` in `apps/hotelpms/frontend` after frontend changes.
- Production site: `hotelpms.yemenfrappe.com`; public SPA route: `/hotelpms`; booking route: `/hotelpms/book` (with `/book` redirect).

## Non-negotiable conventions

- Preserve internal package, route and API namespace `hotelpms`; they are compatibility contracts, not user-facing branding.
- Use `HotelPMS` in visible English UI. Use the Arabic treatment above in translated UI.
- Currency is SAR and Saudi VAT is 15% for the demo.
- Prefer Frappe DocTypes and whitelisted methods; retain permission checks and role gates.
- Use tabs in Python. Keep frontend API calls typed and place UI strings in the Arabic catalogue when appropriate.
- Do not replace the existing app with a scaffold or duplicate the running site. Extend the existing `hotelpms` app only.
