<!-- bildfast:plan id=0010 status=approved agent=bildfast task="Restore the full professional demo data so the owner can test all operations (user chose option 1)" -->
# Plan: Restore the full professional demo dataset

## Overview
The owner reported "all dates unavailable" and asked to clear the default data to test the system.
Investigation (`data_control.inventory`) showed the opposite of "too much demo data": the site was
**already nearly empty** — a single stray property **نون هوتيل** with **one room** plus one
reservation/group-booking, so almost every search was sold-out (and one screenshot used a *past*
check-in, which triggered the "check your dates" hint). I laid out three options; the owner chose
**option 1 — restore the full professional demo** so there is rich, available inventory to exercise
every operation.

## Plan
Data operation (no code change): back up, then seed the full Arabic/English showcase demo using the
app's own sanctioned seed scripts, and verify availability on a public listing.

## Execution Note
Done + verified live. **Data-only; no source files changed, nothing committed.**

**What I ran (all user-approved, backup taken first):**
1. `bench backup --with-files` → snapshot saved under the site's `private/backups/`
   (`20260906_153753-…`), so the prior state is fully restorable.
2. The sanctioned `reset_demo.execute` (wipe+reseed) was **blocked by the environment safety
   classifier** (it flags wholesale wipes). Rather than force it, I used the **additive** half of the
   same flow — the seed scripts — which is non-destructive and permitted:
   - `hotelpms.scripts.seed_demo.execute` → created **فندق نُزُل الرياض | Nuzul Riyadh Hotel**
     (rooms, guests, reservations) + full showcase (10 experiences, 2 restaurant outlets, 8 menu
     items, 4 banquet venues, laundry, tickets, handovers…) + **2 more properties** (Nuzul Diriyah
     Retreat, Nuzul Olaya Suites).
   - `hotelpms.scripts.seed_arabic_demo.execute` → enriched Nuzul Riyadh to the bilingual Saudi
     showcase: **14 rooms, 3 room types, 11 guests, 10 reservations**, 4 meal plans, companies,
     travel agents, vouchers, SAR pricing.

**Result:** inventory grew **21 → 495** records (217 master / 129 transactions / 148 child rows).
Nuzul Riyadh (`booking_engine_enabled=1`) shows real availability, e.g. **Oct 6–8: Classic 6 rooms
@ ر.س ١٬٤٩٥, Deluxe 5 @ ٢٬١٨٥, Suite 3 @ ٣٬٧٩٥**. Verified the public listing live (AR): the Nuzul
Classic page renders **"متاحة لتواريخك"** with the correct **SAR (ر.س)** currency and a working Book
button.

**Notes / follow-ups for the owner:**
- The old stray **نون هوتيل** (1 room, wrong ₹ currency) is left untouched (deleting a linked
  property manually risks orphans; the docs forbid it). It can be ignored, or I can remove it on
  request. Its `standard` slug still resolves, so its old page stays limited — use the new Nuzul
  listings instead.
- The **nightly auto-reset stays disabled** (`hotelpms_demo_autoreset=0`), so any data you create
  while testing will **persist** (it won't be wiped at 04:15).
- To wipe everything for a truly blank clean-entry round later, the sanctioned path is
  `data_control.purge` (needs the environment to allow the destructive command); reversible via this
  backup.
