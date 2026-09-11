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
