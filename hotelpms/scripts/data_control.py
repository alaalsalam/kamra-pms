"""Inventory and safely purge HotelPMS business data on a demo playground.

This module deliberately has no whitelisted HTTP method. Destructive actions
must be run by an operator from ``bench execute`` and require an exact phrase.
It never runs on a tenant that fails ``reset_demo.is_playground``.
"""

from __future__ import annotations

import frappe

CONFIRMATION = "PURGE HOTELPMS DEMO DATA"

# Business setup entered before day-to-day operation starts.
MASTER_DOCTYPES = {
	"Property", "Room Type", "Room", "Sellable Unit", "Rate Plan",
	"Meal Plan", "Season", "Hurdle Rate", "Rate Guardrail",
	"Discount Voucher", "Travel Agent", "Company", "Experience",
	"POS Outlet", "Menu Item", "Ingredient", "Ingredient Stock",
	"Laundry Rate", "Venue", "Banquet Menu", "Banquet Dish",
	"Banquet Service Item", "Revenue Budget", "Turnover Profile",
}

# Records created while the hotel is operating.
TRANSACTION_DOCTYPES = {
	"Reservation", "Guest", "Folio", "Cancelled Invoice",
	"Housekeeping Task", "Room Block", "Service Ticket", "Shift Handover",
	"POS Order", "POS Table Reservation", "Stock Ledger Entry",
	"Laundry Order", "Lost And Found Item", "Night Audit Run",
	"Security Deposit", "Group Booking", "Venue Booking", "Hosting Enquiry",
	"WhatsApp Message", "Agent Action Log", "Copilot Conversation",
}

# Technical configuration and credentials. Counted separately so an operator
# understands that a full purge also removes demo integrations and secrets.
CONFIG_DOCTYPES = {
	"AI Assistant Settings", "Cashier PIN", "Channel Manager Connection",
	"Channel Provider Connection", "Channel Room Mapping",
	"Payment Gateway Settings", "MCP OAuth Client", "MCP OAuth Grant",
}


def _category(name: str, is_child: bool) -> str:
	if is_child:
		return "child_rows"
	if name in MASTER_DOCTYPES:
		return "master"
	if name in TRANSACTION_DOCTYPES:
		return "transactions"
	if name in CONFIG_DOCTYPES:
		return "configuration"
	return "other"


def inventory() -> dict:
	"""Return exact live counts for every HotelPMS DocType, grouped by kind."""
	groups: dict[str, list[dict]] = {
		"master": [], "transactions": [], "configuration": [],
		"child_rows": [], "other": [],
	}
	rows = frappe.get_all(
		"DocType",
		filters={"module": "HotelPMS"},
		fields=["name", "istable", "issingle"],
		order_by="name asc",
	)
	for row in rows:
		if row.issingle:
			count = frappe.db.sql(
				"select count(*) from `tabSingles` where doctype=%s", row.name
			)[0][0]
		elif frappe.db.table_exists(row.name):
			count = frappe.db.count(row.name)
		else:
			count = 0
		groups[_category(row.name, bool(row.istable))].append({
			"doctype": row.name,
			"count": int(count or 0),
		})

	totals = {
		key: sum(item["count"] for item in items)
		for key, items in groups.items()
	}
	return {
		"site": frappe.local.site,
		"demo_mode": frappe.db.get_default("hotelpms_demo_mode") == "1",
		"automatic_nightly_reset": frappe.db.get_default(
			"hotelpms_demo_autoreset"
		) != "0",
		"totals": totals,
		"grand_total": sum(totals.values()),
		"groups": groups,
	}


def purge(confirm: str | None = None) -> dict:
	"""Leave a blank HotelPMS demo while preserving schema and demo users.

	A filesystem/database backup must be taken by the caller before invoking
	this function. The explicit phrase and playground guard make accidental use
	on a real hotel impossible through the documented workflow.
	"""
	from hotelpms.scripts import reset_demo

	if confirm != CONFIRMATION:
		frappe.throw(
			f"Confirmation mismatch. Pass exactly: {CONFIRMATION}"
		)
	if not reset_demo.is_playground():
		frappe.throw("Refusing to purge: this site is not a HotelPMS demo playground.")

	before = inventory()
	frappe.flags.ignore_permissions = True
	frappe.flags.in_import = True
	removed_hotelpms = reset_demo._wipe_hotelpms_doctypes()
	removed_core = reset_demo._wipe_core()

	# Keep the advertised test accounts, but stop the 04:15 job from silently
	# recreating sample properties while the owner performs a clean-entry test.
	frappe.db.set_default("hotelpms_demo_mode", "1")
	frappe.db.set_default("hotelpms_demo_autoreset", "0")
	frappe.db.commit()  # nosemgrep: frappe-manual-commit -- operator-requested demo purge
	frappe.clear_cache()

	after = inventory()
	result = {
		"ok": True,
		"site": frappe.local.site,
		"removed_hotelpms_rows": removed_hotelpms,
		"removed_core_rows": removed_core,
		"before": before["totals"],
		"after": after["totals"],
		"demo_users_preserved": True,
		"automatic_nightly_reset": False,
	}
	print(result)
	return result
