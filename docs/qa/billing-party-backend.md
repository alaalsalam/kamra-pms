# Banquet billing party — backend follow-ups (dormant)

_Prepared 2026-09-10. The **frontend is live**; the items below are source-ready and
activate on the next `bench migrate` (the running server doesn't hot-reload and `bench`
is blocked in this session — same story as the other backend notes)._

## What already works live (no backend needed)
The banquet function's **Billing details** card now has a *جهة الفوترة / Billing party*
selector — **Guest / Company / Other party** — derived from existing fields (no new
`billing_party` column): a linked `company` ⇒ Company; a `billing_name` without a company
⇒ Other; otherwise the guest. Picking a Company auto-fills `billing_name` + `gstin` (VAT)
from the Company master and shows its contact read-only. Verified live (gm@): pick →
fill, Save → persists, switch to Guest → `company` clears. Place-of-supply + the manual
customer-tax field were removed. All labels are in `ar.ts`.

The frontend already reads these **opportunistically** — when the fields below land, the
fuller auto-fill and the PO input light up with **no frontend release**.

## Dormant source changes (activate on `bench migrate`)

### 1. `Company` doctype — master fields to pull from (`company.json`, `modified` bumped)
| field | type | purpose |
|---|---|---|
| `commercial_registration` | Data | السجل التجاري — shown read-only on the billing card, printable on the invoice |
| `billing_address` | Small Text | auto-fills the function's `billing_address` on company pick |
| `default_payment_terms` | Small Text | auto-fills the function's `payment_terms_note` on company pick |

_(Populating real values per company is data entry, not schema — do it in the Company
master once the fields exist.)_

### 2. `Venue Booking` doctype — `po_number` (`venue_booking.json`, `modified` bumped)
`po_number` (Data, "PO Number / Reference"). The billing card renders its input only when
`fn.po_number !== undefined` — i.e. after this field ships. `function_sheet` returns
`doc.as_dict()`, so the value appears automatically; no response-dict edit needed.

### 3. `banquet.py`
- `update_function` editable allowlist gains **`po_number`** (so the card can save it).
- `banquet_document`: the invoice's `place_of_supply` now **falls back to the property's
  city** when the function's is blank — so removing the manual field doesn't leave the
  invoice's place-of-supply empty.

## How to apply
```bash
bench --site <site> migrate
```
`migrate` syncs the two doctype JSONs (timestamps bumped) and loads the `banquet.py`
changes. No re-seed needed. Then in the Company master, fill CR / billing address /
default payment terms for the corporate accounts you bill.

## Verify after applying
- Company master shows CR / Billing Address / Default Payment Terms; fill Saudi Aramco.
- Function → Billing → party **Company** → pick Aramco → `billing_name`, VAT **and** the
  billing address + payment-terms note fill; CR shows in the read-only strip.
- The **PO number / reference** input appears; entering it and Save persists.
- Print an invoice with a blank place-of-supply → it shows the property's city.
