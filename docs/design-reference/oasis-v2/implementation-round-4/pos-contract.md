# POS Redesign — Implementation Contract (Oasis v2, Round 4)

Target file: `frontend/src/screens/POS.tsx` (+ `frontend/src/index.css` for `pos-*` classes).
Reference look: `docs/design-reference/oasis-v2/redesign-screens/v2-05-pos-touch-1440.html`.
Tokens: `docs/design-reference/oasis-v2/design-system.md`.

This is a **restyle + relayout of existing behavior**. No backend method changes. No new
capabilities except surfacing two already-supported-but-hidden fields (allergy note, order
notes) — and even those are optional (see §4). Arabic-first, RTL default; every visible string
via `__()`; logical properties only.

### Token map (design-system → Tailwind, confirmed in `index.css`)
| design-system | Tailwind | hex |
|---|---|---|
| `teal-900` | `brand-900` (alias `navy-900`) | `#073B34` — POS top bar, «للمطبخ» dark surface |
| `teal-800` | `brand-800` | `#0A4F46` — command sub-bar, active segment/chip, «للمطبخ» btn |
| `teal-700` | `brand-700` | `#0B655A` — hover, qty badge, stepper glyphs |
| `teal-600` | `brand-600` | `#0E7A6C` — **primary**: selection ring, focus, links |
| `teal-500` | `brand-500` | `#1E9382` |
| `teal-200/100/50` | `brand-200/100/50` | light teal fills/borders |
| `amber-500` | `gold-500` | `#E8963E` — «الدفع», current table, «now», attention |
| `amber-700/600/100/50` | `gold-700/600/100/50` | amber text / borders / soft fills / «not-sent» tint |
| `ink/sub/faint` | `zinc-900 / zinc-500 / zinc-400` | text scale |
| `line/line-strong` | `zinc-200 / zinc-300` | borders |
| `canvas/ivory/inset/card` | `zinc-50 / white / zinc-100 / white` | surfaces |
| radii `r-md/r-lg/r-xl` | `rounded-xl(12) / rounded-2xl(16) / rounded-[22px]` | buttons·fields / cards / panels·modals |
| shadows `sm/md/lg` | existing `--sh-*` vars | as design-system §3 |

Rule of accents (design-system §1.1): **teal = do/navigate, gold = attention/money-due/current**.
Never two lead-color buttons in one card. Gold button text is `#3A2405`.

### Container strategy (decide once — no AppShell edit)
POS is a `floor` screen and calls `useFloorFullscreen()` → `useKiosk(true)`, which sets
`data-kiosk` on mount. AppShell's `<main>` is then `h-[100dvh] overflow-hidden p-0` (chrome
hidden). So the reference `height:100vh; overflow:hidden` grid works **as-is inside the kiosk
main** with no shell change.
- POS root: `h-full min-h-0 overflow-hidden` → the 3-pane grid is `grid h-full min-h-0`.
- Each pane: `min-h-0 overflow-y-auto`; the grid itself never scrolls (matches mockup `body{overflow:hidden}`).
- Fallback when Escape restores chrome (kiosk off): root becomes `min-h-[calc(100dvh-3.5rem)] overflow-auto`
  and the grid rows relax from `1fr` to `auto` so it degrades to a normal scroll page. Keep the
  existing `floorOn` branch as the switch.

---

## 1) Feature / state / interaction / API inventory

Legend — **Keep?**: yes = ship in redesign · yes* = keep behavior, restyle/relocate ·
gap = backend supports it, UI does not expose it today.

