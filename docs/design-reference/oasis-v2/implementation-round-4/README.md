<!-- Oasis v2 — Implementation Round 4 tracker -->
# Oasis UI v2 — Round 4 (deep design transformation, benchmarked to `redesign-screens/v2-*` + `design-system.md`)

Base: `afefb28` (end of Round 3). Rule of this round: **"يعمل / structurally sound" ≠ احترافي.** Each screen is opened
visually, captured, compared to the reference, its user-task re-understood, and its **information architecture + interaction
re-structured** if primitive/generic/CRUD-like — not just ScreenHeader + KPI + translations. Identity per `design-system.md`
(Emerald Teal = `brand-*`, apricot amber = `gold-*`, warm neutrals, Alexandria, RTL default + EN LTR equal). Preserve all
real APIs, auth/permissions, real data, and the POS service-mode logic from `4649388`. HotelPMS is the only name.

Per-screen loop: **Inspect live → capture before → analyze journey → redesign → implement → build → functional test
(AR/EN × 1440/1024/390 × populated/empty/loading/error/denied) → capture after → independent review (P0/P1/P2 + score/10)
→ fix → retest → commit.** Advance only at score ≥ 9/10 with no P0/P1. Small commits per package. Screenshots in
`round-4/before` and `round-4/after` (same sizes + language).

## Package A — Restaurant (POS · Kitchen · QR Menu · Menu Items · Outlets · Inventory)
| Route | Before → After | Status | Notes |
|---|---|---|---|
| POS `/pos` | ~6/10 → target ≥9 | **implemented, in review** | Full render rewrite to the v2-05 reference: flex-column floor shell (teal identity bar → command bar with **persistent order-type segment** + **cross-mode bill chips** → 3-pane [tables·menu·cart] → shortcut footer). Order context moved to the left pane; cart reduced to lines/totals + 56px «للمطبخ»(brand-800)/«الدفع»(gold-500) + mini-row (Hold·Split·Discount·Bill·⋯) + pay/reserve/history sheets. **All `hotelpms.pos.*` APIs + the 4-mode state machine preserved.** JS-measured root height → panes scroll internally. **Verified live (kiosk):** AR+EN × 1440/1024/390, **document has zero scroll & zero horizontal overflow at 1440**, 0 console errors; all 4 modes genuinely swap the left pane (Dine In=tables · Room Service=in-house room+guest search · Takeaway=counter · Delivery=name/phone/address) — **tables fully hidden outside Dine In**; 390 = tabbed panes [الخدمة·القائمة·السلة] + sticky «الدفع» bottom bar. Fixed the orchestrator-review P1s: (1) English UI leaks → +49 AR keys + localized bill-chip/orderLabel via `t()`; (2)+(3) **kiosk desync** → 1-line resync in `lib/kiosk.ts` so a hard reload opens the real floor workspace (chrome/banner/sidebar hidden, restored on Escape/leave) — this also removed the 44px page overflow and full-width restored the column proportions. Backend gap logged: Delivery driver/time have no POS Order fields. |
| Kitchen `/kitchen` | ~5/10 → target ≥9 | **before captured, in progress** | Now opens a real kiosk floor workspace (kiosk fix) + carries the central sign-out. Before-analysis (1440+390, kitchen@): the board is **sparse** — tickets don't flow to fill the screen (one card floats, rest empty); no clear New→Preparing→Ready status columns; English chrome leaks ("tickets", station names Bar/Fryer/Grill/Tandoor/Kitchen, MAIN/DESSERT/KITCHEN course/station tags, "LATE", "guests · Capt. pos 2", "0 2 من ready", "cooking"); wait-time shows but cards need bolder large-screen legibility + colour escalation (green→amber→red). **Plan:** dense responsive ticket grid (auto-fill columns) that fills the board; status-driven card accents + delay pulse; order-type + table/room badge; per-item ready + card Accept/Bump; big-screen type scale; full AR i18n. Preserve every `hotelpms.pos.kitchen_queue`/`mark_prepared`/`accept_ticket`/`recall_prepared`/`acknowledge_void` call + the sound/station/outlet controls. Use live fired POS tickets as the populated/dense state. |
| QR Menu `/menu/:outlet` | — | queued | Guest-facing phone menu. |
| Menu Items / Outlets / Inventory | — | queued | Unify item→image→availability→price→stock journey. |

## Backend findings (Round 4) — for the BACKEND phase (out of the frontend lane)
- **[P2] POS Delivery has no driver / delivery-time fields.** `hotelpms.pos.create_order` accepts only `customer_name`,
  `customer_phone`, `delivery_address` for Delivery (POS Order doctype has `delivery_address` but no `driver` / `delivery_time`
  field). The Round-4 directive asks Delivery mode to show address + phone + **time + driver**; the frontend collects
  name/phone/address (what the backend accepts) and does NOT invent driver/time inputs (they'd be silently dropped). **Fix
  (backend):** add `driver` (Link/Data) + `delivery_time` (Datetime) fields to POS Order + thread them through `create_order`;
  the frontend delivery form then binds them.

### POS — independent review follow-up (bildfast-review: ship-safe, no P0/P1)
The review confirmed **all `hotelpms.pos.*` APIs + behavior preserved byte-for-byte** and the `kiosk.ts` change safe (no loop, no auth surface). Applied its P2 findings + the orchestrator's legibility pass in a follow-up commit:
- **[data integrity] NC `<option>` regained `value={w}`** — the `t()` sweep had made the complimentary-authoriser submit the *translated* label into `mark_nc(authorized_by=…)`; now sends canonical English again.
- **Escape now closes the pay/reserve/history sheets** (blockEscape + a scoped Escape handler) instead of exiting kiosk; height-fit deferred a frame on kiosk/fullscreen toggles so the pay buttons aren't clipped on Escape-restore.
- **i18n:** +14 keys — dynamic statuses (Running/Delivered/Fired/Prepared/Voided/Placed) + NC roles (Captain/Chef/Manager/GM/Management) + the KOT toast strings (via `.replace`) no longer leak English.
- **a11y:** aria-labels on all icon-only buttons (steppers, remove, back, New Bill) → **0 unlabeled icon buttons live**; More-menu items regained the `busy` guard.
- **Touch/legibility:** filter/area chips + inline void/NC/cancel/reserve controls bumped to ≥44px; menu-card price 13→15px, table-tile number/detail enlarged.
- Re-verified: tsc 0, build green, **auth-isolation 5/5**, live kiosk no-scroll/no-overflow, 0 app console errors, fresh hash deployed.
