# Project Memory — HotelPMS (internal: `hotelpms`)

> A complete, durable conception of the whole project, assembled from a full read of the codebase
> (backend Python, ~78 DocTypes, the React SPA, config/RBAC, tests, seed data, docs, build tooling).
> This is a **reference/context document** — not user-owned spec (that's `business.md` / `tests.md`).
> Last assembled: 2026-09-03; reviewed & corrected 2026-09-04 (identity refresh at `8546470`, demo users,
> Arabic-first default, fonts, and the authored `business.md`).

---

## 1. What it is (one paragraph)

**HotelPMS** (customer-facing brand; internal app/namespace stays `hotelpms`) is a mature, production, open-source
(AGPL-3.0) **hotel + short-term-rental Property Management System** built on **Frappe v16**. It is bilingual
**Arabic/English (RTL-aware)**, multi-property, and covers direct booking, reservations & front desk, rooms &
housekeeping, guest CRM, folios & tax billing, POS/kitchen/inventory, laundry, banquets/events (MICE), channel
manager (OTA) sync, revenue/reporting, and an in-product **AI assistant** ("HotelPMS Agent") plus a **hosted MCP
server** so Claude and other agents act through the *same governed APIs as staff*. Money and availability are
computed deterministically in HotelPMS — never by an LLM. Publisher: YemenFrappe. Canonical application package: `hotelpms`,
current version **2.6.0** (patch-first release cadence).

---

## 2. Stack & locations

- **Backend:** Frappe v16 / Python ≥3.10, at `apps/hotelpms/hotelpms/`. flit-packaged (`pyproject.toml`), lint = **ruff** (line 110), pre-commit + eslint/prettier.
- **Frontend:** React **19.1** + TypeScript **5.8** + Vite **6.3** + **Tailwind v4.1**, at `apps/hotelpms/frontend/src/`. Router = react-router-dom **7**, realtime = socket.io-client, icons = lucide-react.
- **Built assets:** committed to `apps/hotelpms/hotelpms/public/frontend/` (so `bench get-app` serves the UI with no node build). **Never hand-edit** these — they are build output.
- **Build:** `npm run build` (= `tsc -b && vite build`) inside `frontend/`; top-level `package.json` `build` wraps it (`cd frontend && npm install && npm run build`); Frappe Cloud runs it on deploy; the orchestrator's `bench build --app hotelpms` triggers the same. Vite `outDir = ../hotelpms/public/frontend`, `base = /assets/hotelpms/frontend/`. Dev server :5173 proxies `/api` to bench (:8000).
- **Serving:** SPA mounts at **`/hotelpms`**; `hotelpms/www/hotelpms.py` serves the built `index.html` with `window.csrf_token` injected; `website_route_rules` fall every `/hotelpms/<path>` through to it (browser refresh works). Router basename = `/hotelpms` in PROD, `/` in dev.
- **Production site:** `hotelpms.yemenfrappe.com` (DB `hotelpms_demo`). **Live preview / booking route: `https://hotelpms.yemenfrappe.com/hotelpms/book`** (with `/book` → `/hotelpms/book` redirect).

---

## 3. Branding & non-negotiable conventions

- Visible product wordmark is always exact Latin **HotelPMS** (never translated,
  reordered or duplicated); `PMS` remains gold while surrounding interface copy is translated.
- **Internal namespace `hotelpms` (package, routes, API methods) is a compatibility contract — keep it, never rebrand it in code.** Only visible UI text is "HotelPMS".
- Currency **SAR**, Saudi **VAT 15%** for the demo; tax/locale come from the per-property localization pack, never hardcoded in core.
- **Approved identity palette:** deep navy `--color-brand-600: #082B5C`, wordmark gold `#B8892E`, and lighter interface champagne `--color-gold-500: #C9A24B`. The two gold tones are intentional. `brand.ts` sets `BRAND_NAME="Hotel"`, `BRAND_FULL_NAME="HotelPMS"`, logo `/assets/hotelpms/hotelpms-mark.svg`.
- **Approved mark (2026-09-04):** a navy rounded hospitality-gateway tile with
  gold portal and arrival line, an ivory `H`, and a central guest door. Arabic UI
  uses bundled `IBM Plex Sans Arabic`; English/Latin uses bundled `Manrope`.
  Arabic is the first-visit default and the language switch persists user choice.
- Prefer Frappe DocTypes + whitelisted methods; keep role gates + permission checks. Python uses **tabs**. Extend the existing app — never scaffold a replacement.

---

## 4. Roles & permissions (RBAC)

**Two enforcement layers.** Doctype `has_permission`/`permission_query_conditions` hooks are commented out; gating = **decorators in `authz.py`** (below `@frappe.whitelist()`) + **Custom DocPerm** rows seeded by scripts.

- `require_roles(*roles)` — allows listed roles + `ADMIN = (System Manager, Administrator, Hotel Admin)`; also stamps `_hotelpms_roles` so the MCP/agent layer filters its tool list identically.
- `require_it_admin` — `(System Manager, Administrator)` only; **excludes Hotel Admin** (user mgmt, dev settings, API keys).
- `require_cashier_pin(property, pin)` — per-user money-action re-auth via the `Cashier PIN` doctype (encrypted); active only when `Property.require_cashier_pin`; bypassed for agents/Administrator. **"Cashier" is not a role** — it's this PIN mechanism.

**The 9 operational roles** (consistent across `authz.py`, `seed_users.py`, `seed_rbac_v2.py`, `provision.py`):

| Role | Intent |
|---|---|
| **System Manager / Administrator** | IT/platform admin (users, schema, dev settings, API keys) |
| **Hotel Admin** (GM/owner) | Business super-user: ops + finance + revenue + settings, **not** IT. Full CRUD on all doctypes |
| **Front Desk** | Day-to-day ops (rooms, guests, reservations, HK tasks, folios, tickets) — busiest role (119 gate sites) |
| **Revenue Manager** | Pricing (room types, rate plans, seasons, vouchers, meal plans, companies) |
| **Housekeeping** | HK tasks, service tickets, lost & found, rooms |
| **Finance** | Money-bearing read + companies + folios + night audit |
| **Restaurant POS** | Tables, dine-in/takeaway orders, cashier workflow, KOT and bill printing |
| **Kitchen** | Kitchen display queue, preparation states and order handoff |
| **HotelPMS Agent** (AI/MCP) | Front-Desk-equivalent ops, fully attributable; bound to user `agent@hotelpms.local` with API key |

There is **no standalone "Cashier" or "Hotel Manager" role** (GM = Hotel Admin). Endpoint role constants exist per module (`POS_ROLES`, `RATE_ROLES`, `BANQUET_ROLES`, `CONVO_ROLES`).

**Custom DocPerm trap** (`fix_perms_fields.py`): one Custom DocPerm row makes Frappe ignore that doctype's *entire* standard perm block; `sync_standard_perms()` mirrors JSON DocPerms into Custom DocPerm to repair. APIs mostly survived the bug because they gate via `require_roles` + `db.set_value`, bypassing doctype perms.

---

## 5. Module gating (per property)

9 modules: `front-desk, housekeeping, operations, fnb, events, revenue, finance, booking-engine, admin`
(`ALL_MODULES` in `api.py`). Stored as CSV in `Property.enabled_modules` (empty = all enabled, backward-compat).
`set_enabled_modules` (Hotel Admin only) always force-includes `front-desk` + `admin`. Frontend enforcement in
`frontend/src/lib/apps.ts` (`visibleApps(roles, modules)` = show app only if role matches **and** module enabled),
plus per-nav-item `roles`. `provision.py` maps modules → required roles (`MODULE_ROLES`) so a tenant only gets
roles for modules it bought. **Effective visibility = role ∩ property-enabled-module.**

---

## 6. Data model (~78 DocTypes)

Nearly every operational doctype is **scoped by `property → Property`** (multi-tenancy). **Reservation is the spine.**

**Core chain:**
```
Property 1─* Room Type 1─* Room
Property 1─* Guest
Guest ─┐
Room Type ─┼─> Reservation ─(1:1)─> Folio ─1─* Folio Charge
Room ──────┘        │                    └─1─* Folio Payment
Sellable Unit ──────┘  (Reservation also → Company, Group Booking, Meal Plan, Rate Plan, Voucher, Travel Agent)
```
Reservation fans out to Folio, Housekeeping Task, POS Order, Service Ticket, Laundry Order, Security Deposit,
WhatsApp Message (all carry optional `reservation` back-link).

**Reservation lifecycle** — status: `Waitlist | Inquiry | Quoted | Requested | Held | Pending Payment | Confirmed | Checked In | Checked Out | Cancelled | No Show`. State machine is **code-defined** in `reservation_state.py` (not JSON) via `assert_transition`; terminal = Checked Out / Cancelled / No Show. Inventory-consuming = `LIVE_STATUSES = (Confirmed, Checked In, Held, Pending Payment)`. Controller side-effects: Checked In → room Occupied + `actual_check_in`; Checked Out → room {Vacant, Dirty} + auto-creates a Housekeeping Task; cancel forced through the fee-aware API; SIU row-locking serializes concurrent bookings (ADR-007).

**Key groupings:**
- **Rooms & rates:** Room (housekeeping_status Clean/Dirty/Inspected/Ready/OOO + occupancy_status), Room Type (pricing/occupancy/`room_category` Villa/Private/Shared), Rate Plan, Season (date/day-of-week adj), Rate Guardrail (floor/ceiling), **Sellable Unit/SIU** (inventory abstraction — individual/whole_property/composite + `competition_group`), Room Block, Meal Plan (EP/CP/MAP/AP), Experience (add-ons), Discount Voucher, Hurdle Rate, Revenue Budget.
- **Folios:** Folio (Open/Closed; computed totals; **invoice-freeze** once Closed + numbered — guarded in `folio.py`, voids go to **Cancelled Invoice** to keep GST sequence integrity), Folio Charge (Room/Meal/F&B/Minibar/Laundry/…/`is_alcohol`), Folio Payment (Cash/Card/UPI/Bank/OTA Prepaid/Company Credit/Link + FX).
- **F&B/POS:** POS Outlet, POS Order (KOT flow, room-charge posting, QR source), POS Order Item (kot_status), Menu Item (recipe, prep_station), Ingredient, Ingredient Stock (per outlet), **Stock Ledger Entry** (immutable, all read-only), Menu Item Ingredient, POS Table Reservation.
- **Banquet/events:** **"Banquet Function" = the `Venue Booking` doctype** (autoname `EVT-…`; sales funnel Enquiry/Tentative/Confirmed/Completed/Cancelled/Lost; deep costing/margin; quote/BEO/invoice lifecycle; green room). Venue, Venue Section/Amenity, Banquet Function Item, Banquet Menu (+Course/Dish), Banquet Dish (recipe→cost), Banquet Selection, Banquet Service Item, Banquet Open Item/Payment Term/Quote Revision/Receipt (children). Group Booking (`GRP-…`) + Group Room Block.
- **Operations:** Housekeeping Task (status + assignment_status + SLA), Laundry Order (+Item, +Rate), Service Ticket (SLA, multi-source), Lost And Found Item, Shift Handover (cash reconciliation), Night Audit Run, Turnover Profile (HK timing config).
- **Config/integration:** Channel Manager Connection, Channel Room Mapping, Channel Provider Connection (voice/WhatsApp/SMS), Company (+Company Billing Rule routing charges to Company/Guest), Travel Agent (commission), Payment Gateway Settings (Razorpay), Security Deposit (lifecycle states), Cancelled Invoice, Cashier PIN, AI Assistant Settings (BYO-key), Copilot Conversation, **Agent Action Log** (shared human+AI audit + minutes_saved), MCP OAuth Client/Grant, WhatsApp Message, Hosting Enquiry (SaaS lead), Property FAQ/Photo, Room Type Media, Stay Addon/Instruction/Occupant.

**Two immutable ledgers:** Stock Ledger Entry (read-only) + the closed-Folio invoice freeze.

---

## 7. Backend API surface

**Public/guest — `public_api.py`** (17 `allow_guest=True` fns): `catalog_index`, `resolve_slug`, `site_info`, `default_property`, `showcase`, `search_stay`, `precheckin_info`, **`precheckin_submit`**, **`precheckin_upload_id`**, `laundry_info`, **`request_guest_laundry`**, **`book`** (idempotency-key protected), `access_info`, `check_voucher`, `qr_menu`, **`qr_order`** (captain must confirm; guest never posts to folio), **`hosting_enquiry`**. (Bold = POST-only.)

**Authenticated core — `api.py`** (~110 endpoints, thin over domain modules): setup/modules/dev, reservation lifecycle (find/detail/checkin/checkout/cancel/amend/move/confirm), booking (`booking_options`/`get_quote`/`create_booking`/group), pre-arrival & ID, availability/board (`front_desk_snapshot`, `tape_chart`, `availability_calendar`, briefings), **folios/billing** (add charge/payment, split/transfer, close, `run_night_audit`, `folio_invoice`, `gstr1_rows`), deposits, guests/CRM (`guest_journey`, `merge_guests`, `anonymize_guest`), housekeeping + tickets, groups/blocks/waitlist, revenue (hurdle rates, `set_room_rate`), cashier PIN.

**Domain modules:** `folio.py` (billing engine + owns night audit), `reservation_state.py` (status machine, hold expiry, SIU lock), `housekeeping.py` (escalation), `pos.py` (full POS+KDS+tables, depletes stock), `banquet.py` (~105KB, largest — end-to-end events + reminders + economics + documents), `channel_manager.py` (provider-agnostic OTA ARI + generic webhook + villa lockout), `pricing.py` (deterministic Decimal quote engine + demand/season tiers), `allocation.py` (auto room assignment), `deposit.py`, `accounting.py` (invoice export, no live e-invoicing), `prearrival.py`, `crs.py` (cross-property search), `dashboards.py`, `reports.py` (manager flash, BvA, SLA), `inventory.py` (POS stock/recipes — distinct from SIU), `laundry.py`, `payments.py` (Razorpay), `whatsapp.py` (Meta Cloud), `assistant.py` (BYO-key OpenAI-compatible LLM chat, acts only via MCP tools), `agents_api.py` (activity ledger), `marketplace.py`, `realtime.py` (after-commit "property changed"), `authz.py`, `access.py` (secure access-instruction release, ADR-012), `id_documents.py` (only private-file writer), `turnover.py` (ADR-010), `savings.py` ("core product primitive" — logs minutes-saved to Agent Action Log). Plus **`siu/`** package (Sellable Inventory Units, ADR-001..004) — `siu/availability.py` is the single source of truth for availability across public search, desk, CRS, MCP, ARI.

---

## 8. Frontend architecture

**Boot** (`main.tsx`): theme → lang → i18n → `<BrowserRouter basename>` → `<AuthProvider>` → `<App/>`.

**Routing/shell** (`App.tsx` + `AppShell.tsx`): every screen `React.lazy` + one `<Suspense>` + top-level `ErrorBoundary`. `RequireAuth` gate (loading/anon/authed) keeps URL matched to auth. **Public routes (no auth):** `book`(+dated), `stay/:slug`(+dated), `checkin/:token`, `hk`, `menu/:outlet`, `login`. **Authed routes** live inside `AppShell` (sidebar + header with AppSwitcher, property `<select>`, ⌘K search, theme toggle, New booking). Shell does **module gating** (`myProperties` + `enabledModules` + `site_info`), **kiosk mode** on `/pos` & `/kitchen`, and a realtime `refreshKey`. `venue-calendar` route redirects to `/banquet-diary` (legacy).

**~55 screens** grouped: Public booking (PublicBooking, PublicListing, PublicCheckin, QrMenu), Front desk (Today[index], Dashboard, TapeChart, CalendarView, CRS, ReservationDetail, Guests, GuestJourney, RegistrationCard, CancellationLetter), Billing/finance (Billing, FolioView, AccountingExport, RevenueReports, Reports), F&B (POS, Kitchen, MenuItems, MenuImport, RecipeManager, Inventory), Banquet (Banquet, BanquetDiary, BanquetMonth, BanquetRegisters, BanquetCatalogue, BanquetFunction, BanquetDocument + `banquet/*` helpers), Ops (HkApp, HkLaundry, Laundry, Tickets, OpsSLA, Activity), Channel/setup/admin (BookingEngine, Settings, Setup, Developers, Marketplace, AppLauncher), Assistant (Assistant, Agents, WhatsAppChat), Login.

**Data layer** (`src/lib/api.ts`): **live against Frappe, no mock/localStorage data** (localStorage only holds UX prefs: property/locale/theme/lang). `doFetch` wrapper: `credentials:"include"`, injects `X-Frappe-CSRF-Token` from `window.csrf_token`, one silent retry on network error, dispatches `hotelpms:offline/online` + `hotelpms:auth-error`. `call(method, params)` unwraps `.message`. Methods namespaced `hotelpms.api.*`, `hotelpms.banquet.*`, `hotelpms.assistant.*`, `hotelpms.public_api.*`. Generic REST via `resource.ts` on `/api/resource/<Doctype>`.

**Metadata-driven screens:** `ResourceScreen.tsx` + `screens/configs.ts` (~24 `ScreenConfig`s) render list+search+filters+pagination+CSV + a Sheet form from `FieldSpec[]` — used for rooms, room-types, rate-plans, seasons, vouchers, meal-plans, guardrails, companies, travel-agents, venues, events, groups, room-blocks, outlets, channels, housekeeping, reservations, menu-items, etc., with bespoke panels (ReservationDetail, BillingRulesEditor, EventLinks, GroupControl, RoomTypeMedia).

**Cross-cutting libs:** `auth.tsx` (session; network errors don't sign you out), `i18n.ts` + `translations/ar.ts` (source strings are **English**; a MutationObserver live-translates the whole DOM to Arabic from the AR catalog — only the AR catalog exists — so **any new user-visible string must get an `ar.ts` entry** or it ships untranslated), `dir.ts` (RTL; the **runtime default is now Arabic-first** — `getLang()` returns `"ar"` on new devices and persists an explicit EN choice, changed at `8546470`), `routing.ts`, `brand.ts` (rebrand), `money.ts` (SAR/VAT from property locale, defaults Saudi), `theme.ts` (light/dark/system), `realtime.ts` (socket.io → polling fallback), `phone.ts`, `kiosk.ts`, `thermal.ts` (80mm KOT/bill print), `accents.ts`, `markdown.tsx` (XSS-safe). Reusable components: BookingDialog, CheckInDialog, CalendarView, CommandPalette, AssistantPanel, HelpPanel, SignaturePad, IdDocumentField (private upload), ImageField, ConnectionBanner, LanguageToggle, EditableNationality, LinkedRecords, EventLinks, GroupControl, BillingRulesEditor, RoomTypeMedia, CancelPanel. `components/ui/` is a small local shadcn-style primitive set (avatar, badge, button, card, sheet, sparkline, stat-card) — **not a full shadcn install**.

**Styling** (`index.css`): Tailwind v4 `@theme` tokens — `brand-*` (navy accent that INVERTS in dark), fixed `navy-*` chrome, champagne `gold-*`, warm `zinc-*` neutrals; brand helpers `.btn-gold` (gold CTA, navy label ≈AA), `.card-lux`, `.text-gold`, `.rule-gold`, `.hero-scrim`, `.cv-auto`; `.dark` remaps all vars; `@media print` forces paper-white + hides chrome (clean GRC/invoice/BEO print). **Bundled fonts:** `Manrope` (Latin/wordmark), `IBM Plex Sans Arabic` (RTL body). First-class RTL: **only a fixed whitelist of physical utilities is mirrored** (`.left-2/2.5/3/4`, `.right-2/3/4`, `.ml-/mr-auto`, `.border-l/r`, `input.pl-8/9/10`) — new spacing should prefer logical utilities (`ps-*`/`pe-*`/`start-*`/`end-*`) to avoid silent RTL breakage; LTR-forced number/email/tel/date inputs; tabular numbers; reduced-motion guards.

---

## 9. Integrations

- **MCP (hosted, for Claude & agents):** `mcp_http.py` serves streamable-HTTP JSON-RPC at **`/mcp`** via `page_renderer` (in-process, Bearer auth, 401→resource metadata). `mcp_oauth.py` = full OAuth 2.1 (public clients, auth-code + **PKCE S256**, dynamic client registration, refresh rotation; tokens hashed, bound to user+property so Claude acts *as that person*). `mcp_tools.py` = shared registry of **52 tools** (front desk, billing, groups, briefings, night audit, onboarding, ops, revenue, **banquets=20**), each wraps a governed endpoint, auto-injects `property`, filtered by `allowed_tools(roles)` using the same `require_roles` gate. "Connect Claude" UX in the app.
- **Channel manager (OTA):** `channels/` 2-function adapter seam (`push_ari`, `parse_webhook`; registry extensible via `hotelpms_channel_providers` hook). Adapters: `channex.py`, `staah.py`, `aiosell.py` (HTTP Basic; own `reservation_webhook`; `preserve_webhook_auth` `before_request` hook). All booking/pricing/availability rules stay in `channel_manager.py`.
- **Payments:** Razorpay payment links + `razorpay_webhook` (`payments` is a `required_app`).
- **Messaging/voice:** `whatsapp.py` (Meta WhatsApp Cloud) + `agents_channels.py` (provider-agnostic voice/WhatsApp webhooks, HMAC-verified, HeyKoala-first) — both stamp Agent Action Log.
- **`allow_guest` surface outside public_api** (security-relevant): `api.whoami`, `channel_manager.webhook`, `channels.aiosell.reservation_webhook`, `payments.razorpay_webhook`, `whatsapp.webhook`, `agents_channels.voice_webhook`/`messaging_webhook`.
- **Localization** (`localization/`): ERPNext `regional_overrides`-style country packs resolved by `Property.country` via `hotelpms_localization` hook (India, Indonesia, Thailand, Malaysia, Saudi Arabia, UAE; `generic` fallback). Pack interface: `calculate_room_tax`, `fnb_tax_rate`, `invoice_context`, `locale`, etc. `saudi_arabia.py` = single 15% VAT, bilingual EN/AR, SAR — **not ZATCA e-invoicing compliant** (demo-level). Core never hardcodes tax.

---

## 10. Scheduler & doc events (`hooks.py`)

- **Cron:** hourly `channel_manager.push_all_ari`; 03:00 `folio.nightly_audit_all_properties`; 09:00 `prearrival.run_prearrival_outreach`; every 15m `housekeeping.escalate_overdue_tasks` + `reservation_state.expire_holds`; 08:30 `banquet.run_banquet_reminders`; 04:15 `scripts.reset_demo.scheduled` (no-op unless demo mode).
- **Doc events:** `realtime.notify` on insert/update/trash for Reservation, Folio, Room, Housekeeping Task, Venue Booking, Group Booking, POS Order, Service Ticket, Agent Action Log. Reservation also fires `channel_manager.on_reservation_change` (after-commit, best-effort). `before_request = aiosell.preserve_webhook_auth`. `after_install = hotelpms.install.after_install`. `required_apps = ["payments"]`.

---

## 11. Tests, evals & CI

`hotelpms/tests/` (~146 real `IntegrationTestCase` functions): `test_banquet.py` (94 — the big CI suite), `test_aiosell.py` (12), `test_llm_compat.py` (8), `test_mcp.py` (8), `test_mcp_registry.py` (5), `test_property_presets.py` (5), `test_reservation_state.py` (5), `test_sellable_unit_competition.py` (5), `test_deposit_logic.py` (4). The ~50 `doctype/*/test_*.py` are empty Frappe stubs (ignore). **Eval harnesses:** `eval_harness.py` (75/75 deterministic rules as Administrator, rolled back), `frontdesk_eval.py` (13/13 as a real Front Desk user — exercises RBAC + negative "must NOT" checks). Run: `bench --site test.localhost run-tests --module hotelpms.tests.test_banquet` (needs `allow_tests`); evals piped into `bench console`. CI: `ci.yml`, `linters.yml`, `nightly.yml`, `release.yml`, `release-please.yml`, `vps-doctor.yml`.

---

## 12. Seed / demo data & the reset guard

- `seed_demo.py` — base "فندق نُزُل الرياض | Nuzul Riyadh Hotel" (idempotent).
- `seed_showcase.py` — layers a living resort (experiences, venues, POS outlets, menus, ingredients, banquet, laundry).
- `seed_arabic_demo.py` — polishes into bilingual **"فندق نُزُل الرياض | Nuzul Riyadh Hotel"** (SAR, gallery, FAQ, brand). Default frontend property.
- `provision.py` — paying-tenant path (one real property + owner + purchased modules; **no** demo data).
- `reset_demo.py` — daily wipe/reseed of the public sandbox. **Guarded** by `is_playground()`: needs `hotelpms_demo_mode == "1"` **AND** site in `PLAYGROUND_SITES` (incl. `hotelpms.yemenfrappe.com`) or `.localhost`. **On `hotelpms.yemenfrappe.com`, `hotelpms_demo_mode` is NOT set in `site_config.json` → the scheduled reset is currently a silent no-op.** A real tenant can never trip it.
- Demo logins (`seed_users.py`, all `@hotelpms.local`, one per role): `admin@` (System Manager), `gm@`
  (Hotel Admin), `frontdesk@` (Front Desk), `revenue@` (Revenue Manager), `finance@` (Finance),
  **`housekeeping@`** (Housekeeping — NOT `hk@`), **`pos@`** (Restaurant POS), **`kitchen@`** (Kitchen). The
  login screen exposes one-tap quick-login for all of them. Passwords follow `HotelPMS<Role>1!`.

---

## 13. Docs & release process

- **README.md** — marketing/onboarding (open-source PMS, humans + AI share governed APIs, deterministic money, MCP layer, live demo, one-tap role logins).
- **PLAN.md** — "Ewa Reserve: short-term-rental setup plan" — **planning-only**; add `Property.property_kind` (Hotel/STR) driving defaults/copy/modules **without forking** hotel logic (v28 patch `backfill_property_kind` already shipped the field).
- **docs-dev.md** — local dev (Docker devcontainer, ports, demo accounts).
- **aiosell-channel-manager-flow.md** (+ companions) — OTA IN/OUT integration guide; money & availability always computed in HotelPMS.
- **CONTRIBUTING.md** — `develop` (integration/nightly, PR target/default) vs `main` (stable/releases, tracks demo + Frappe Cloud); conventional commits → SemVer.
- **CHANGELOG.md** — Keep-a-Changelog + **patch-first** cadence; current **2.6.0**; recent themes: hosted MCP OAuth "Connect Claude", AioSell adapter, guarded demo reset, full-screen POS/KOT, 52-tool MCP registry.

---

## 14. Migrations / patches

`patches.txt` `[post_model_sync]` chain **v23 → v31** — almost entirely **idempotent data backfills** for newly added Property/Reservation fields (action-log approval/actor, property country/kind/booking_mode, sellable units, turnover profiles, listing slugs, favicon). No destructive/breaking migrations — consistent with patch-first. Original schema creation lived in `bootstrap_v1..v10.py`.

---

## 15. Key architectural principles (ADRs referenced in code)

1. **One source of truth for availability/pricing/booking rules** — `siu/availability.py`, `pricing.py`, `channel_manager.py`; *every* entry point (public search, desk, CRS, MCP tools, OTA webhooks) obeys the same math.
2. **Every whitelisted endpoint declares its own `require_roles` gate** — because raw SQL/`set_value` bypasses Frappe doctype perms.
3. **Agent Action Log / savings ledger** is the shared audit trail for humans, the LLM assistant, and voice/WhatsApp agents alike, and the product's headline "hours-saved" metric.
4. **Deterministic money** — LLM never computes price/tax/availability; it only calls governed tools.
5. **LLM assistant is BYO-key & OpenAI-compatible** (OpenAI/OpenRouter/Groq/Ollama/vLLM), not tied to one provider.
6. **Invoice & stock immutability** — closed Folio freeze (voids → Cancelled Invoice) + read-only Stock Ledger Entry.

---

## 16. Current working state (after the technical rebrand)

- BildFast mode = **agile** (no waterfall phase gating). `.bildfast/`: `project.md` + `contracts/*` are real spec; **`business.md` is now a full authored analysis** (2026-09-04, owner-authorized). `architecture.md`, `tests.md`, `performance.md` remain **starter templates** (a gap vs the mature app). `plans/` and `epics/` empty.
- **Rebrand state:** canonical folder, Python package, Frappe app, database, site, routes, assets and demo identities are all `hotelpms` / `HotelPMS`. The legacy duplicate database and account were removed after a successful full backup. Production assets were rebuilt and the live role journeys were browser-tested.

---

## 17. Safe next-work workflow

1. Preserve the completed technical rebrand in reviewed commits and never restore the pre-rebrand package tree.
2. **Substantive work → `@bildfast-epic`** (agile: draft epic + stories from `project.md`/`contracts/*`, user approves, then `@bildfast-story` builds each story's FE+BE together). Small obvious tweaks inline.
3. Keep the internal `hotelpms` namespace; only visible text becomes HotelPMS. Preserve navy `#082B5C`, wordmark gold `#B8892E`, and interface gold `#C9A24B`.
4. `business.md` / `tests.md` are **user-owned** — propose filling them from the real app for approval; never edit silently.
5. After visible changes, the orchestrator builds (`bench build --app hotelpms` / `npm run build`) — SPA at `/hotelpms`, preview `hotelpms.yemenfrappe.com/hotelpms/book`.

---

## 18. UX/UI improvement round (2026-09-04)

A live, screenshot-based UX/UI pass over the deployed demo (desktop 1440 / tablet / mobile 390, Arabic-default
+ English, light + dark, real demo roles via one-tap login). Method: audit → fix in `frontend/src` reusing the
existing navy/gold tokens (no new identity/colours/fonts, no glass/old logo) → `npm run build` → re-verify
live. Screens reviewed: Login, POS (deep), Kitchen, Public Booking (desktop+mobile), Today, Dashboard,
Billing, HkApp (mobile), Revenue, Banquet, Settings. **No API/RBAC/backend/data changes.**

**Fixed (verified live):**
- **POS dark-mode contrast** — the open-bill "running strip" cards (Table F2/T6/T3) used `text-*-950`, a ramp
  step the `.dark` block never remaps, so titles/KOT/price rendered dark-on-dark. Switched to `-900` (remapped
  bright in dark, matching the floor-grid pattern). The Menu heading + menu-card item name used fixed
  `text-navy-900` on a `bg-white` card that flips dark → moved to auto-remapping `text-zinc-900`. (`screens/POS.tsx`)
- **Stray English plural "s" in the Arabic UI** — pluralisation was a separate `{n===1?"":"s"}` text node, so
  the live translator localised the noun (" night"→"ليلة") but left a standalone "s" ("2 ليلة s"). Added a
  `qty(n, singular, plural)` helper (`lib/i18n.ts`) emitting a single "<n> <noun>" token the UNIT map localises
  (→ "2 ليالٍ · 2 بالغون"; clean "2 nights · 2 adults" in EN). Applied to Today, CRS, GuestJourney,
  PublicCheckin, Banquet, HkApp; added `task(s)`/`property(ies)` to UNIT.
- **Untranslated strings on the Arabic-default UI** (more visible since the Arabic-first switch at `8546470`):
  added `ar.ts` entries "My Tasks"→"مهامي", "Completed"→"مكتمل", the two Today empty states, and the HK
  tasks-header tail.
- **Tablet header overflow** — the AppShell top header (`flex … gap-2`, no wrap) plus an unconstrained
  property `<select>` (long bilingual label) pushed content past the viewport at ~768–1024px (horizontal
  scroll on every authed screen). Added `flex-wrap` + a responsive `max-w`/`truncate` on the select
  (`lg:max-w-none` keeps it full on desktop). Also added an `onError` fallback to the POS menu card
  (defensive — swaps to the utensils icon if a menu photo URL fails). (`AppShell.tsx`, `screens/POS.tsx`)
- **Public booking page — bilingual clutter → clean hierarchy** (design polish, `screens/PublicBooking.tsx`,
  the product's marketing landing). Every "AR | EN" seed string rendered raw inline (hero title, the description
  shown in *both* full languages, room names, amenity chips, gallery captions, FAQ Q&A, address). Added a
  `<Bilingual>` helper that **script-detects** the Arabic vs Latin segment (order-agnostic — some seed fields are
  "EN | AR") and shows the current language prominent + the other as a smaller muted line; the secondary carries
  `data-no-translate` (the observer's skip hook) so it isn't re-translated, and language comes from `useT().lang`
  so the on-page EN/ع toggle flips the hierarchy live. Chips / room+gallery descriptions show the primary language
  only. Folded in: booking-widget subtitle → `ar.ts`, and two more `night{s}`/`listing{s}` plurals → `qty()`.
  Verified live: 20 raw "AR | EN" body nodes → **0** (only the shared `PublicChrome` footer note remains); EN
  toggle flips hierarchy; AR+EN, light+dark, desktop + mobile 390 all clean (no overflow / console errors /
  broken images), FAQ opens. The Google-Maps `<iframe>` renders blank in headless only — left untouched (works
  for real users).

**Verification:** `tsc -b` clean; `npm run build` clean; live re-checks confirmed legible POS dark cards,
"2 ليالٍ · 2 بالغون" (no stray s), Arabic empty states, "مهامي"/"مكتمل"; 0 console errors, no horizontal
overflow, no broken images across the reviewed screens; EN mode unregressed (LTR, "2 nights · 2 adults").
(SuperClaude `sc:*` commands aren't registered as invocable skills in this session, so their analyze→improve→
reflect method was applied inline; the ui-tester→runner→ui-fixer loop was substituted by a direct Playwright
audit, which can't be driven mid-session.)

**Left for the product owner (content/policy, not UI polish — not changed here):**
- The persistent demo banner says "data is restored every night", but the scheduled reset is a verified no-op
  on this site (`hotelpms_demo_mode` unset) → writes persist. Enable the reset or soften the copy.
- Bilingual "AR | EN" seed strings now render as a clean hierarchy (primary + muted secondary) on the **booking
  page**; **dropping a language entirely (single-language display) remains an owner decision**. Still raw/one-
  language: the shared `PublicChrome` footer note, English-only property policy text, and the other public
  screens (PublicListing, PublicCheckin, QrMenu) — extend the `<Bilingual>` treatment there if wanted.
- Demo guest names are largely Indian (Vikram/Sneha/Priya…), off-brand for a Saudi demo — a seed-data polish.
- Full staff dashboards still overflow horizontally at phone widths (~390px), driven by wide data tables and
  multi-column content that don't collapse below `lg` (e.g. the Today in-house table). The sidebar already
  collapses on mobile and the header now wraps; a proper phone pass (wrap wide tables in `overflow-x-auto`,
  responsive card grids) is a larger follow-up. Staff screens target tablet/desktop; phone users have the
  dedicated mobile-clean experiences (public booking, `/hk`, POS kiosk). Tablet (~834px) is fixed.

---

## 19. Calendar & Rooms UX round (2026-09-04)

Deep visual + functional pass over the availability calendar and rooms/occupancy screens, live-verified.
Targets: `components/CalendarView.tsx` (`/calendar`), `screens/TapeChart.tsx` (`/tape`). No API/RBAC/backend/
data changes; booking-bar interactions and money/availability logic untouched.

**Shared foundations (reused across screens):**
- Extracted `<Bilingual>` from PublicBooking to **`components/Bilingual.tsx`** (a move, not a fork — PublicBooking
  now imports it); script-detects the Arabic vs Latin segment, `data-no-translate` secondary, `useT`-reactive.
- New **`components/Legend.tsx`** — a compact colour-key row (swatch + label) reused on both calendars.
- New **`dateLocale()`** in `lib/money.ts` — dates follow the **UI language** (`getLang()`), forcing the
  Gregorian calendar on Arabic (`ar-SA-u-ca-gregory`; `ar-SA` alone is Hijri) with Arabic-Indic digits, else
  `en-GB`. Replaced the calendar screens' **four** hardcoded `en-IN` `toLocaleDateString` sites (CalendarView×2
  + TapeChart×2) so weekdays/months localise (were always English). `<input type="date">` stays LTR. Read at
  render: correct on every page load; an in-place EN/ع toggle flips the `<Bilingual>` labels live but leaves
  already-rendered *dates* in the prior language until the screen remounts (acceptable — no reactivity added).
  `Billing.tsx` still has **2** `en-IN` sites (out of this round's scope — deferred).

**CalendarView (`/calendar`):** locale-aware Arabic/English dates; a colour **Legend** (Available / Limited /
Sold out) replacing the English-only sentence; the title "Availability" now translates ("التوفر", range muted);
room-type row labels via `<Bilingual primaryOnly>` (no raw "AR | EN"); a **skeleton** loading state + an **empty
state**; the Today column tinted end-to-end; RTL-logical spacing (`pe/ms`).

**TapeChart (`/tape`):** locale-aware dates; a colour **Legend** (In-house / Confirmed / Held-blocked / Needs-
cleaning / Out-of-order) matching the bar + room-status tones; group headers via `<Bilingual primaryOnly>`;
"Position"→"الإشغال", "in use", "Days"/"Hourly", "Auto-assign arrivals" translated; `qty()` for the group
`rooms` count + the changeover-conflict plural.

**Rooms (`/rooms`, `ResourceScreen` + `roomsConfig`):** already solid (search, status filter, semantic
occupancy/HK badge tones). **Deferred (documented, not touched):** the Type column shows the room-type link ID
(`فندق نُزُل الرياض | Nuzul Riyadh Hotel-STD`) because the list API row carries only the `room_type` id, not
`room_type_name`; a clean fix needs that field returned by the API (or a `format?` hook on `ScreenConfig` fed
real data) — a small data/config follow-up, not string surgery on the ID.

**Verified live** (AR default + EN, light + dark, desktop 1440 + tablet 834): Arabic Gregorian dates + colour
legends render; EN mode shows English dates (the first `dateLocale()` keyed off the property money-locale and
leaked Arabic dates into the English UI — fixed to `getLang()`); no horizontal overflow (grids scroll
internally), 0 console errors, no broken images; the TapeChart booking-bar click still opens the reservation
sheet. (Dark-mode catch fixed during review: the `<Legend>` swatch ring was `ring-black/10` — invisible for the
neutral "Available" swatch on the dark card — now `ring-zinc-300`, which remaps.) `tsc` + `bench build` clean. (SuperClaude `sc:*` commands aren't registered as invocable skills here, so
their analyze→design→improve→reflect method was applied inline; the ui-tester→ui-fixer loop was replaced by a
direct Playwright audit.)
- Remaining English-heavy i18n gaps (Kitchen KDS labels LATE/MAIN/DESSERT/cooking, the Billing folios
  subtitle whose `ar.ts` key hardcodes "GST" vs the Saudi "VAT", night-audit summary sentences) — the same
  `qty()`/`ar.ts` technique applies; deferred to keep this change reviewable.

---

## 20. Session, role and demo-data reliability (2026-09-04)

**Root causes fixed:**
- Public `book` correctly switches to the governed writer, but the nightly demo reset deleted
  `agent@hotelpms.local` because it was not a clickable demo account; it then had no `HotelPMS Agent` role and
  the protected create call raised “Not permitted”. `seed_users.ensure_governed_writer()` now creates/repairs
  the non-login service identity; `seed_demo` always calls it and `reset_demo.KEEP_USERS` preserves it.
- Logout used to swallow every server error, clear React roles and navigate to login while the Frappe session
  cookie could remain valid. It now requires a successful logout + `whoami.user === "Guest"`, clears the prior
  active-property key, and hard reloads. Failure keeps the real session visible and shows an Arabic/English error.
- Module/tab state had four interpretations: AppShell used enabled modules, AppLauncher/CommandPalette did not,
  and route RBAC checked only roles. Shared `/apps` also borrowed the first permitted app's sidebar. A shared
  cached `useEnabledModules` now drives every surface; route authorization is `role ∩ enabled module`; shared
  routes show no borrowed sidebar. “New booking” is only visible to roles that can call its API.
- Re-running base showcase over the Saudi demo collided on renamed deterministic IDs and risked restoring the
  old menu. The seed recognizes the curated Saudi dataset and stays unchanged; Experience/Venue/POS identity
  checks are rename-safe.

**Verified live:** public guest booking created `RES-2026-01105` (Confirmed, SAR 1,495, pay at hotel); production
frontend build passes; Playwright passes Finance → server Guest → Restaurant POS, confirms roles do not leak,
Finance cannot see booking/Front Desk navigation, POS cannot see Billing, a direct `/billing` attempt redirects
to `/pos`, and `/apps` has neutral sidebar navigation. Default-data ownership and current counts are documented
in `docs/demo-data-control.md`.

---

## 21. Dashboard, deep-links & room-selection UX round (2026-09-04)

Independent UX/functional pass over the internal dashboard + availability screens, honouring the `ce6b769`
session-isolation model (route authz = **role ∩ enabled module**). No availability/pricing/booking-rule change;
no RBAC widening; the `auth-isolation` e2e test still passes after all changes.

**Shipped (4 commits, each built + live-verified):**
- **Rooms readable type + URL-filter deep-links** (`b01c93b`): `ScreenConfig` gains a `lookup` column option
  (resolve a Link ID → `<doctype>.<labelField>`, rendered via `<Bilingual primaryOnly>`) so the Rooms Type
  column shows the room-type *name*, not the id — a reliable formatter fed by real API data, no string surgery.
  Plus one-way URL-filter seeding (`/rooms?housekeeping_status=Dirty`, `?q=`, `?from=/to=`) for dashboard links.
- **Dashboard clickable KPI deep-links** (`eda14be`): every KPI tile + summary row with a destination is a real
  `<Link>` (keyboard/focus/hover), gated by `canAccessPath(to, roles, modules)` — a KPI the role/module can't
  open stays a plain, unlinked card (never hidden). Added the Arrivals/Departures/In-house tiles (already in the
  payload). Occupancy→`/tape`, Revenue/ADR→`/revenue-reports`, Collections/Outstanding/folios→`/billing`,
  room-status rows→`/rooms?housekeeping_status=…`, tasks→`/housekeeping?status=Open`. `IndianRupee`→`SaudiRiyal`.
  `StatCard` gained optional `to`/`onClick`. **Verified:** Hotel Admin sees all links; Front Desk sees only
  Occupancy + Today (4 links), zero Revenue/Billing/Rooms/Housekeeping links.
- **Book from a calendar/tape cell + board quick-nav + filters** (`2565d36`): empty tape room-day cells are
  booking buttons that open the New-booking dialog **prefilled with room-type + date** (verified: opens on
  2026-09-04 + type); `canCreateBooking` now flows through `ShellContext` and gates the cells (Calendar cells
  already prefilled, kept + gated). Shared `<BoardNav>` quick-switch Calendar/Tape/Rooms, role∩module gated
  (Front Desk: Calendar+Tape; Hotel Admin: all three). Tape floor + housekeeping-status quick filters
  (client-side on the existing payload).

**Deferred (documented, deliberately not shipped):**
- **BookingDialog stepped restructure (task #4):** the target order is dates→room→guest→review→confirm, but the
  component is 1244 lines on the money path and its current order differs; a safe reorder needs a full
  create+cancel re-verification. Deferred to protect the pricing/availability/create path (which the round was
  told not to change). **Note:** `create_booking` (api.py:3158) **auto-assigns** the room and has no
  `preferred_room` param, so tape-cell prefill is room-type + date only; a specific-room prefill would need a
  booking-logic change (out of scope). Follow-up plan: presentation-only numbered sections + a persistent
  price-review block + keyboard focus, every quote/create call byte-identical, verified with one labelled test
  reservation created and cancelled.
- **App-wide actionable cards / breadcrumbs (task #2):** the Dashboard is now fully actionable; the key detail
  screens (GuestJourney, FolioView) already carry back-links, so full breadcrumbs there are low-value. A broad
  audit of every remaining screen's silent cards + uniform loading/empty/error states is a follow-up.
- **Backend performance** — audited (see `performance.md` §"Calendar/Dashboard/Rooms performance audit"):
  `availability_calendar` recomputes `season_adjust` per (room-type × date) (~126–279 Season queries) + a
  per-type `get_doc`; `property_dashboard` loops `_day_stats` per day-of-month + a redundant `cash_summary`;
  `portfolio_dashboard` is N+1 over properties; no indexes on the hot filter columns. Invisible at demo scale
  (16 reservations / 24 rooms), a scaling risk — recommended fixes recorded, none applied this round.

**Page-by-page deep pass (2026-09-04, ongoing — binding order Dashboard→Today→Reservations→Rooms→Calendar→
Tape→BookingDialog).**
- **① Dashboard** (`screens/Dashboard.tsx`, `AppShell.tsx`): added a **loading skeleton** (was blank while
  fetching), a **date chip** in the header ("الجمعة، ٤ سبتمبر ٢٠٢٦" via `dateLocale`), and made the portfolio
  **"By property" rows actionable** — clicking a property switches the active property (synced to the top-bar
  selector via a new `ShellContext.switchProperty`) and drills into its property-view dashboard (no more silent
  rows; the demo has 3 properties). Verified live **Hotel Admin + Front Desk**: date chip shows, Front Desk
  still sees zero Revenue/Billing/Rooms/Housekeeping links, a portfolio click switched Riyadh→Olaya and reloaded,
  no overflow, 0 app console errors (only the benign socket.io realtime warning); `auth-isolation` e2e still
  passes; `tsc` + `bench build` clean.
- **② Today** (`screens/Today.tsx`): fixed the header date to follow the UI language (`dateLocale`, was
  browser-default), and made all six KPIs actionable — Arrivals/Departures/In-house **scroll to their on-page
  detail section** (anchor ids + `scroll-mt`), Occupancy→`/tape`, Revenue→`/revenue-reports`,
  Open tasks→`/housekeeping?status=Open` — the last three gated by `canAccessPath`. Verified: **Front Desk**
  sees Occupancy + the three scroll KPIs actionable and Revenue/Open-tasks static (gated); **Hotel Admin** sees
  Revenue + Open-tasks as links too. Arabic date, 0 console errors, no overflow. (Note: on the short demo page
  all sections fit the viewport so the scroll is small; it scales on a busy day.)
- **③ Reservations** (`screens/configs.ts`, `components/ResourceScreen.tsx`): the **Room** column showed the
  room's link id ("…Nuzul Riyadh Hotel-101") — fixed with the `lookup` option → shows the room number ("101").
  Added a **loading state** to `ResourceScreen` (skeleton rows while fetching; the empty "Nothing here yet."
  now shows only after the fetch, not misleadingly during it) — benefits every resource screen (**Rooms**,
  Room-types, Room-blocks, Housekeeping…). Verified live: 16 rows, Room = "101"/"302", a row opens the
  `ReservationDetail` panel, `?status=Confirmed` deep-link pre-filters to Confirmed only, no overflow, 0 console
  errors. (Reservations content is role-neutral; route access is covered by the `auth-isolation` e2e.)
- **④ Rooms** — already deep-passed earlier this session (`b01c93b`: readable room-type column via `lookup` +
  `?housekeeping_status=` URL deep-links; `2565d36`: `<BoardNav>` Calendar/Tape/Rooms) and now inherits the
  shared `ResourceScreen` loading state (③). Re-verified this pass (Hotel Admin): type column reads
  "غرفة نُزُل كلاسيك", 3 board tabs, rows open the edit drawer, HK-status filter present, no overflow, no
  regression — no new change needed.
- **⑤ Calendar** (`components/CalendarView.tsx`): on top of the earlier pass (locale dates, colour legend, i18n,
  cell→booking, skeleton/empty), added a real **error state** — the load had no `.catch`, so a failed fetch stuck
  the screen on the skeleton forever; now a failed initial load shows an error card with **Try again**, a failed
  refetch shows an inline error banner + **Retry** over the stale grid, and recovery reloads cleanly. Also an
  optional **room-type filter** (defaults to "All room types", primary-only labels, so the cross-type comparison
  stays the default). Verified live (Hotel Admin): filter narrows to one type; a forced `availability_calendar`
  failure surfaced the banner + Retry and recovering restored the grid; no overflow, 0 console errors. (Content
  is role-neutral; Front Desk sees the same, BoardNav = Calendar+Tape.)
- **⑥ Tape** (`screens/TapeChart.tsx`): the board had no loading/empty/error handling — `load()` had no `.catch`,
  so a failed `tape_chart` fetch left the grid blank forever (same latent bug as Calendar). Added `loading` +
  `loadError` (kept separate from the booking-Sheet `error`): initial-load skeleton (`TapeSkeleton`), a full error
  card with **Try again** when there's no data, an inline **Retry** banner over the stale grid on a failed refetch,
  and a subtle refetch dim. Added an **empty state** (`BoardEmpty`) when filters match no rooms, with a **Clear
  filters** button that resets room-type/floor/status. Cleaned the room-type filter dropdown to show the primary-
  language label only (was the raw "عربي | English" pipe) via a new shared `primaryLabel()` in `lib/dir.ts`
  (extracted from CalendarView; both screens import it). Verified live for **both roles**: Hotel Admin + Front Desk
  load 14 rooms; filters work; Executive+floor-1 → empty card + Clear filters restores the board; a forced
  `tape_chart` failure showed the Retry banner over the stale grid and recovered; bar→edit Sheet and cell→new-
  booking intact; Front Desk BoardNav correctly excludes Rooms; 0 console errors, no overflow. `auth-isolation`
  e2e still green (4.0s).
- **⑦ BookingDialog** (`components/BookingDialog.tsx`) — presentation + validation only, **no pricing/quote/
  payload change** (getQuote / grandTotal / createBooking untouched). Changes: (a) **visual sequence** — added
  "Guest details" and "Stay & rate" section headings to the flat form; (b) **clear validation** — a required
  `*` marker + `aria-required` on Guest name, and a helper line under Confirm that *explains* the existing
  `busy||!guest_name||!quote` gate ("Enter a guest name to continue" / "Getting the latest price…" / "Fix the
  issue above to continue") instead of a silently-disabled button; (c) **financial summary** — promoted
  "Deposit due now (N%)" to its own line inside the Total card (reuses the existing `(grandTotal*deposit_pct)/100`
  expression verbatim; guard unchanged — **not exercisable in demo data, all 3 properties have `deposit_pct=0`**);
  friendlier empty-quote placeholder ("Enter stay details to see a price."); (d) **success message** — the panel
  was half-English ("Booked · REF", "Room 201 assigned") in an AR-first UI; isolated the status word + guidance
  into translatable `<span>` nodes and reworded to "Room assigned: {n}" (number last), so it now renders fully
  Arabic. All new strings added to `ar.ts`.
  - **Live-verified (Front Desk):** tape-cell → dialog **prefill** (room_type + date) lands; guest **typeahead**
    finds returning guest (Omar Haddad) and attaches (returning-guest chip); far-future date shows **"Free
    cancellation"**; a garbage voucher surfaces the rose **error box** ("Voucher 'ZZINVALID' does not exist.") +
    the "Fix the issue above" helper + disabled Confirm; clearing it recovers the quote; Confirm creates the
    booking; improved **success panel is fully Arabic** ("محجوز · RES… · الغرفة المعيّنة: ٢٠١. ستجده ضمن الوصول…").
    Only console error was the deliberate bad-voucher 417 (expected).
  - **Create + cancel, "no financial trace" — PASS WITH ONE FINDING.** Created `RES-2026-01155`, cancelled it
    through the real UI (ReservationDetail → "Cancel this stay…" → preview "40 days before arrival · outside the
    fee window · free" → Confirm → `CXL-2026-00001`). Bench check: `status=Cancelled`, `cancellation_fee=0`,
    `Folio=0`, `Folio Charge=0`, `advance_paid=0` — **no money moved**. **Finding:** an uncollected **Required
    Security Deposit** (`DEP-01156`, required 500 / collected 0 / balance 0) is left dangling — the cancel path
    (`_do_cancel`) never releases it. Pre-existing **backend** money-domain bug (not introduced here); recorded
    as a planned fix for `@bildfast-backend` → **`.bildfast/plans/0003-release-deposit-on-cancel.md`** (awaiting
    Approve). Do NOT claim "no financial trace" unqualified — say "no money moved; one lifecycle bug pending fix."
  - Test data (`RES-2026-01155`, `RES-2026-01159` + their `DEP-*` rows) **deleted manually** after verification
    (deposit rows first, then reservations). The demo banner *claims* nightly restore, but per the owner note
    above the scheduled reset is a verified no-op → writes persist, so cleanup was done by hand rather than
    relied on.

### Post-parts review — Guests + Room Types (per "review only if no critical errors")
No critical errors after Parts 1–5 (`auth-isolation` e2e green; 0 code console errors). Reviewed both:
- **Guests** (`Guests.tsx`): healthy — last round's loading/error/pagination/dateLocale/keyboard-a11y all intact
  (13 rows, `role=button`/`tabIndex`, "٤ سبتمبر ٢٠٢٦" dates, no overflow). No change needed. (Not a ResourceScreen,
  so unaffected by the ResourceScreen URL/write-back changes.)
- **Room Types** (`roomTypesConfig`): loaded fine (no ResourceScreen regression), but the **Name column showed the
  raw "AR \| English" pipe** → FIXED by adding a reusable `bilingual?: boolean` column flag to ResourceScreen
  (renders via `<Bilingual primaryOnly>`, same as `lookup`) and setting it on the Name column; now shows "غرفة
  نُزُل كلاسيك". *Minor finding (recorded, not fixed):* a few column headers are English (`Base …/night`,
  `Extra adult …`, `VAT %`) because they interpolate `cur()`/`taxLabel()` — cleaner i18n would need splitting the
  static label from the interpolated unit.

### Connected secondary screens — read-only audit (proposed improvements, NOT applied)
_After ⑦, per the page-by-page brief: audit only the booking-connected screens (Rooms / Housekeeping / Guests)
and record a list — no fixes, no expansion. Live-checked as Hotel Admin; all three load with 0 console errors,
no overflow._
- **Rooms** (`ResourceScreen(roomsConfig)`) — already deep-passed in page 4 (boardNav, `room_type` lookup, status
  filter, loading/empty, pagination). Solid. *Optional:* add a **floor filter** to match Tape/Calendar (Rooms has
  a `floor` field). Low priority.
- **Housekeeping** (`ResourceScreen(housekeepingConfig)`):
  1. **Room column raw docname → FIXED.** Added `lookup: { doctype: "Room", labelField: "room_number" }` on the
     `room` column (same as `reservationsConfig.room`); the board now shows "302". Loading/empty/error are already
     inherited from ResourceScreen (skeleton, "Nothing here yet.", error banner at line 464), and task **details**
     open via the existing row-click edit sheet (room/type/priority/status/notes) — no bespoke panel needed. Live-
     verified (Hotel Admin): room shows the number, row-click opens the detail sheet, 0 console errors.
  2. **Status-vocabulary mismatch → FIXED this pass.** The list `filters` offered `["Open","In Progress","Done"]`
     but the Housekeeping Task `status` Select is `Pending / In Progress / Done / Verified` (default Pending;
     verified via `frappe.get_meta`). The "Open" option never matched anything. **This also broke a page-2
     deliverable:** Today's "Open tasks" KPI (count = tasks with status IN Pending/In Progress) deep-linked to
     `/housekeeping?status=Open` → an always-empty board. Fixed both: Today link → `?status=Pending` (the default
     open state; single-select can't express "Pending+In Progress"), and `housekeepingConfig.filters` options →
     `["Pending","In Progress","Done","Verified"]` (+ added `ar.ts` "In Progress"/"Verified"). Frontend-only, no
     doctype change. Committed separately as a page-2 defect repair.
  3. *Optional:* no `boardNav` (Rooms has one) — add for cross-navigation consistency.
- **Guests** (`Guests.tsx`, custom screen) — **all items below FIXED** (see the "Guests screen" entry after this
  section). Was: no loading state (false-empty flash), no `.catch` (blank/stuck on failure), **dead pagination**
  (`page`/`slice` present but no controls → only first 25 of up to 200 ever shown), raw `last_stay` dates, and
  non-keyboard rows (WCAG).

### Cross-cutting notes from the pages 5–7 pass (recorded, not fixed)
- **Board filter state now deep-linkable → FIXED.** Calendar's room-type filter (`?rt=`) and Tape's
  room-type/floor/housekeeping filters (`?rt=&floor=&hk=`) are now backed by `useSearchParams` (replace-mode) so
  they persist on reload and can be shared. **ResourceScreen** was extended to (a) support **dynamic filter
  options** via `optionsFrom: "<field>"` (fetches distinct, property-scoped values — used for the new **Rooms
  floor filter**), and (b) **write** its active filters/search/dates back to the URL (previously one-way read
  only), guarded by a `didSyncMount` ref so the mount-seed isn't wiped. Live-verified (Hotel Admin): Calendar
  `?rt=Classic` → 1 row on reload; Tape `?floor=2` → 5 rooms on reload; Rooms floor filter shows dynamic options
  (1–4), writes `?floor=3`, and reload seeds + filters to 4 floor-3 rooms. All URL-based → language/role-neutral
  (Calendar/Tape are Front-Desk screens too; Rooms is admin). The write-back applies to **all** ResourceScreens
  (Reservations/Housekeeping too) — filters now survive reload app-wide.
- **BookingDialog room-type pipe → FIXED.** Applied the shared `primaryLabel()` to all 5 raw `room_type_name`
  renders (main room-type `<option>`, additional-room `<option>`s, the over-capacity warning, the quote-rail room
  line, and the extra-room quote lines). Dropdown now shows e.g. "غرفة نُزُل كلاسيك · ر.س ٦٥٠/night" — no "AR \|
  English" pipe. Live-verified (Hotel Admin, AR). `primaryLabel` is language-adaptive (EN primary in EN) and the
  dialog is role-neutral → EN + Front Desk parity.
- **EN verified.** Pages 5–7 spot-checked with `hotelpms-lang=en`: `dir=ltr`, English headings/labels/helper text
  render correctly (e.g. Tape "Tape chart", dialog "Guest details"/"Stay & rate", English primaryLabel filter
  options). The only Arabic remaining in EN is **bilingual seed data** (property + room-type names stored as
  "AR \| EN") — by design, not a translation gap. Only console noise was a benign socket.io 400 (Frappe realtime).

### Public booking page UX polish (`screens/PublicBooking.tsx`) — plan `0005` (approved)
User was viewing `/book/…` and asked for best-UX/UI execution. Targeted refinement on the 1547-line
conversion-critical guest page — **no redesign, no booking/pricing change, navy/gold identity kept.**
- **Sticky mobile booking bar** — the stay-summary rail is desktop-only, so mobile guests had to scroll back
  up to continue after picking a room. Added `fixed bottom-0 z-40 lg:hidden` bar (room + total + "Continue to
  book") shown only when `selRt && selRes?.quote && !booking`, iOS safe-area padding, `pb-24 lg:pb-0` on the
  container so it never hides the footer. Reuses the rail's exact expressions + `setBooking(selName)`.
- **Location map** — the "Open in Google Maps" link was hidden whenever `google_maps_url` is null (true for the
  demo property, though coords exist) → guests got a map with no escape hatch. Now the button always renders
  from `google_maps_url ?? maps?q=<lat>,<lng>` and is styled as a proper brand button; embed made lazy + given a
  bg container (the earlier "empty gray box" was just an unloaded lazy iframe — it renders fine).
- **Bilingual policies/directions** — 5 bodies (house rules / pets / children / extra-bed / driving directions)
  now render through `<Bilingual>` (AR-primary + muted-EN) instead of the raw "AR \| EN" pipe.
- Verified live both viewports (390/1440) + AR/EN: bar shows/updates, Continue opens Sheet & bar hides (no
  z-fight), desktop unaffected (bar `display:none`, rail intact), no overflow, **0 console errors**. Sheet was
  opened + closed only — the public path creates real reservations, so no test booking was submitted.

### Guests screen UX fixes (`screens/Guests.tsx`)
Actioned the recorded audit gaps (highest-value internal item; `guests_with_stats` returns up to `LIMIT 200`):
- **Loading** — added `loading` flag + skeleton rows; the empty "No guests found." now shows only when
  `!loading && !error && rows.length===0` (was flashing during the in-flight fetch).
- **Error** — added `.catch(serverError)` + a `Try again` row (`reloadKey`); verified live via a forced
  `guests_with_stats` failure → error + Try again → recovery.
- **Pagination** — the dead `page`/`slice` logic now has real **Previous / Next** controls + "Showing X–Y of Z"
  (shown only when `pageCount > 1`); up to 200 guests are reachable (was silently capped at the first 25). Not
  visually exercised — demo has 13 guests (`pageCount===1`, controls correctly hidden) — but logic verified.
- **Dates** — `last_stay` now via `dateLocale()` (e.g. "٤ سبتمبر ٢٠٢٦") instead of the raw ISO string.
- **Keyboard a11y** — rows are now `role="button"` + `tabIndex=0` + Enter/Space handler + `aria-label` + focus
  ring (WCAG 2.1 — were mouse-only).
- Added `ar.ts` "Bookings"/"Showing". Verified live (Hotel Admin): rows keyboard-accessible, dates formatted,
  error/empty/recovery all work, 0 console errors.

### Deposit release on cancel (plan 0003, approved) — backend, money-domain
User approved with a strict constraint. `hotelpms/deposit.py:release_uncollected_deposit()` — on cancel, voids
**only** a `Required` deposit with `collected_amount == 0` (→ `Waived`, `required_amount=0`, reason); never a
collected one, never a refund, never a folio/payment/invoice entry. Wired into `_do_cancel` (covers desk + OTA
cancel). No `Authorized`/`Cancelled` status in this doctype → `Required`+uncollected is the guard, `Waived` the
terminal state (no schema change / no migrate). **Tests:** site tests disabled (`allow_tests` unset — not enabled
on the live demo); added pure-logic tests to `test_deposit_logic.py` (4 cases, pass) + a bench-console integration
run of all 3 required cases (Required→released / collected→untouched / none→clean) — **all pass, no leftover data**.

### ID / nationality at booking (user chose option b) — BookingDialog + create_booking
Optional identity capture during booking; **required only at check-in** (unchanged), never blocks a public or
internal booking when empty; no pricing/availability change.
- **Backend** (`api.py`): `create_booking` accepts optional `nationality`/`id_type`/`id_number`. A **brand-new**
  guest is created with them via `_find_or_create_guest(..., identity)` (overriding the doctype's `Indian`
  nationality default — the original bug: fill-if-blank alone left it "Indian"); an **existing/attached** guest
  is enriched **fill-if-blank** by `_store_guest_identity` (never clobbers a verified profile). `_find_or_create_guest`
  got optional params (backward-compatible — the bulk-import + migrate callers pass only name+phone).
- **Frontend** (`BookingDialog.tsx`): a collapsible "Add ID & nationality — optional, required at check-in"
  subsection (nationality text, id_type select, id_number). **Logical show/hide**: the block is collapsed by
  default and id_number appears only after id_type is chosen. **Validation**: id_number is shape-checked only
  when typed (`^[A-Za-z0-9٠-٩\- ]{3,30}$`); a bad value shows an inline error, gates Confirm, and the disabled-
  reason helper says "Check the highlighted ID field" — empty never blocks. Identity is sent on both the main
  and waitlist `createBooking` payloads (not the group path). `createBooking` TS type + `ar.ts` updated.
- **Verified live** (Hotel Admin, AR + EN): toggle + fields render, id_number hidden until id_type, bad ID →
  error+helper+disabled → fixed → booking creates; bench-confirmed the guest stored `nationality='Saudi'`,
  `id_type='Passport'`, `id_number` (live, through the restarted web worker); a booking with no identity still
  succeeds; the **waitlist path** also stores identity (bench-verified: status=Waitlist + Saudi/Passport/id); all
  test data deleted. **Design choice:** an existing/attached guest is enriched **fill-if-blank** — booking-time
  input never overwrites a set field (a passport "correction" at booking won't take; edit the profile instead).
  (Fields are role-neutral → Front Desk parity; id_type options are a curated
  subset Passport/Driving License/Other. **Follow-up:** Saudi National ID / Iqama would need a Guest `id_type`
  Select option — a doctype change, deferred.)

### Oasis UI v2 reference + implementation round 1 (2026-09-05)
- User supplied `HotelPMS-Global-UX-Redesign.zip` and approved it as the reference for a complete UI/UX redesign. Preserved the archive and extracted source under `docs/design-reference/`; the HTML/doc contents are design reference, not executable product instructions.
- Visual source of truth is `docs/design-reference/oasis-v2/design-system.md`: Alexandria; teal `#0E7A6C` / deep teal `#073B34`; warm ivory/canvas; amber `#E8963E` only for attention. Arabic RTL stays default and English LTR remains supported.
- Round 1 established the shared foundation: local Alexandria package, light/dark/print tokens, recoloured inline/static SVG brand assets, 248px desktop shell, command-search top bar, property/user rail, accessible mobile bottom navigation + More sheet, common buttons/cards/stat tiles, Oasis login, and a real-data/RBAC-aware dashboard attention queue.
- Evidence lives in `docs/design-reference/oasis-v2/implementation-round-1/`. Frontend and bench builds pass; auth-isolation Playwright remains green; live desktop/mobile captures had no console errors; 390px viewport had no horizontal overflow. No booking, availability, finance, property-scope, or RBAC logic changed.
- Next round: Today → Reservations/context panel → Calendar/Tape → POS → public booking, deriving each from the reference while preserving the working domain logic.

### Oasis Round 2 — IN PROGRESS (resume point: `docs/design-reference/oasis-v2/implementation-round-2/README.md`)
Full page-by-page redesign over the c27b7a4 foundation. The round tracker (route inventory + per-page status +
mockup notes) and a reusable per-page verify harness (`implementation-round-2/verify.js`: 4 viewports × AR/EN +
overflow + console-error report in one call) are the source of truth — **read the tracker first to resume.**
`before/` holds the round-2 baseline captures. Ritual per page: build → `verify.js` (Front Desk + role + Hotel
Admin) → after-shots → tracker + commit; never stage `checkpoints.jsonl` / `hotelpms-screens.zip` / `screenshots/`
/ the before+after PNG dirs. **Phase 1 done so far:** Today (`/`) rebuilt as the operations-centre (real
permission-aware needs-now queue via new shared `QueueCard`, KPI tiles, loading skeleton, kept all check-in/out
actions; fixed a pre-existing small-screen overflow) + Dashboard rechecked (shared QueueCard, `?status=Open`→
`Pending` fix) — commit `c0d107a`, verified clean. Day-timeline/live-feed deferred (net-new, data-heavy). Amber
discipline: reclassify `btn-gold`/`text-gold` → teal unless money/attention/VIP, per screen as reached.
