import frappe


def after_install():
	set_site_home_and_favicon()
	# NOTE: the governed agent user (agent@hotelpms.local) is deliberately NOT
	# created here. seed_rbac_v2.ensure_agent_user() writes custom DocPerms,
	# and in Frappe ANY custom perm on a doctype replaces ALL its standard
	# perms - seeding just the agent's grants at install silently revoked
	# every other role's access to Property on fresh sites. The full RBAC
	# seed (setup wizard / seed scripts) creates the agent user with the
	# complete permission set instead.


def set_site_home_and_favicon():
	"""Set HotelPMS as the default landing page on fresh sites.

	Existing customer home pages and favicons are never overwritten.
	"""
	ws = frappe.get_doc("Website Settings")
	changed = False
	if not ws.favicon:
		ws.favicon = "/assets/hotelpms/hotelpms-mark.svg"
		changed = True
	if (ws.home_page or "").strip() in ("", "login", "me", "index"):
		ws.home_page = "hotelpms"
		changed = True
	if changed:
		ws.flags.ignore_mandatory = True
		ws.save(ignore_permissions=True)


# Backwards compatibility for the existing v26 migration patch.
set_site_favicon = set_site_home_and_favicon


def sync_permissions():
	"""Keep the admin tier's Custom DocPerms in sync on every migrate.

	seed_users scopes several doctypes to operator roles (Housekeeping /
	Restaurant POS / Finance) via Custom DocPerm, which in Frappe REPLACES a
	doctype's standard (JSON) perms - silently locking System Manager + Hotel
	Admin out of those doctypes' /api/resource screens (Lost & Found, POS). The
	one-off repair scripts were never re-run after those doctypes were added, so
	the drift became permanent. Wiring the repair to after_migrate makes it
	automatic and idempotent. Belts first (full admin grant), then
	sync_standard_perms mirrors each doctype JSON's remaining roles without
	overwriting the belt.
	"""
	from hotelpms.scripts.fix_perms_fields import (
		ALL_DOCTYPES, _grant, fix_permissions, sync_standard_perms,
	)

	fix_permissions()  # System Manager belt + Front Desk/Finance folio-era grants

	# Hotel Admin belt - inlined (not seed_rbac_v2.ensure_hotel_admin, which
	# mutates the admin@ demo user and would DoesNotExist-crash migrate on a
	# fresh tenant).
	if not frappe.db.exists("Role", "Hotel Admin"):
		frappe.get_doc({
			"doctype": "Role", "role_name": "Hotel Admin", "desk_access": 1,
		}).insert(ignore_permissions=True)
	for doctype in ALL_DOCTYPES:
		_grant(doctype, "Hotel Admin", 1, 1, 1, delete=1)

	sync_standard_perms()  # mirror each doctype JSON's remaining declared roles
	frappe.clear_cache()


_BANQUET_ITEM_TYPES = [
	("Venue Rental", "تأجير قاعة", "Venue", "Events", 1, 0),
	("Menu", "قائمة الطعام", "F&B", "Kitchen / F&B", 1, 1),
	("Food & Beverage", "أطعمة ومشروبات", "F&B", "Kitchen / F&B", 1, 1),
	("Alcohol", "كحول", "Beverage", "Bar", 1, 1),
	("Audio Visual", "صوتيات ومرئيات", "AV", "AV", 1, 0),
	("Decor", "ديكور", "Decor", "Events", 1, 0),
	("Entertainment", "ترفيه", "Entertainment", "Events", 1, 0),
	("Furniture & Setup", "أثاث وتجهيز", "Setup", "Events", 1, 0),
	("Staffing", "طاقم عمل", "Services", "Operations", 1, 0),
	("Accommodation", "إقامة", "Rooms", "Front Desk", 1, 0),
	("Stationery", "قرطاسية", "Supplies", "Events", 1, 0),
	("Other", "أخرى", "Other", None, 1, 0),
]


def seed_banquet_item_types():
	"""Seed the supplementary-order types ONCE, only when the table is empty.
	After that the master is admin-owned: disabling or deleting a type must
	stick, so this never re-inserts on a later migrate."""
	if not frappe.db.exists("DocType", "Banquet Item Type"):
		return
	if frappe.db.count("Banquet Item Type"):
		return
	for name, label_ar, category, dept, has_price, affects in _BANQUET_ITEM_TYPES:
		frappe.get_doc({
			"doctype": "Banquet Item Type", "type_name": name,
			"label_ar": label_ar, "category": category, "department": dept,
			"has_price": has_price, "affects_inventory": affects,
		}).insert(ignore_permissions=True)
