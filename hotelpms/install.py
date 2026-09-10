import frappe


def after_install():
	set_site_favicon()
	# NOTE: the governed agent user (agent@hotelpms.local) is deliberately NOT
	# created here. seed_rbac_v2.ensure_agent_user() writes custom DocPerms,
	# and in Frappe ANY custom perm on a doctype replaces ALL its standard
	# perms - seeding just the agent's grants at install silently revoked
	# every other role's access to Property on fresh sites. The full RBAC
	# seed (setup wizard / seed scripts) creates the agent user with the
	# complete permission set instead.


def set_site_favicon():
	"""A fresh site shows Frappe's favicon on /login and the Desk until
	Website Settings carries ours. Never overrides a hotelier's custom one."""
	ws = frappe.get_doc("Website Settings")
	if not ws.favicon:
		ws.favicon = "/assets/hotelpms/hotelpms-mark.svg"
		ws.flags.ignore_mandatory = True
		ws.save(ignore_permissions=True)


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
