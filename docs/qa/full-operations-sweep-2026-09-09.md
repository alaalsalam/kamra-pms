# HotelPMS — Full Operations Test Sweep (2026-09-09)

Live target: `https://hotelpms.yemenfrappe.com/hotelpms/`
Method: sequential live driving via Playwright (own browser instance), core lifecycle chained
first, then render+console smoke for the rest. Findings written after each journey.

Demo logins (passwords intentionally omitted from version control):
- admin@hotelpms.local (System Manager)
- gm@hotelpms.local (Hotel Admin)
- frontdesk@hotelpms.local (Front Desk)
- revenue@hotelpms.local (Revenue Manager)
- finance@hotelpms.local (Finance)
- housekeeping@hotelpms.local (Housekeeping)
- pos@hotelpms.local (Restaurant POS)
- kitchen@hotelpms.local (Kitchen)

Rules for this sweep: destructive verbs (cancel/void/checkout) only on records THIS sweep created;
never on seeded demo records. Setup wizard render-only (do not submit setup_property).

Test booking marker: guest name "TEST اختبار", dates 2026-09-10 → 2026-09-12, 2 adults.

---

## Findings log

| # | Journey | Role | Result | Evidence | Severity |
|---|---------|------|--------|----------|----------|
| 1 | Public booking search → guest form → create reservation | (public) | ✅ PASS | Created **RES-2026-01994**, total ر.س ١٬٤٩٥. `public_api.book` → 200, 0 console errors. | — |
| 1a | Booking UI i18n leaks | (public) | ⚠️ minor | "Add experiences" label, deposit line, and confirmation subtitle ("…payable at the hotel. We've saved your number; the front desk will reach out…") render in English on AR. | P3 |

| 2 | Front Desk login (quick-login) → RoleHome "Today" board | Front Desk | ✅ PASS | Rich Today board: arrivals/departures/in-house/occupancy/room-status all render. | — |
| 2a | Reservations DataGrid (list + filters + row drawer) | Front Desk | ✅ PASS | 19 records, my RES-2026-01994 visible; row → detail drawer works. | — |
| 2b | Check-in RES-2026-01994 (early check-in, arrival tomorrow) | Front Desk | ✅ PASS | `api.check_in` → 200, allowed early check-in as designed. | — |
| 2c | Check-in dialog i18n leaks | Front Desk | ⚠️ | Dialog mostly English: "Check in", "Registration", "Open GRC", "Online check-in not sent", "ID on file", guidance paragraph, "Check in to 102" button. | P2 |
| 2d | Room line text bug in check-in dialog | Front Desk | 🐞 BUG | "الغرفة 102 **is assigned**نظيفة" — English "is assigned" + missing space glued to "نظيفة". | P2 |
| INFRA | socket.io realtime | (all desk pages) | ⚠️ | `GET /socket.io/…` → 400 (Frappe websocket not proxied on this host); console noise, no functional break. | P3/env |
| 2f | **Check-in allowed double occupancy of room 102 with no warning** | Front Desk | 🐞 BUG | RES-2026-01909 (علاء عبدالله) was in-house in room 102 (checkout 09-10) when I checked TEST اختبار (RES-2026-01994) into the **same room 102** on 09-09. `api.check_in`→200, no conflict prompt; the dialog even mis-stated status ("102 is assigned **نظيفة**") while the Today board showed 102 occupied. POS room picker then listed BOTH "الغرفة 102 علاء عبدالله" and "الغرفة 102 TEST اختبار" as in-house. FD can silently double-book a physical room. | **P1** (real-hotel) / P2 (demo) |

| 2e | Folio deep-link `/billing/:name` as Front Desk | Front Desk | 🐞 BUG | Redirects to home. `apps.ts` finance app roles exclude "Front Desk", but in-app copy says *"Billing is for reception, finance and management"* and the FD board says *"collect balance from Billing before checkout"* + GRC links to `/billing/:folio`. Reception is directed to a page it can't open. | P2 |

