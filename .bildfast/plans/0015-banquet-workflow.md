<!-- bildfast:plan id=0015 status=planned agent=bildfast-frontend task="Banquet/Events end-to-end workflow cleanup" -->
# Plan: Banquet / Events — End-to-End Workflow Cleanup & Fix

## Overview

Target flow: **Inquiry → Quote → Profitability → Payments → Documents → Event Execution → Closeout**, bilingual (AR RTL / EN LTR), with Back / Save / Save&Continue on every stage, validation gates, correct cost/profit + payments/deposit logic, a real document workflow, integrated Banquet Kitchen, dynamic execution, and controlled closeout.

**Key finding from a full read-only audit (4 parallel agents over `BanquetFunction.tsx`, `banquet/*.tsx`, `banquet.py`, `banquet_ops.py`, `venue_booking.*`):** the module is **mature and reuse-heavy** — `venue_booking` is a 128-field doctype that already models status, `kitchen_status`, `payment_terms`, `receipts`, the full security-deposit set, closeout, and quote/BEO/invoice/contract tracking; the catalogue, +Menu/+Service pickers, guaranteed-pax pricing, dish→kitchen flow, cost/margin, and an operational department checklist all exist. This is a **cleanup + wiring + validation + i18n** effort, **not a rebuild**. No parallel systems; every fix extends an existing endpoint/component.

This plan is **phased**. Phase 1 (safe, no schema, most-requested) ships immediately. Phases 2–5 carry schema (migrate) and workflow risk and are gated on this plan's approval.

---

## A. Current State Analysis (exists ✓ / gap ✗) — per stage

**Workflow shell (§1).** ✓ 6 frontend steps (`enquiry|quote|margin|money|documents|close`, `Steps.tsx`) derived from data via `stepsFor()` with per-step `done`/`blocker`. ✓ Server-enforced status machine (`Enquiry→Tentative→Confirmed→Completed`, `TRANSITIONS`↔`NEXT`). ✗ Current stage not persisted (always resets to Enquiry). ✗ No fixed Back / Save / Save&Continue (only a per-tab sticky dirty-footer on the Detail tab; dirty state is **per-tab local**). ✗ No stage-advance validation gate (nav is free). ✗ 6 steps vs 7 target (split `close`→Execution+Closeout).

**Quote + Catalogue (§4, §5).** ✓ Already completed: +Menu/+Service pickers from Event-Catalog masters, auto-fill name/price/tax/cost, qty follows Guaranteed Pax (`billable_pax`, server-enforced with `min_pax` floor), agreed-price override without touching the master, manual/blank lines, bilingual catalogue + kitchen/department/supplier fields (dormant until migrate). ✗ minor: catalogue subtitle "min N pax" not translated.

**Profitability (§6).** ✓ Revenue / Cost / **Expected profit** tiles, uncosted-lines warning, kitchen **summary** (dishes, guests, ingredient cost, actual cost, short, issue status, prep status), **Open Banquet Kitchen** button (gated Confirmed/Completed). ✗ When cost is incomplete it still shows an optimistic % rather than a clear "Cost incomplete" state.