### Order-type behaviors
| Capability | Current trigger / UI | Backend method + args | Keep? / Enablement |
|---|---|---|---|
| Dine In | Tap table tile / table `<select>`; guests input | `create_order(order_type="Dine In", table_no, guests, …)` | yes* — fire/pay needs `table` non-empty |
| Room Service | Room `<select>` from in-house list | `create_order(order_type="Room Service", room)`; server resolves `reservation` from Checked-In stay | yes* — needs `room` chosen |
| Takeaway | Right-panel name/phone (optional) | `create_order(order_type="Takeaway", customer_name?, customer_phone?)` | yes* — always context-ready (no required field) |
| Delivery | Right-panel name+phone+address | `create_order(order_type="Delivery", customer_name, customer_phone, delivery_address)` | yes* — **all three** required client-side (`newOrderContextReady`) |
| Switch order type | `pos-order-modes` radiogroup (left pane) → `chooseOrderType` | none | yes* — **relocates to top segment** (§2). Switching abandons selected bill → `newOrder()`, clears non-matching fields (channel is immutable per bill) |
| Derived display type | `displayedOrderType` = selected bill's type else `orderType` | none | yes — top segment reflects it; selecting a chip auto-switches segment to that bill's mode |

### Tables & seating (Dine In)
| Capability | Current trigger / UI | Backend method + args | Keep? / Enablement |
|---|---|---|---|
| Table tile states | `TILE` map: vacant·running·fired·ready·reserved·cleaning | `table_map(outlet)` (poll+realtime) | yes* — re-skin to mockup `tbtn` (`.busy`/`.cur`/`.hold`) + status color+icon (not color alone, WCAG) |
| Tap vacant | `newOrder(table)` | none | yes |
| Tap 1-bill | `openTab(order)` | `order_detail(order)` | yes |
| Tap multi-bill | `setChooser(table)` → bill list popover | `open_orders` data | yes* — chooser popover (§4) |
| Tap cleaning | `cleanTable` → then start bill | `mark_table_clean(outlet, table_no)` | yes |
| Tap reserved | `setResTile` → seat/no-show/cancel panel | see reservations | yes* |
| Table search / All·Available·Occupied / area filter | `tableQuery`, `tableFilter`, `areaFilter`, zone groups | client filter of `table_map` | yes* — search + chips above grid; zone headings = mockup `zoneh` |
| Temp / custom table | «Temp table» → `customTable` free-text | `create_order(table_no=<free text>)` | yes* — dashed «+ طاولة مؤقتة» under grid → inline field/small modal |
| Guest count | `guests` input (Dine In); prefilled from `res_party` on seat | `create_order(guests=…)` | yes* — lives in left pane on table-select; echoed in cart header |
| Available/open/kitchen counts | Top KPI cluster (3 tiles) | derived | yes* — becomes left-pane footer summary (mockup) |

### Reservations (holds)
| Capability | Current trigger / UI | Backend method + args | Keep? / Enablement |
|---|---|---|---|
| Create reservation | «+ Reserve» → inline form (table·time·guest·phone·party) | `reserve_table(outlet, table_no, guest_name, phone, party_size, reserved_at)` | yes* → modal (§4); needs table+guest+time |
| Seat reservation | «Seat now» | `set_reservation(reservation, status="Seated")` → `newOrder(table)` + prefill guests | yes* |
| No-show / cancel reservation | buttons in reserved panel | `set_reservation(reservation, status="No Show"|"Cancelled")` | yes* |

### Order building & KOT
| Capability | Current trigger / UI | Backend method + args | Keep? / Enablement |
|---|---|---|---|
| Add item | Tap `MenuCard` → `addToCart` | client cart | yes* — mockup `item` card, qty badge |
| Qty ± / remove / clear | steppers, trash, «Clear all» | client cart | yes* — stepper ≥44px touch |
| Per-line instructions | text field per cart line | `items[].instructions` in `create_order`/`add_items` | yes |
| Menu search / category | `query` (debounce ≥300ms), `cat` chips + «All» | `pos_menu(outlet)` | yes* — mockup `cat` chips + search chip |
| Send to kitchen / F6 | `kotAction`: new → `createBill(true)`; existing → `add_items`+`fire_kot` | `add_items(order,items)`, `fire_kot(order)`, `create_order`+`confirm_order` | yes — needs `cart>0`; new bill also needs context-ready |
| Hold / F5 | `hold` → `createBill(false)` | `create_order`+`confirm_order` | yes — **new bill only**, `cart>0` + context-ready |
| Create bill core | `createBill` | `create_order` → `apply_discount?` → `confirm_order` → `fire_kot?` | yes (internal) |
| KOT print / reprint | `maybePrintKot`, `reprintKot` | client `printThermal`/`kotHtml`; no server call | yes* |
| KOT printer on/off | top toggle, `localStorage pos_print_kot` | none | yes* — top bar |
| «Saved KOT» toast | `printNote` emerald banner | none | yes* — success toast (design-system) |

