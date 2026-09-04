# Business Analysis — HotelPMS

> Living business analysis for the **HotelPMS** product, assembled from the real codebase, RBAC,
> seed/demo data and integrations (not a greenfield brief). Internal package/namespace stays `hotelpms`;
> the customer-facing wordmark is always the exact Latin **HotelPMS**. Currency **SAR**, Saudi **VAT 15%**.
> Last updated: 2026-09-04.

---

## 1. Vision & value proposition

HotelPMS is a bilingual **Arabic-first / English** Property Management System for Saudi and regional
hospitality operators. It runs the whole guest lifecycle — direct booking, reservations, front desk, rooms
& housekeeping, guest CRM, folios & Saudi VAT billing, restaurant POS + kitchen display + inventory,
laundry, banquets/events (MICE), OTA channel sync, and revenue/reporting — from one secure, role-gated
workspace. It is built on **Frappe v16**, is open-source (AGPL-3.0), multi-property, and ships an in-product
**AI assistant** plus a **hosted MCP server** so AI agents (Claude and others) act through *the same governed
APIs as staff*, fully attributed and audited.

**Core promise:** *one platform for every moment of the guest journey*, in Arabic and English, priced and
taxed for Saudi Arabia. **Deterministic money** is a first principle — prices, tax and availability are
computed by the system, never by an LLM.

**Why it wins (positioning):**
- **Arabic-first, Saudi-ready out of the box** — RTL is the default direction, SAR + 15% VAT come from a
  per-property localization pack, and demo data is authentic Saudi hospitality (Nuzul Riyadh Hotel).
- **AI-native but safe** — humans and AI agents share one audited action log and one set of permissioned
  APIs; the assistant can only call governed tools, so it can never miscompute a folio or overbook a room.
- **Full-stack hospitality** — front desk, F&B/POS, housekeeping, laundry, banquets and channel management
  in a single system rather than a booking widget bolted onto spreadsheets.

---

## 2. Target market & customer segments (Saudi-first)

Primary market is Saudi Arabia and the wider GCC/MENA hospitality sector. The data model and localization
support several operating shapes:

1. **Independent & boutique city hotels** — front desk, folios, VAT invoicing, housekeeping, a restaurant
   outlet. The core sweet spot.
2. **Resorts & serviced properties** — add experiences/add-ons, multiple F&B outlets, banquets/events, spa
   & wellness presentation in the public booking site.
3. **Short-term rentals & villas / furnished units** — `Property.property_kind` (Hotel/STR) and the Sellable
   Inventory Unit model (individual / whole-property / composite) support villa and whole-unit letting
   without forking the hotel logic.
4. **Small hotel groups / multi-property operators** — every operational record is scoped by `Property`;
   cross-property search (CRS) and per-property module gating let one tenant run several properties.
5. **Venues & banquet/MICE businesses** — a deep events module (enquiry → quote → BEO → invoice, costing &
   margin) serves wedding halls, conference venues and hotel banquet departments.

**Buyers/decision-makers:** hotel owners/GMs, revenue managers, finance controllers, and IT/operations leads
who need Arabic UX, Saudi VAT compliance-readiness, and role separation for staff.

---

## 3. Personas & roles (RBAC)

Access is enforced in two layers: **decorators in `authz.py`** on every whitelisted API (`require_roles`,
`require_it_admin`, `require_cashier_pin`) **plus** Custom DocPerm rows. The app ships **9 operational roles**,
each with a seeded demo user (`*@hotelpms.local`) and a dedicated, role-gated workspace.

