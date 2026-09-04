<!-- bildfast:plan id=0003 status=approved agent=bildfast-backend task="Release the uncollected security deposit when a reservation is cancelled" -->
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
Approved by the user with a precise constraint: on cancel, release/void **only** an uncollected
deposit in a Required/Authorized state; **never** create a refund and **never** modify a Captured/Paid
payment, invoice, or existing financial entry. Implemented exactly to that:
- **`hotelpms/deposit.py` → `release_uncollected_deposit(reservation)`**: acts only when the deposit's
  `status == "Required"` **and** `collected_amount == 0`; sets it to `Waived` + `required_amount = 0` +
  reason "Reservation cancelled". Posts **no** payment/refund/folio/invoice entry. Returns `None` (no-op)
  for a collected or already-terminal deposit, or when no deposit exists. **Mapping note:** this doctype
  has no `Authorized` status and no `Cancelled` status — an authorized-but-uncollected hold maps to
  `Required` (status flips to Collected the instant any amount is captured), and `Waived` is the existing
  terminal "no deposit owed" state (satisfies `deposit_satisfied`), so no schema change / no `bench migrate`.
- **`hotelpms/api.py` `_do_cancel`**: calls `release_uncollected_deposit(res)` right after the reservation
  is saved Cancelled (covers both the desk `cancel_reservation` and the OTA channel-manager cancel, which
  share `_do_cancel`). No pricing/quote change.
- **Tests.** Site tests are disabled here (`allow_tests` unset — not enabled on the live demo), so per the
  fallback: (a) **pure-logic unit tests** added to `hotelpms/tests/test_deposit_logic.py`
  (`should_release_uncollected_deposit` + 4 cases — required→release, collected→no, none→no, terminal→no),
  all pass; (b) a **scripted bench-console integration check** exercised the three required cases live and
  **all passed with no leftover data**: ① Required/uncollected → `Waived`, `required_amount=0`, no folio
  payment, reservation Cancelled; ② collected 200 → status + `collected_amount` unchanged, folio-payment
  count unchanged (no refund posted); ③ no deposit → clean cancel, no folio.