| 3 | Finance login → Billing screen (open folios, night audit, folios table) | Finance | ✅ PASS | 16 open folios, night-audit runs listed, my FOLIO-2026-01997 present. 0 console errors. | — |
| 3a | Folio view (provisional bill, VAT, tax#, guest/room/dates) | Finance | ✅ PASS | Full bilingual provisional bill renders for FOLIO-2026-01997. | — |
| 3b | Folio posting — add charge (F&B ر.س ١٠٠ @ 15% VAT) | Finance | ✅ PASS | Row posted; Charges ١٠٠ + VAT ١٥ = Total ١١٥. VAT math correct. | — |
| 3c | FolioView i18n leaks | Finance | ⚠️ | Untranslated on AR: "طباعة folio", "الضيف folio", "ضريبة القيمة المضافة **summary**", category options (Food & Beverage/Minibar/Early Check-in/Late Checkout/Misc), "Security Deposit", "Payment Link", "Alcohol", allowance hint, buttons **"Allow"** & **"Record"**, "SAR One Hundred". | P2/P3 |

| 4 | POS screen render (4 order types, tables, menu, cart) | Restaurant POS | ✅ PASS | Full AR render, 0 console errors, kitchen printer "متصلة". | — |
| 4a | **POS create dine-in order → send to kitchen** (the 09-07 permission-bug flow) | Restaurant POS | ✅ **PASS** | `pos.create_order`→200, `confirm_order`→200, `fire_kot`→200. Cart cleared, "في المطبخ" 4→5. **No permission error under pos@.** | — |
| 4b | POS VAT math | Restaurant POS | ✅ PASS | Kabsa 86 + 15% = ر.س ٩٨٫٩٠. | — |

| 4c | POS service-context switching (all 4 modes) | Restaurant POS | ✅ PASS | Dine-in→tables; Room service→in-house room picker (incl. 102 TEST اختبار); Takeaway→counter+customer; Delivery→customer+phone+delivery-address. Tables correctly hidden outside dine-in. | — |

| 4d | **POS create order as admin@ (System Manager) — the reported bug** | System Manager | 🐞 **BUG (P1)** | `pos.create_order` → **403** (req #155). Reproduces the user's 09-07 error. Discriminator vs 4a: **pos@ role → 200, admin@ → 403.** Root cause: POS Order Custom DocPerms grant create to "Restaurant POS" (via `seed_users.ensure_roles`) but NOT to the ADMIN tier (System Manager/Hotel Admin/Administrator); `@require_roles` passes them at the API gate, then `doc.insert()`'s perm check denies → 403. Fix = backend DocPerm correction + migrate/reload (blocked for me; awaits user's option أ/ب). | **P1** |
| 4e | POS 403 not surfaced clearly in UI | System Manager | ⚠️ | On the 403, no persistent error message; the item stays in the cart, so the action looks like it silently did nothing. | P2 |

| 5 | Kitchen display render (stations, tickets, order-type labels) | Kitchen | ✅ PASS | 9 tickets; fully AR ("منطقة تسليم المطبخ", المطبخ/التنور/الشواية/المقلاة/البار, داخل المطعم/سفري/خدمة الغرف, تجهيز صينية/تغليف للأخذ). My fired orders appear incl. room-102 room-service. 0 console errors. | — |
| 5a | Kitchen bump/accept as kitchen@ | Kitchen | ✅ PASS | `pos.accept_ticket` → 200 (#80). Real operator works. | — |
| 5b | **Same bump as admin@** (perm bug extends to writes) | System Manager | 🐞 BUG | `pos.accept_ticket` → **403** (#32) while `kitchen_queue` read → 200. Confirms the POS Order write-perm gap is admin-tier-wide (create + accept), not just create_order. Same backend fix as 4d. | P1 (same root cause) |

| 6 | Housekeeping mobile app /hk @390px (task card, bottom nav, tabs) | Housekeeping | ✅ PASS | Task card + 4-tab bottom bar (مهامي/متاح/الغرف/المغسلة) well-formatted (earlier fix holds); lang pill above nav. Rooms tab lists all rooms w/ HK status. 0 console errors. Did NOT complete the seeded task (no-collateral-mutation rule). | — |
| 6a | /hk i18n leak | Housekeeping | ⚠️ | Task chip "**arrival** اليوم" — "arrival" untranslated. | P3 |

| 7 | Dashboard / Tape / Calendar / Rate Plans / Channels / Reports / Inventory render+console | System Manager | ✅ PASS | All render with content; only the socket.io baseline error. (Dashboard occupancy shows "0% · 6/14" — minor calc/display quirk.) | — (P3 note) |
| 7a | **Menu Items screen as admin@** | System Manager | 🐞 BUG | `/api/resource/Menu Item` → **403** and `/api/resource/POS Outlet` → **403**; screen renders empty (textLen 287). Admin tier can't READ the POS/F&B doctypes. **Same DocPerm root cause as 4d, spanning the whole POS family (Menu Item, POS Outlet, POS Order, POS Table Reservation).** | P1 (same root) |

| 7b | **Outlets screen as admin@** | System Manager | 🐞 BUG | `/api/resource/POS Outlet` → **403**; screen empty. Same POS-family DocPerm gap. Net effect: 4 admin-tier surfaces broken — POS order create, kitchen bump, Menu Items, Outlets. | P1 (same root) |

| 7c | Render+console smoke: Calendar, Rate Plans, Channels, Banquet, Guests(+TEST guest), Events, Settings, Revenue Reports, Accounting Export, CRS, Room Types, Laundry, Tickets, Setup(render-only), Housekeeping desk | System Manager | ✅ PASS | All render with content, no non-socket.io errors. Setup not submitted. | — |

| 4f | **POS room-service order → guest folio routing (closes the lifecycle chain)** | Restaurant POS | ✅ **PASS** | Fired room-service (Date Cheesecake ٣٦) to room 102 TEST اختبار as pos@; settled "للغرفة" → `pos.deliver_order`→200. Charge landed on **FOLIO-2026-01997** as "The Terrace Restaurant: تشيز كيك بالتمر"; folio total → ر.س ١٥٦٫٤. Routed to the picked guest (TEST اختبار), NOT the co-occupant علاء → picker disambiguates by guest, so 2f doesn't misroute charges. **Full chain booking→checkin→POS→folio verified.** | — |
| 8 | QR menu (/menu/:outlet) public guest menu | (public) | ✅ PASS | `/menu/<outlet>` renders "مطعم التراس | The Terrace Restaurant" with bilingual items, descriptions & prices via `public_api.qr_menu`. | — |

<!-- append rows as journeys complete -->

| 9 | Automated auth-isolation Playwright suite (`e2e/auth-isolation.spec.ts`) | (5 personas) | ✅ PASS | **5/5 passed** (22s) against live site — sessions/routes/logout isolation intact. | — |

## Summary

**Scope covered:** public booking → front-desk check-in → finance folio + charge → POS (all 4 order
types, order creation, VAT) → kitchen (tickets + bump) → housekeeping mobile app, plus a render+console
smoke of ~20 admin/revenue/finance/ops screens, plus the automated auth-isolation suite. Every core
business journey was driven end-to-end against **real data** (created reservation RES-2026-01994 /
folio FOLIO-2026-01997 and drove it through the whole chain).

**Overall: the system works.** Every journey succeeded for its intended operator role, and the full
integration chain **booking → check-in → POS room-service → post-to-room → guest folio** is verified
end-to-end (charge landed on the correct guest's folio). All screens render in correct Arabic RTL with no
render crashes; the only recurring console error is an environmental socket.io 400 (Frappe realtime not
proxied on this demo host).

**Second functional bug (2f):** front desk could check a 2nd guest (TEST اختبار) into room 102 while
another guest (علاء) was still in-house there, with no conflict warning and a wrong room-status line in the
dialog. Charges still route per-guest correctly (folio test proved it), so it's "silent physical
double-booking," not a billing error — P1 for a real hotel, P2 on the demo. Frontend can add a
conflict guard/warning; a hard block belongs in `api.check_in` (backend).

**One real functional bug (P1) — the user's reported POS error, now root-caused:**
The POS-family doctypes (POS Order, POS Table Reservation, Menu Item, POS Outlet) have Custom DocPerms
that grant the operator roles (Restaurant POS, Kitchen) but **omit the admin tier** (System Manager,
Hotel Admin, Administrator). Result, verified live:
- `pos.create_order`: pos@ → **200** ✅ / admin@ → **403** ❌  (the reported "food order" error)
- `pos.accept_ticket` (kitchen bump): kitchen@ → **200** ✅ / admin@ → **403** ❌
- `GET Menu Item`, `GET POS Outlet` as admin@ → **403** (Menu Items & Outlets admin screens render empty)
So the actual restaurant/kitchen staff are unaffected, but any admin-tier account using POS / Kitchen /
Menu Items / Outlets is blocked. **Fix = backend: add the admin tier to those doctypes' DocPerms +
migrate/reload-doctype.** This is blocked for me here (backend + no-migrate) and awaits the user's
earlier option أ/ب decision.

**Frontend-fixable issues (I can fix these now):**
- P2: Front Desk excluded from `/billing` in `apps.ts` while the app's own copy + FD board direct
  reception to Billing (decide: grant FD billing access, or change the copy).
- P2: Check-in dialog text bug `"الغرفة 102 is assignedنظيفة"` (English "is assigned" + missing space) + dialog i18n leaks.
- P2/P3: i18n leaks — booking dialog ("Add experiences", deposit line, confirmation subtitle), FolioView
  ("طباعة folio", "الضيف folio", "…summary", category options, "Allow", "Record", "Security Deposit",
  "Payment Link", "Alcohol"), /hk "arrival اليوم".
- P2: POS shows no clear error when create_order 403s (looks like it silently did nothing).
- P3: Dashboard occupancy "0% · 6/14" display quirk (business-date vs today).

## Notes / details