| Role (EN / AR) | Persona & primary jobs | Demo user |
|---|---|---|
| **System Manager / Administrator** — مدير النظام | IT/platform admin: users, schema, dev settings, API keys, MCP clients | `admin@hotelpms.local` |
| **Hotel Admin (GM/Owner)** — مدير الفندق | Business super-user: operations + finance + revenue + settings (not IT). Full CRUD | `gm@hotelpms.local` |
| **Front Desk** — الاستقبال | Busiest role: arrivals/departures, rooms, guests, reservations, HK tasks, folios, tickets | `frontdesk@hotelpms.local` |
| **Revenue Manager** — الإيرادات | Pricing: room types, rate plans, seasons, vouchers, meal plans, hurdle rates, companies | `revenue@hotelpms.local` |
| **Finance** — المالية | Money-bearing reads, companies, folios, night audit, accounting export | `finance@hotelpms.local` |
| **Housekeeping** — التدبير الفندقي | HK task queue, room status, service tickets, lost & found | `housekeeping@hotelpms.local` |
| **Restaurant POS** — نقطة بيع المطعم | Tables, dine-in/takeaway orders, cashier workflow, KOT & bill printing | `pos@hotelpms.local` |
| **Kitchen** — شاشة المطبخ | Kitchen display queue, preparation states, order handoff | `kitchen@hotelpms.local` |
| **HotelPMS Agent (AI/MCP)** — الوكيل | Front-Desk-equivalent operations via MCP tools; fully attributable | `agent@hotelpms.local` |

Notes: There is **no standalone "Cashier" or "Hotel Manager" role** — "Cashier" is a per-user money-action
**PIN re-auth** mechanism (`Cashier PIN`, active when `Property.require_cashier_pin`); GM = Hotel Admin.
**Effective visibility = role ∩ property-enabled-module** (a role only sees an app when its module is bought
and enabled for that property).

---

## 4. Modules & capabilities

Nine modules are gated per property via `Property.enabled_modules` (empty = all enabled; `front-desk` + `admin`
are always force-included):

1. **Booking Engine (booking-engine)** — public, guest-facing direct booking site (search → quote → book),
   listing/catalogue pages, pre-check-in with ID upload, QR menu/order, voucher check, hosting enquiry.
2. **Front Desk (front-desk)** — reservations lifecycle, tape chart / calendar / availability board, arrivals
   & departures ("Today"), check-in/out, room moves, guest CRM & journey, registration cards, CRS.
3. **Housekeeping (housekeeping)** — task queue with SLA/escalation, room status (Clean/Dirty/Inspected/
   Ready/OOO), service tickets, lost & found, turnover profiles, shift handover.
4. **Operations (operations)** — laundry orders, service tickets, SLA board, activity/audit feed.
5. **F&B / POS (fnb)** — restaurant POS (tables, dine-in/takeaway, room-charge posting, QR source), Kitchen
   Display System (KOT states), menu items & recipes, ingredient stock (immutable Stock Ledger), inventory.
6. **Events / Banquets (events)** — venue bookings (Enquiry → Tentative → Confirmed → Completed), quotes/BEO/
   invoice, deep costing & margin, banquet menus/dishes, diary/month/registers, catalogue.
7. **Revenue (revenue)** — room types, rate plans, seasons, rate guardrails (floor/ceiling), hurdle rates,
   vouchers, meal plans, revenue budgets, revenue reports (flash, budget-vs-actual).
8. **Finance (finance)** — folios & charges/payments, split/transfer, close & invoice-freeze, night audit,
   accounting export, security deposits, company billing rules.
9. **Admin (admin)** — property setup, module toggles, users, integrations (channel manager, payments,
   WhatsApp/voice), developer settings, MCP "Connect Claude", marketplace.

Cross-cutting: an **AI Assistant** (BYO-key, OpenAI-compatible) and an **Agent Action Log / savings ledger**
that records both human and AI actions with a headline "minutes saved" metric.

---

## 5. Key use cases

- **Direct booking (guest):** search availability for dates/occupancy → see live quote (SAR incl. VAT) →
  book with idempotency protection → optional pre-check-in with ID upload before arrival.
- **Front desk day:** review arrivals/departures on "Today" → check guests in (room → Occupied) → move/amend
  reservations → check out (room → Vacant/Dirty, auto-creates a housekeeping task) → settle folio.
- **Billing & VAT:** post room/F&B/laundry/minibar charges to a folio → take payments (cash/card/bank/OTA
  prepaid/company credit/link) → close folio (freezes a numbered invoice; voids route to Cancelled Invoice).
