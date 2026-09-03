"""Seed commercial demo data: meal plans, corporate accounts, travel agents
and discount vouchers. These were missing from the sample hotel, so the
Revenue tab screens (and the booking meal-plan / voucher flows) had nothing
to work with. Idempotent — every record is existence-checked, so it is safe to
run repeatedly and after a demo reset.

Run:  bench --site <site> execute hotelpms.scripts.seed_commercial.execute
"""

import frappe

# Property-scoped meal plans (code is the Select EP/CP/MAP/AP).
MEAL_PLANS = [
    ("EP", "بدون وجبات | Room Only", 0, 0),
    ("CP", "إفطار | Bed & Breakfast", 60, 30),
    ("MAP", "نصف إقامة | Half Board", 140, 70),
    ("AP", "إقامة كاملة | Full Board", 210, 105),
]

# Global corporate accounts (not property-scoped).
COMPANIES = [
    ("شركة أرامكو السعودية | Saudi Aramco", "300000000000003", "أحمد الغامدي | Ahmed Al-Ghamdi", "+966500000001"),
    ("الخطوط السعودية | Saudia Airlines", "300000000000011", "منى القحطاني | Mona Al-Qahtani", "+966500000002"),
    ("مجموعة صافولا | Savola Group", "300000000000029", "خالد العتيبي | Khalid Al-Otaibi", "+966500000003"),
    ("اس تي سي | stc", "300000000000037", "سارة الدوسري | Sara Al-Dosari", "+966500000004"),
]

# Global travel agents / OTAs.
AGENTS = [
    ("المسافر | Almosafer", "OTA", 12),
    ("طيران ناس للعطلات | Flynas Holidays", "Tour Operator", 10),
    ("بوكينج دوت كوم | Booking.com", "OTA", 15),
]

# Property-scoped vouchers. Validity spans the demo's booking window so
# check_voucher() accepts them on /book.
VOUCHERS = [
    ("WELCOME10", "Percent", 10, "2026-01-01", "2026-12-31", 0, 500),
    ("SUMMER25", "Percent", 25, "2026-06-01", "2026-11-30", 0, 200),
    ("STAY3PAY2", "Amount", 500, "2026-01-01", "2026-12-31", 3, 100),
    ("VIPGUEST", "Percent", 15, "2026-01-01", "2027-06-30", 0, 300),
]


def _default_property() -> str | None:
    prop = frappe.db.get_value(
        "Property", {"property_name": ["like", "%Nuzul Riyadh Hotel%"]}, "name"
    )
    if prop:
        return prop
    rows = frappe.get_all("Property", limit=1)
    return rows[0].name if rows else None


def execute(property: str | None = None):
    prop = property or _default_property()
    if not prop:
        print("seed_commercial: no property found, skipping")
        return

    made = {"Meal Plan": 0, "Company": 0, "Travel Agent": 0, "Discount Voucher": 0}

    for code, label, adult, child in MEAL_PLANS:
        name = f"{prop}-{code}"
        if frappe.db.exists("Meal Plan", name):
            continue
        frappe.get_doc({
            "doctype": "Meal Plan", "property": prop, "code": code,
            "label": label, "price_per_adult": adult, "price_per_child": child,
        }).insert(ignore_permissions=True)
        made["Meal Plan"] += 1

    for cname, gstin, contact, phone in COMPANIES:
        if frappe.db.exists("Company", cname):
            continue
        frappe.get_doc({
            "doctype": "Company", "company_name": cname, "gstin": gstin,
            "contact_name": contact, "contact_phone": phone, "credit_allowed": 1,
        }).insert(ignore_permissions=True)
        made["Company"] += 1

    for aname, atype, comm in AGENTS:
        if frappe.db.exists("Travel Agent", aname):
            continue
        frappe.get_doc({
            "doctype": "Travel Agent", "agent_name": aname,
            "agent_type": atype, "commission_pct": comm,
        }).insert(ignore_permissions=True)
        made["Travel Agent"] += 1

    for code, dtype, value, vfrom, vto, min_nights, max_uses in VOUCHERS:
        name = f"{prop}-{code}"
        if frappe.db.exists("Discount Voucher", name):
            continue
        frappe.get_doc({
            "doctype": "Discount Voucher", "property": prop, "voucher_code": code,
            "discount_type": dtype, "value": value, "valid_from": vfrom,
            "valid_to": vto, "min_nights": min_nights, "max_uses": max_uses,
        }).insert(ignore_permissions=True)
        made["Discount Voucher"] += 1

    frappe.db.commit()
    print("seed_commercial done for", prop, "->", made)