### Bill actions
| Capability | Current trigger / UI | Backend method + args | Keep? / Enablement |
|---|---|---|---|
| Open / cycle bills | RunningStrip tiles, F3 `traverse`, left open-bills lists | `order_detail(order)` | yes* — **top-bar bill chips** replace strip + lists |
| Discount | inline field | `apply_discount(order, amount, reason)`; new bills apply at create; cap = min(subtotal) on new | yes* → popover/modal; existing bill only for server call |
| Split | `splitMode` line checkboxes + confirm | `split_order(order, item_rows)` → open new bill | yes* — needs selected + ≥2 unvoided lines + status≠Delivered + `splitSel < unvoided count` |
| Void line | hover ✕ on posted line + reason | `void_item(order, item_row, reason)` | yes* — needs selected, line not voided, status≠Delivered, reason required |
| Complimentary / NC | «Complimentary» → by+note; undo | `mark_nc(order, authorized_by, note, undo)` | yes* — needs selected + status≠Delivered; shows COMPLIMENTARY banner |
| Cancel order | «More» → reason required | `cancel_order(order, reason)` | yes* — selected only |
| Proceed to pay / F4 | `proceedToPay`: cash bills → settle modal; **room/NC bills → `deliver_order` (no mode)** | `deliver_order(order)` OR settle | yes — separate branch, button relabels «تسليم وترحيل للغرفة» / «إغلاق فاتورة مجانية» |
| Settle / pay | mode buttons Cash·Card·Mada·Digital Wallet | `pay_order(order, mode)` → `bill_data` → print bill | yes* → pay **modal** (§4) |
| Print guest bill (مبدئية / proforma) | «More» → print | `bill_data(order)` → `billHtml` → `printThermal` | yes* — mini-row «مبدئية» |
| Totals math | subtotal / VAT / grand; VAT vs CGST+SGST via `taxLabel()`; `gst_rate` from outlet | client | yes* — mockup `totals` block |

### Ambient / infra
| Capability | Current trigger / UI | Backend method + args | Keep? |
|---|---|---|---|
| Outlet switch | top `<select>` → `newOrder()` | `outlets(property)`, reloads menu/tables | yes* — top bar |
| Live refresh | `subscribeRealtime` + 20s `setInterval` | `open_orders`, `table_map`, `recent_orders` | yes |
| Recent orders | left «Recent» list (mode-filtered) | `recent_orders(outlet)` | yes* → **history sheet** from top bar (§4) |
| Fullscreen toggle | `useFloorFullscreen` browser FS | none | yes* — top bar icon |
| F-keys | F2/F3/F4/F5/F6 | none | yes — see §2 final key map |

### The 5 required states
| State | Current | Keep? |
|---|---|---|
| Loading | `!outletsLoaded` spinner | yes* → **skeleton** panes (design-system) |
| Empty | `outlets.length===0` → `OnboardingEmptyState` (create outlet + add menu) | yes |
| Error | rose banner from `serverError` | yes* → design-system danger toast/callout |
| Denied | `OnboardingEmptyState` `gatedNote` (no create perm) | yes |
| Populated | full 3-pane | yes |

