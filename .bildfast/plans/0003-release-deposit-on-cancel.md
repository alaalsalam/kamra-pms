<!-- bildfast:plan id=0003 status=planned agent=bildfast-backend task="Release the uncollected security deposit when a reservation is cancelled" -->
# Plan: Release the uncollected security deposit on cancel

## Overview
While verifying the page-7 requirement "create one booking and cancel it with **no financial
trace**", the monetary checks all passed (cancellation fee 0, no folio, no folio charges, advance
0, deposit collected 0 / balance 0 — no money moved). But one **pre-existing backend
data-integrity leak** surfaced:

- When a Property requires a security deposit (`Property.security_deposit_amount > 0`),
  `hotelpms.deposit.ensure_deposit_for_reservation` creates a **Security Deposit** row with
  `status="Required"` at booking time.
- The cancel path (`hotelpms.api._do_cancel` / `cancel_reservation`) sets the Reservation to
  `Cancelled` but **never touches the deposit** (`grep` of the cancel path for "deposit" → no hits).
- Result: a cancelled booking keeps an **open "Required" deposit** (evidence this session:
  `RES-2026-01155` → `DEP-01156`, `status=Required`, `required_amount=500`, `collected_amount=0`,
  `balance=0`). It would pollute any "deposit due" report for a stay that no longer exists.

No actual money is involved (nothing was collected), so this is a lifecycle/reporting correctness
bug, not a monetary loss — but it means the "no financial trace" criterion is only met *with this
caveat*. This is **backend money-domain work**, so it is intentionally NOT done inside the
frontend page-7 pass — it needs a controller change + a `FrappeTestCase`.

## Plan
`@bildfast-backend`:
1. In `hotelpms/api.py` `_do_cancel` (the shared desk + OTA cancel path), after the reservation is
   set to `Cancelled`, release an **uncollected** required deposit:
   - Look up the Security Deposit for `res.name` (guard on `frappe.db.exists("DocType","Security Deposit")`).
   - **Only when `flt(dep.collected_amount) <= 0`** (nothing was ever collected): mark it released —
     set `required_amount = 0` and a terminal status (reuse `"Waived"` with a `reason` like
     "Reservation cancelled", or introduce a dedicated `"Released"`/`"Cancelled"` status on the
     Security Deposit doctype if a distinct state reads better in reports; prefer the smallest change
     that keeps `deposit_satisfied()` correct). Save with `ignore_permissions=True` inside the
     existing `frappe.flags.hotelpms_cancelling` block.
   - If `collected_amount > 0` (guest actually paid a deposit then cancelled), **do NOT auto-waive** —
     that is a refund scenario; leave the row for the existing refund flow (`hotelpms.deposit.refund_deposit`).
2. Consider the symmetric case for the OTA channel-manager cancel (same `_do_cancel`, so covered).
3. Add a `FrappeTestCase` (e.g. `test_cancel_releases_uncollected_deposit`): a Property with
   `security_deposit_amount > 0`, create a Confirmed reservation (deposit row = Required), cancel it,
   assert the deposit is released (`required_amount == 0` / terminal status) and that **no** Folio,
   Folio Charge, or Folio Payment exists for the reservation. Also assert the `collected_amount > 0`
   case is left untouched by the cancel.
4. No pricing/quote/tax logic changes. `bench build --app hotelpms` is not required (backend only),
   but do NOT run `bench migrate` (the pipeline applies any doctype change).

## Execution Note
_pending — filled after execution_