- **Restaurant service:** open a table → build an order → fire KOT to the Kitchen Display → mark prep states →
  settle bill or post to a guest room folio → print 80mm KOT/bill.
- **Housekeeping:** work the task queue with SLA timers, update room status, raise/close service tickets.
- **Banquets/MICE:** capture an enquiry → build a quote/BEO with costed menus → confirm → invoice, tracking
  margin throughout.
- **Revenue management:** maintain rate plans/seasons/guardrails and hurdle rates; the deterministic pricing
  engine applies them consistently across every booking channel.
- **Channel management (OTA):** push availability/rates to OTAs and ingest OTA reservations via a
  provider-agnostic adapter seam (Channex/STAAH/AioSell); money & availability always computed in HotelPMS.
- **AI-assisted operations:** staff (or an approved AI agent) run governed actions through the assistant/MCP
  tools; every action is attributed and logged.

---

## 6. Core user journeys (happy paths)

1. **Guest → confirmed stay:** Public booking site → search → quote → `book` → confirmation → pre-check-in.
2. **Arrival → in-house → departure:** Today (arrivals) → Check-in → in-house services (POS/laundry charges) →
   Check-out → folio close & invoice.
3. **Walk-in / phone booking:** Front desk New Booking dialog → quote → create reservation → assign room.
4. **Dine-in order:** POS → table → items → KOT → Kitchen prep → bill / room-charge.
5. **Event:** Enquiry → quote/BEO → confirm → invoice.

---

## 7. Business rules (invariants)

- **Deterministic money:** prices, taxes and availability are computed by `pricing.py` / `siu/availability.py`
  / `folio.py`; the LLM never computes them.
- **One source of truth for availability & pricing** across public search, front desk, CRS, MCP tools and OTA
  webhooks — every entry point obeys the same math (SIU row-locking serializes concurrent bookings).
- **Reservation state machine** (code-defined): `Waitlist → Inquiry → Quoted → Requested → Held → Pending
  Payment → Confirmed → Checked In → Checked Out / Cancelled / No Show`; inventory-consuming statuses are
  Confirmed/Checked In/Held/Pending Payment; terminal states can't transition back.
- **Invoice & stock immutability:** a closed folio is frozen and numbered (voids → Cancelled Invoice to
  preserve invoice-sequence integrity); the Stock Ledger is append-only/read-only.
- **Money re-auth:** money actions can require a per-user Cashier PIN when the property enables it.
- **Saudi tax/locale:** SAR + single 15% VAT come from the `saudi_arabia` localization pack (demo-level, not
  ZATCA e-invoicing certified); core never hardcodes tax.
- **Every whitelisted endpoint gates itself** (`require_roles`) because raw SQL/`set_value` bypasses doctype
  permissions.
- **Multi-tenancy:** operational records are scoped by `Property`; module access = role ∩ enabled module.

---

## 8. Success metrics (KPIs)

- **Operational:** occupancy %, ADR/RevPAR, booking conversion on the public site, check-in/out throughput,
  housekeeping SLA compliance, POS covers/order times, F&B and banquet margin, night-audit completion.
- **Financial:** total revenue (SAR), VAT collected, outstanding folio balances, deposits held, OTA vs direct
  mix, accounting-export accuracy.
- **Product-signature:** **minutes/hours saved** via the Agent Action Log (human + AI), and share of actions
  safely completed by AI agents.

---

## 9. Demo scope (marketing-ready sandbox)

- **Property:** "فندق نُزُل الرياض | Nuzul Riyadh Hotel" (SAR, gallery, FAQ, bilingual brand), seeded by
  `seed_arabic_demo` and layered by `seed_showcase` (experiences, venues, POS outlets, menus, ingredients,
  banquet, laundry) into a living resort.
- **Live site:** `https://hotelpms.yemenfrappe.com` — public booking at **`/hotelpms/book`**, staff login at
  `/hotelpms/login` with one-tap role logins for all nine demo users.
- **Identity:** Arabic-first UI by default; navy `#082B5C` + gold identity; the HotelPMS gateway mark; IBM
  Plex Sans Arabic (AR) + Manrope (EN).
