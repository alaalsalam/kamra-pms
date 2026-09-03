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

**Verification:** `tsc -b` clean; `npm run build` clean; live re-checks confirmed legible POS dark cards,
"2 ليالٍ · 2 بالغون" (no stray s), Arabic empty states, "مهامي"/"مكتمل"; 0 console errors, no horizontal
overflow, no broken images across the reviewed screens; EN mode unregressed (LTR, "2 nights · 2 adults").
(SuperClaude `sc:*` commands aren't registered as invocable skills in this session, so their analyze→improve→
reflect method was applied inline; the ui-tester→runner→ui-fixer loop was substituted by a direct Playwright
audit, which can't be driven mid-session.)

**Left for the product owner (content/policy, not UI polish — not changed here):**
- The persistent demo banner says "data is restored every night", but the scheduled reset is a verified no-op
  on this site (`hotelpms_demo_mode` unset) → writes persist. Enable the reset or soften the copy.
- Public pages render bilingual "AR | EN" seed strings raw (title/amenities/description) — a content-model
  choice; consider one language per direction.
- Demo guest names are largely Indian (Vikram/Sneha/Priya…), off-brand for a Saudi demo — a seed-data polish.
- Remaining English-heavy i18n gaps (Kitchen KDS labels LATE/MAIN/DESSERT/cooking, the Billing folios
  subtitle whose `ar.ts` key hardcodes "GST" vs the Saudi "VAT", night-audit summary sentences) — the same
  `qty()`/`ar.ts` technique applies; deferred to keep this change reviewable.