**Payments (§7).** ✓ `payment_terms` milestones + `receipts` + folio link; deposit **intake** cleanly separated from revenue (`deposit_held` = Σ Security-Deposit − refunded − damage); totals derived in controller. ✗ Milestone statuses `Pending/Overdue/Received/Waived` (target: Not Due/Due/Partially Paid/Paid/Overdue/Cancelled) — money-blind, no Partially Paid. ✗ No 100% / quote-total validation on `set_payment_terms`. ✗ Receipt dialog missing date/account/notes/attachment/stored-milestone-link. ✗ Receipts never post to the real accounting ledger (the stay side's `add_folio_payment`/`refund_folio_payment` + Folio-Ledger Deposit bucket are reusable). ✗ **BUG:** manual `Refund` uncapped. ✗ **BUG:** a deposit-return `Refund` receipt nets negatively into `advance_received` → inflates `balance_due`.

**Documents (§8).** ✓ One generator `banquet_document(kind)` for quote/contract/beo/pack_list/invoice/menu_card; quote email/WhatsApp via `send_quotation`; quote revision history. ✗ No per-document status lifecycle (state derived from timestamps; `contract_signed_on` is a dead, never-written field). ✗ Thin gating — BEO only needs Confirmed (the desired predicates already exist as **advisory alerts** in `_function_alerts`). ✗ **Invoice action is never called from the UI** — invoices stay "Draft". ✗ Documents-stage files use i18n **zero times** (all hard-coded English). ✓ Checklist is fully operational (no rebuild needed).

**Event Execution / Closeout (§10).** ✓ `pax_actual`/`billable_pax`, `actual_qty` (bills on served), `is_supplementary` extras (flow into function cost/billing/profit), deposit fields, dynamic-instantiation department checklist with `completed_on`/`completed_by`. ✗ Stage mislabeled "The night", under-scoped (execution capture lives on the Kitchen page; checklist is global not stage-scoped). ✗ Checklist content is static templates (not derived from what was sold) and has no `responsible` person. ✗ Extras/damage lines added after `post_to_folio` never reach the folio (single-shot post, no delta). ✗ Closeout has no readiness/settlement guard AND can be bypassed entirely by the header "Close out" button calling `set_status("Completed")` with zero closeout data (then permanently locks actuals via `_guard_closed`).

**Banquet Kitchen (§9).** ✓ Already built to spec: dishes by station, portions, ingredient requirements, stock, shortage, Material Request, Issue with duplicate-prevention, per-dish status (Not Started→Served), overall `kitchen_status` (Unplanned→Closed), actual pax/consumption, supplementary orders. Separate from POS KOT, shares items/recipes/ingredients/stock. Needs i18n only.

---

## B. Implementation Plan (phased)

### Phase 1 — i18n + naming + profitability + close-bypass  *(shipping now; within-request, no approval gate)*
- **§2 i18n:** add every missing user-facing string (≈107 frontend + ≈93 backend `_()` messages) to `lib/translations/ar.ts`, professional hotel-ops Arabic, matching house terminology. Keys = decoded rendered text. Short-key collisions (≤3 words) grep-checked app-wide; source-renamed if they collide. Runtime DOM-collector verification per stage.
- **§12 naming (rename before translating):** step labels `Margin`→`Profitability`, `Money`→`Payments`, `The night`→`Event Execution` (in `Steps.tsx`); keep §12 terms (Expected Profit ✓ already, Financial Transaction, Refundable Security Deposit, Open Banquet Kitchen) consistent in the catalogue.
- **§6:** when `uncosted_lines` exist, show a **"Cost incomplete"** state on the profit tile instead of an optimistic %.
- **Bug — closeout bypass:** remove `"Completed"` from `TRANSITIONS["Confirmed"]` (`banquet.py`) and `NEXT.Confirmed` (`shared.tsx`); the only path to Completed becomes the CloseOut flow (`close_out` sets `doc.status` directly — verified safe). Header quick-close routed to / replaced by the CloseOut card.
- Files: `lib/translations/ar.ts`, `screens/banquet/Steps.tsx`, `screens/banquet/Economics.tsx`, `screens/banquet/shared.tsx`, `hotelpms/banquet.py`. No migration. Build + live-verify + path-scoped commit.

### Phase 2 — Workflow backbone (§1)  *(needs approval; 1 dormant field)*
- Shared **stage footer** (Back / Save / Save&Continue) generalising the Detail-tab sticky footer; lift a `save()` callback + `dirty` out of each tab (Detail/Items/Money/Paper) so one footer can drive them.
- **Validation gate:** Save&Continue calls the tab's save then blocks on `stepsFor()`'s existing `done`/`blocker` with a clear message; stage-specific CTAs (Save and Create Quote, Approve Quote and Continue to Profitability, …).
- **Split** `close`→**Event Execution** + **Closeout** (7 stages).
- **Stage persistence:** interim (no schema) — open on `stepsFor()`'s first not-done step instead of hard-coded Enquiry; exact via a **dormant `workflow_stage`** field on `venue_booking` (+ add to `update_function` editable set; note `_guard_closed` throws on Completed → needs a stage-save exemption).

### Phase 3 — Payments (§7)  *(needs approval; new Banquet Receipt fields = migrate)*
- Fix the **deposit-return / uncapped-refund** bugs first (independent — can be pulled forward on request; verify `_totals` `balance_due` against a throwaway function before shipping).
- Milestone statuses → Not Due/Due/Partially Paid/Paid/Overdue/Cancelled (extend the existing date auto-flip + money-driven from allocated receipts); server-side 100%/quote-total validation in `set_payment_terms`.
- **Financial Transaction** dialog: add date/account/notes/attachment/linked-milestone (new dormant fields on Banquet Receipt); types already correct.
- Route receipts through the existing **folio payment/ledger** layer (`add_folio_payment`/`refund_folio_payment`, Deposit ledger bucket) for cashier session + business-date + ledger + capped/reasoned refunds.

### Phase 4 — Documents (§8)  *(needs approval; mostly derivable, no migrate)*
- Per-document **status** derived from existing timestamps/numbers (+ a real contract "Sign" action writing the dead `contract_signed_on`).
- **Dependency chain**: promote `_function_alerts` predicates (pax, menu, services, commercial structure, venue) from warn→**block** inside `generate_beo`; wire guest-confirmation as the Approve-Quote gate.
- **Wire the orphaned Invoice action** into the UI; extend send (email/WhatsApp) to contract/invoice/BEO; i18n the send buttons + `_quote_html` body.

### Phase 5 — Execution / Closeout (§10)  *(needs approval; task `responsible` + guard fields = migrate)*
- Rename/re-scope the stage; host the existing Count/Supplementary sheets + a stage-scoped checklist on it.
- **Dynamic-from-sold** checklist (drive tasks from sold lines' `Banquet Service Item.department`) + a `responsible` (User) field (dormant).
- **Delta folio post** for extras/damage added after the first post (reuse `add_folio_charge`).
- **Closeout guards:** block early close until Actual Pax + required tasks + extras + damages + final charges + balance reviewed + deposit settled; single "Save and Close Event".

### Migrations — **the user's decision**
Phases 2–5 accrete **dormant schema** (already-waiting bilingual catalogue fields + `workflow_stage`, Banquet Receipt fields, task `responsible`, closeout-guard flags). All ship **gated** (hidden/inert) and light up together in **one migrate/deploy window**. Running migrate is a tenant-wide event and is out of this agent's scope — it is a deliberate action for the owner. Until then, every prepared field stays dormant and the UI hides it.

### Open question — **Amendment / Change flow (§11)** — **not in business.md**
Post-confirmation edit control / a formal amendment flow has no trace in `business.md`. Proposed as a clickable question (add to business.md / drop / defer). Not designed until answered. Interim: confirmed functions already block edits after Completed via `_guard_closed`; the `revisions` table already logs quote changes.

## Execution Note
Phase 1 implemented this turn (i18n + naming + §6 + bypass fix), verified live, committed. Phases 2–5 await approval of this plan; each will be built, verified per stage, and committed independently, with schema shipped dormant per the Migrations note.