- **Reset:** the daily demo reset is **currently a no-op** on the production demo site (`hotelpms_demo_mode`
  is unset), so **writes persist** — treat the live demo as durable marketing data.

---

## 10. Differentiation

- **Arabic-first Saudi hospitality UX** (RTL default, SAR/VAT, authentic Saudi demo) rather than a translated
  afterthought.
- **Humans + AI on one governed surface** — a shared, audited action log and permissioned MCP tools; the AI
  can act but never miscompute money.
- **End-to-end coverage** (front desk + F&B/POS + housekeeping + laundry + banquets + channel manager) in one
  open-source Frappe app, extensible via doctypes/hooks.
- **Deterministic, single-source pricing/availability** shared across direct, desk, CRS and OTA channels.

---

## 11. Risks, limitations & boundaries

- **VAT compliance is demo-level, not ZATCA-certified** — no live e-invoicing/Fatoora clearance yet; a real
  Saudi go-live needs a ZATCA integration.
- **Payments** are wired to Razorpay (India-oriented); a Saudi launch needs a local PSP (e.g. Moyasar/HyperPay/
  mada) integration.
- **Demo persistence** — with the reset disabled, public write flows (bookings, POS orders) accumulate as
  permanent data on the live demo; needs care during marketing.
- **i18n mechanism** — English source strings + an Arabic catalog translated live via a MutationObserver
  (only the AR catalog exists); new user-visible strings must be added to `ar.ts` or they ship untranslated.
- **Scale/perf** — some list/board screens should be watched for pagination and N+1 as data grows (see
  `.bildfast/performance.md`).
- **Localization coverage** — packs exist for KSA/UAE/IN/ID/TH/MY + generic; other markets fall back to generic.

---

## 12. Readiness status

- **Product maturity:** mature/production-grade codebase (~78 doctypes, ~110 authenticated + 17 public APIs,
  ~55 screens, real integration test suites and eval harnesses). Version **2.6.0**, patch-first cadence.
- **Live demo:** deployed and reachable, Arabic-first, role-separated, marketing-ready.
- **Gaps before a paid Saudi go-live:** ZATCA e-invoicing, a local payment gateway, and demo-reset/data
  hygiene decisions. These are commercial-readiness items, not core-product gaps.

---

## Changelog

- **2026-09-04** — Initial full business analysis authored from the real codebase (owner-authorized): vision,
  Saudi segments, 9-role RBAC + demo users, 9 modules, use cases, journeys, business rules, KPIs, demo scope,
  differentiation, risks/limits and readiness. Reflects the current identity (HotelPMS wordmark, navy/gold,
  Arabic-first default) as of commit `8546470`.
- **2026-09-04** — UX/UI improvement round (live, screenshot-verified): fixed POS dark-mode contrast on the
  open-bill cards + menu text; removed the stray English plural "s" in the Arabic UI via a `qty()` i18n helper
  (Today/CRS/GuestJourney/PublicCheckin/Banquet/HkApp); filled visible Arabic catalogue gaps ("My Tasks",
  "Completed", empty states). No API/RBAC/backend/data change. Owner-decision items logged in project-memory
  §18 (demo-reset banner accuracy, bilingual seed strings, Saudi demo guest names).
- **2026-09-04** — Public booking page (marketing landing) design polish: replaced raw bilingual "AR | EN"
  clutter with a clean Arabic-first hierarchy (prominent primary + muted secondary; the EN/ع toggle flips it
  live), translated the search-widget subtitle, and fixed residual night/listing plurals. Presentation only —
  no availability/pricing/API/RBAC/data change; both languages preserved (single-language display remains an
  owner call).
- **2026-09-04** — Calendar & Rooms UX round: availability calendar + tape chart made faster to read —
  locale-aware Arabic/English Gregorian dates (were always English), colour legends (availability + booking/
  room-status), translated labels, bilingual-clean room-type names, and calendar loading/empty states. Shared
  `Bilingual`/`Legend`/`dateLocale` foundations. No API/RBAC/availability/pricing change. Deferred (needs API
  field): the Rooms list Type column showing a room-type link ID instead of a friendly name (project-memory §19).