### Backend-supported, UI does NOT send today (gaps to record — see §4)
| Field | `create_order` param | Status |
|---|---|---|
| Allergy note | `allergy_note` | accepted; UI never sends |
| Order-level notes | `notes` | accepted; UI never sends (only per-line `instructions`) |
| `source` | `source="Manual"` default | UI never sets |
| `reservation` (explicit) | `reservation` | UI never sends — server resolves from `room` |
| `in_house_rooms.guest_name` | returned by API | UI discards it (type only reads `room`/`room_number`) |

Not POS methods (KDS/Kitchen screen — do not wire into POS): `mark_prepared`,
`accept_ticket`, `recall_prepared`, `acknowledge_void`.

---

## 2) Layout mapping — every item → a region

### Grid (commit exactly)
```
.pos { display:grid;
  grid-template-columns: 296px 1fr 376px;   /* mockup */
  grid-template-rows: 56px 44px 1fr 52px;   /* row1 identity · row2 command · panes · footer */
  height:100%; min-height:0; overflow:hidden; background: canvas(zinc-50); }
```
The two header rows (100px total) are the **TOP region**; the identity bar is `brand-900`, the
command bar is `brand-800` (reads as one teal cluster like the mockup's single teal bar).

### TOP region
**Row 1 — identity bar (`brand-900`, spans 1/-1):**
- inline-start: outlet icon tile (`gold-500` on `brand-950`) + «نقطة البيع — <outlet>»; outlet `<select>` beneath (subtle, on-teal).
- center-ish: **printer status** — `okdot` + «طابعة المطبخ · متصلة» (mockup) **and** the KOT print on/off toggle (`gold` when on).
- inline-end: fullscreen icon btn · «فاتورة جديدة F2» (`gold` button) · user chip · clock.

**Row 2 — command bar (`brand-800`, spans 1/-1): the directive override lives here.**
- inline-start: **persistent order-type segmented control** (`seg`, 4 pills: الصالة/الغرف/سفري/توصيل =
  Dine In / Room Service / Takeaway / Delivery). Active pill = `brand-600` (or gold for «current»)
  on teal; `role="radiogroup"`, `aria-checked`. **Always visible in every mode**, drives the left pane.
- fill: **bill chips** (`oc`), horizontally scrollable (`overflow-x-auto`), one per open bill.
  Chips replace the old `RunningStrip` **and** the left-pane open-bills lists. Chip visual = the three
  states: not-fired → `gold-500`/outline gold («لم يُرسل»); in-kitchen → neutral teal chip; ready-unpaid →
  `brand-100`/teal text. The **current** bill chip = solid `gold-500` (mockup). Tap chip → `openTab` +
  auto-switch segment to that bill's `order_type`. Overflow (15+ bills): chips scroll; a trailing
  «الكل ▸» chip opens the history/all-bills sheet.

### LEFT pane (`296px`, `pane.tables`, `border-inline-end`) — **content swaps by mode (directive)**
| Segment | Left-pane content |
|---|---|
| **Dine In** | Search + [All·Available·Occupied] chips + area chips → **zone table grid** (`zoneh` headings + `tgrid`, `tbtn` tiles). Below grid: «+ طاولة مؤقتة» (temp), reserved-tile action popover, multi-bill chooser popover, «+ Reserve» opens modal. On table-select: guests stepper appears. Sticky footer = open-bills count+total, in-kitchen count. |
| **Room Service** | **In-house room+guest search**: search input filters `in_house_rooms` by room number **or** `guest_name` (API returns it — widen the TS type to read it); list of Checked-In rooms as tappable rows «غرفة 201 · <guest_name>». Selecting a row sets `room` (= stay verification, no extra call). Optional guests. Footer: open Room-Service bills count. |
| **Takeaway** | **No table UI.** Optional compact customer name/phone (small fields, not required). List of open Takeaway tickets. Empty hint «جاهز للاستلام من الكاونتر». |
| **Delivery** | **name / phone / address form** (all three required to fire/pay). List of open Delivery tickets. |

### MIDDLE pane (`1fr`, transparent) — mode-independent
- `cats`: «All» + category chips (`cat`) + trailing search chip. Category tap resets query.
- `items`: 4-col grid (`repeat(4,1fr)`), `MenuCard` = pastel image bg + qty badge (`brand-700`) +
  name + price (`brand-800`). `is_veg` leaf marker kept. Search/empty → «لا توجد نتائج».

### RIGHT pane (`376px`, `pane.cart`, `border-inline-start`) — pure cart (context moved to left)
- `cart-h`: resolved label from `orderLabel` (طاولة T4 — الصالة) · bill # · guests · captain · status badge.
- `lines`: posted lines (stepper + amount) + **new/unsent lines with `gold-50` bg** («جديد — لم يُرسل»);
  split-mode checkboxes; void ✕ on hover; NC «COMPLIMENTARY» banner; new-round heading.
- `totals`: subtotal · VAT(rate)% [or CGST+SGST] · grand (`gt`). Discount row/line inline.
- `cart-acts`: two 56px buttons — **«للمطبخ» `brand-800` (F6)** + **«الدفع» `gold-500` (F4)** —
  then **mini-row (mockup fidelity): تعليق(Hold) · تقسيم(Split) · خصم(Discount) · مبدئية(print bill) · «⋯»**.
  The «⋯» overflow holds: Complimentary/NC · Reprint KOT · Cancel order. (§4 details each.)

### FOOTER (`52px`, `fnbar`, spans 1/-1)
Key legend + «فاتورة ZATCA برمز QR عند الدفع». **Final key map (keep current bindings; relabel the
mockup's aspirational F3=بحث/F8=طاولات):**
`F2 فاتورة جديدة · F3 تنقّل بين الفواتير · F4 الدفع · F5 تعليق · F6 إرسال للمطبخ`.

### Nothing unmapped — explicit homes
Multi-bill chooser → left popover · reservations → modal + tile popover · temp table → inline/modal ·
NC·reprint·cancel → cart «⋯» menu · print bill → mini «مبدئية» · pay → modal · discount/split → popover/inline ·
recent → top history sheet · KPIs → left footer · printer status/KOT toggle/outlet/fullscreen/new-bill → top bar ·
allergy+notes → optional field under «⋯» or out-of-scope (§4).

---

## 3) Responsive plan (1440 / 1024 / 390)

Touch targets **≥48px** in POS (design-system §6, principle 5). Bump sub-48 mockup controls:
category chip 42→48, stepper button 37→**48**, mini-row button 42→48. No horizontal page overflow at any width.

**1440+ (default):** columns `296px 1fr 376px`; items grid 4-col; footer visible.

**1024 (tablet):**
- columns tighten to `232px 1fr 320px`; rows unchanged.
- items grid → 3-col; bill chips scroll; category chips scroll.
- footer F-key legend hides (`hidden lg:flex` inverse — touch device, keys less relevant); ZATCA note
  moves into pay modal.
- panes still scroll internally; no page scroll.

**390 (mobile):** 3 panes cannot coexist. Single column, sticky chrome + tabs + bottom bar:
- **Sticky top:** order-type segment (4 pills, `overflow-x-auto`, ≥48px) + a compact running-total pill.
- **Tab bar** `[ السياق | القائمة | السلة (n) ]` — «السياق» = the current mode's left-pane content
  (tables / room search / takeaway / delivery form); «القائمة» = menu; «السلة» = cart lines+totals.
- **Persistent bottom action bar** (safe-area inset): running total + primary action —
  **«للمطبخ»** when cart has unsent lines, **«الدفع»** otherwise; tapping «الدفع» opens the pay sheet.
- Bill chips = a scrollable chips row **directly under the segment** (so bills stay switchable while
  the menu tab is open — do not bury them inside the cart tab). Modals become full-width bottom sheets
  (`rounded-t-[22px]`). Grid rows relax to `auto`; body scrolls per-tab only.

---

## 4) Mockup gaps + decisions

Features the static mockup does **not** depict, with the concrete decision:

| Feature | Decision |
|---|---|
| **Multi-bill chooser** (table with >1 bill) | Keep. Anchored **popover** over the tapped `tbtn` listing each bill (label + total, state-colored) + «+ فاتورة جديدة». Restyle to card tokens. |
| **Reservation create form** | Move to **modal** (`rounded-[22px]`, ivory header) opened from left-pane «+ حجز». Fields: table·datetime·guest·phone·party. |
| **Reserved-tile actions** (seat/no-show/cancel) | Keep as a small **popover** anchored to the reserved `tbtn` (violet/reserved styling per DS room-state palette). |
| **Custom / temp table** | Keep. Dashed «+ طاولة مؤقتة» under the grid → inline free-text field (or tiny modal on 390). |
| **Room-service verify** | No new UI — selecting a Checked-In room from `in_house_rooms` **is** verification. Surface `guest_name` in the row (already returned). |
| **Complimentary / NC** | Move into cart **«⋯» overflow menu** → opens by+note form (popover). COMPLIMENTARY banner stays in cart body. |
| **Cancel order** | In **«⋯»** menu → reason-required confirm (danger). |
| **Printer status** | Keep as top-bar indicator (`okdot` + «متصلة») — **presentational only** (no live health API today). KOT on/off toggle beside it. |
| **Settle / pay** | Restyle into a **modal / bottom sheet**: total, mode buttons Cash·Card·Mada·Digital Wallet, ZATCA QR note. Room/NC bills **skip the modal** (`deliver_order`, relabeled button). |
| **Discount** | **Popover** from mini-row «خصم»: amount + reason; new bills apply at create, existing via `apply_discount`. |
| **Split** | Keep inline: «تقسيم» enters split-mode (line checkboxes) + confirm bar (`Move n to new bill`). Restyle only. |
| **Void line** | Keep inline ✕-on-line + reason popover. Restyle. |
| **Print guest bill (proforma)** | Mini-row **«مبدئية»** → `bill_data` → thermal print. |
| **Recent / history** | Move to a right-side **history sheet** opened from a top-bar «سجل اليوم» / the trailing «الكل ▸» chip; mode-filterable. |
| **The 5 states** | Loading→skeleton panes; Empty→`OnboardingEmptyState`; Error→DS danger toast/callout; Denied→gated `OnboardingEmptyState`; Populated→3-pane. |
| **Allergy note + order notes** | **Optional field** under cart «⋯» («ملاحظة/تحسّس») that fills `create_order(notes, allergy_note)` — both already accepted server-side. If descoped for round 4, log as "surface existing `notes`/`allergy_note` fields" rather than leaving them silently unsent. |

### Backend gaps to log (do NOT invent inputs)
- **Delivery driver** — no field on POS Order. Do not add a driver input; it would be silently dropped. Log: "add `delivery_driver` to POS Order + `create_order`".
- **Delivery time** — no field on POS Order. Same treatment. Log: "add `delivery_time`/promised-at".
- **Printer health** — status indicator is presentational; no live printer-status API. Log if real status is wanted.
- **`allergy_note` / `notes`** — accepted by `create_order` but never sent by the current UI (see §1). Surfacing them is a UI-only change, not a backend gap.

---

## Build order (suggested)
1. Grid shell + container/kiosk wiring (§container, §2 grid).
2. Top region: identity bar, persistent order-type segment, bill chips (replace RunningStrip + left open-bills lists).
3. Left pane mode-swap (Dine In grid / Room search / Takeaway / Delivery form).
4. Middle menu cards + category/search.
5. Right cart (lines/totals/56px actions/mini-row + «⋯»).
6. Modals/sheets: pay, reserve, discount, history; inline: split, void, NC, temp table.
7. Responsive 1024 + 390; skeleton/error/empty/denied states; touch-target bumps; RTL + `__()` audit.
