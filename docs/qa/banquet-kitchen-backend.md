# Banquet Kitchen — reuse map + backend follow-ups

_Prepared 2026-09-11. The page is **live**, built entirely on APIs the app already
ships. Two dormant fields activate on the next `bench migrate`; Material Request is a
phase-2 item._

## The page (live, no new backend)
`/banquet-kitchen` (list of **Confirmed** functions) + `/banquet-kitchen/:name` (one
function's kitchen view), under the Events app. It **reuses**, does not duplicate:
- `hotelpms.banquet.kitchen_indent` — dishes × portions × guaranteed pax, exploded
  through `Menu Item Ingredient` recipes, checked against the **shared** `Ingredient
  Stock`. Returns the materials (need / on hand / short) **and** dishes grouped by
  station (`by_kitchen`).
- `hotelpms.banquet.issue_indent` — deducts the **same** `Ingredient Stock` /
  `stock_ledger_entry` the restaurant draws on (`ref_dt="Venue Booking"`). No parallel
  banquet inventory.
- `hotelpms.banquet.record_consumption` / `add_supplementary` — actual pax, actual
  quantities, and extras ordered on the night.
- The `IndentSheet` / `CountSheet` / `SupplementarySheet` components are reused from
  `Economics.tsx` (exported). Confirmed events come from `listResource("Venue Booking")`.

No link to the POS KOT — shared items / recipes / ingredients / stock / stations only.

### One live fix shipped alongside
`IndentSheet`'s outlet picker now calls the whitelisted `hotelpms.pos.outlets`
(`require_roles` admits admins) instead of `/api/resource/POS Outlet` — which the banquet
roles 403 on (that doctype is in the perm-drift set). Fixes Issue-the-stock for gm@/admin@
in both this page and the Economics panel.

## Dormant fields (activate on `bench migrate`)
| doctype | field | type | purpose |
|---|---|---|---|
| Venue Booking | `kitchen_status` | Select: Unplanned / Planned / In Preparation / Ready to Serve / Served / Closed | the banquet-kitchen state, independent of the function status |
| Banquet Selection | `prep_status` | Select: Not Started / In Progress / Ready | per-dish prep state |

Both `modified` timestamps bumped. Backend touchpoints (already in source):
- `update_function` allowlist gains `kitchen_status` → the kitchen page's status
  select saves it via the existing `update_function`. `function_sheet` returns it via
  `as_dict`; the page **derives a read-only chip** until then and swaps to the editable
  6-state select once `fn.kitchen_status !== undefined`.
- `kitchen_indent`'s hand-built `by_kitchen` dict adds the selection row `name` +
  `prep_status` — **but only when `has_field("prep_status")`**, so the frontend renders
  the per-dish prep toggle (gated on `dish.name`) exactly when it can persist, never
  before. `set_dish_prep(function, selection, prep_status)` persists it.

Verified live: pre-migrate the indent omits `name`, so the toggle stays hidden; the
status chip derives correctly (Unplanned → Planned via the menu, Served via pax_actual,
Closed via closed_out_on).

## Phase 2 — Material Request (genuinely new subsystem, not yet built)
The app has **no purchasing concept** today (stock lives in `Ingredient Stock` /
`stock_ledger_entry`; there is no Material Request / Purchase Order / Stock Entry). The
shortage table is live now (from the indent); "raise a material request for the store"
is surfaced as guidance, **no dead button**. When you want it:
- New doctype **Material Request** (property, source `Venue Booking`, lines
  {ingredient, required, on_hand, short_by}, status Draft→Requested→Fulfilled) + perms.
- `create_material_request(function)` seeded from `kitchen_indent().ingredients` where
  `short_by > 0`; a list/approve API; fulfilment posts stock in via the existing
  `hotelpms.inventory._apply_move`.
- Frontend: a "Raise material request" button gated on `indent.shortfall_lines > 0`, and
  a small requests list.

## How to apply the dormant fields
```bash
bench --site <site> migrate
```
Then the per-dish prep toggle and the editable kitchen-status select light up with no
frontend release.

---

## Round 2 (2026-09-12) — completion + Economics-as-summary

Per the completion spec, the kitchen is now the sole operational hub and the
Profitability screen is a read-only summary.

**Live (Python reloads, frontend builds):**
- `issue_indent` now **blocks a double pull** — throws if a `Stock Ledger Entry`
  with `reference_doctype="Venue Booking", reference_name=fn, reason="Consumption"`
  already exists. `kitchen_indent` returns `issued {done, on, by, outlet}` from that
  same ledger (the audit trail — who/when/which store — already lives there; no new
  fields), plus `material_request_enabled = frappe.db.exists("DocType","Material
  Request")` as the button gate.
- **Economics is summary-only**: the "Build the indent", "Count the night" and
  "Ordered on the night" actions were removed; a read-only **Kitchen summary** card
  (dishes, guests, expected/actual ingredient cost, shortage, issue status, prep
  status) + an **Open Banquet Kitchen** button replaced them. The Quoted-vs-served
  table stays, read-only.
- **Cost → profit is already wired** (verified, nothing built): ingredient
  `cost_per_unit` → dish `cost_per_portion` → menu line `cost_rate` →
  `function_economics` → the Expected-profit tile, with the existing `uncosted_lines`
  warning when a recipe has no cost (so an uncosted dish is flagged, not silently
  treated as free).

**Dormant (one `bench migrate` lights them up):**
- **Material Request** + **Material Request Item** doctypes (property, function link,
  status Draft→Requested→Fulfilled, lines {ingredient, required, on_hand, short_by}),
  full standard perms, added to `fix_perms_fields.ALL_DOCTYPES`. `create_material_request(function)`
  seeds the lines from `kitchen_indent().ingredients` where `short_by>0` — reuses the
  indent's shortage math + the Ingredient master, no new stock logic. The frontend
  "Create material request" button is gated on `material_request_enabled`, so it
  appears only after migrate. **Approval/fulfilment is the remaining phase-2 step**
  (a status transition + fulfilment posting stock in via `inventory._apply_move`).
- `Banquet Selection.prep_status` is now the 4-state **Not Started / In Preparation /
  Ready / Served** (matches the per-dish toggle); still gated by `has_field` so the
  toggle only shows post-migrate.

**Not built (noted):** a per-line "issued quantity" editor — the existing `rows`
param on `issue_indent` already accepts partial quantities; a UI for it is deferred.
