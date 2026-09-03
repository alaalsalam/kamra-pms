"""Seed demo roles and users for every module.

Run via bench console:
    from hotelpms.scripts.seed_users import execute; execute()

Idempotent. Creates roles with scoped permissions and one demo user each:
  - Front Desk       → operational doctypes (bookings, rooms, housekeeping)
  - Revenue Manager  → pricing doctypes (rate plans, seasons, vouchers)
  - Finance          → read money-bearing doctypes (invoicing comes with folios)
"""

import frappe

ALL_HOTELPMS_DOCTYPES = [
	"Property", "Room Type", "Room", "Rate Plan", "Guest", "Reservation",
	"Housekeeping Task", "Agent Action Log", "Meal Plan", "Season",
	"Discount Voucher", "Company", "Group Booking",
]

# role -> {doctype: (read, write, create)}
ROLE_GRANTS = {
	"Front Desk": {
		"Property": (1, 0, 0),
		"Room Type": (1, 0, 0),
		"Room": (1, 1, 1),
		"Rate Plan": (1, 0, 0),
		"Meal Plan": (1, 0, 0),
		"Season": (1, 0, 0),
		"Discount Voucher": (1, 0, 0),
		"Guest": (1, 1, 1),
		"Reservation": (1, 1, 1),
		"Housekeeping Task": (1, 1, 1),
		"Group Booking": (1, 1, 1),
		"Company": (1, 0, 0),
		"Agent Action Log": (1, 0, 1),
	},
	"Revenue Manager": {
		"Property": (1, 0, 0),
		"Room Type": (1, 1, 1),
		"Rate Plan": (1, 1, 1),
		"Meal Plan": (1, 1, 1),
		"Season": (1, 1, 1),
		"Discount Voucher": (1, 1, 1),
		"Reservation": (1, 0, 0),
		"Company": (1, 1, 1),
		"Agent Action Log": (1, 0, 0),
	},
	"Housekeeping": {
		"Property": (1, 0, 0),
		"Room": (1, 1, 0),
		"Room Type": (1, 0, 0),
		"Housekeeping Task": (1, 1, 1),
		"Reservation": (1, 0, 0),
		"Service Ticket": (1, 1, 1),
		"Lost And Found Item": (1, 1, 1),
	},
	"Finance": {
		"Property": (1, 0, 0),
		"Reservation": (1, 0, 0),
		"Guest": (1, 0, 0),
		"Folio": (1, 1, 1),
		"Folio Charge": (1, 1, 1),
		"Folio Payment": (1, 1, 1),
		"Night Audit Run": (1, 1, 1),
		"Cancelled Invoice": (1, 0, 0),
		"Company": (1, 1, 1),
		"Discount Voucher": (1, 0, 0),
		"Agent Action Log": (1, 0, 0),
	},
	"Restaurant POS": {
		"Property": (1, 0, 0),
		"Room": (1, 0, 0),
		"Reservation": (1, 0, 0),
		"POS Outlet": (1, 0, 0),
		"Menu Item": (1, 0, 0),
		"POS Order": (1, 1, 1),
		"POS Table Reservation": (1, 1, 1),
	},
	"Kitchen": {
		"Property": (1, 0, 0),
		"POS Outlet": (1, 0, 0),
		"Menu Item": (1, 0, 0),
		"POS Order": (1, 1, 0),
	},
}

USERS = [
	{"email": "admin@hotelpms.local", "first_name": "مدير", "last_name": "النظام",
	 "password": "HotelPMSAdmin1!", "roles": ["System Manager"]},
	# The GM / Hotel Admin — business super-user (ops + finance + revenue +
	# high-level settings) but NOT an IT admin: no users, developers or Desk.
	{"email": "gm@hotelpms.local", "first_name": "سارة", "last_name": "الشهري",
	 "password": "HotelPMSGM1!", "roles": ["Hotel Admin"]},
	{"email": "frontdesk@hotelpms.local", "first_name": "خالد",
	 "last_name": "العتيبي", "password": "HotelPMSDesk1!",
	 "roles": ["Front Desk"]},
	{"email": "revenue@hotelpms.local", "first_name": "ريم",
	 "last_name": "القحطاني", "password": "HotelPMSRevenue1!",
	 "roles": ["Revenue Manager"]},
	{"email": "finance@hotelpms.local", "first_name": "فيصل",
	 "last_name": "الغامدي", "password": "HotelPMSFinance1!",
	 "roles": ["Finance"]},
	{"email": "housekeeping@hotelpms.local", "first_name": "نورة",
	 "last_name": "الحربي", "password": "HotelPMSHousekeeping1!",
	 "roles": ["Housekeeping"]},
	{"email": "pos@hotelpms.local", "first_name": "ليان",
	 "last_name": "المطيري", "password": "HotelPMSPOS1!",
	 "roles": ["Restaurant POS"]},
	{"email": "kitchen@hotelpms.local", "first_name": "عمر",
	 "last_name": "الزهراني", "password": "HotelPMSKitchen1!",
	 "roles": ["Kitchen"]},
]


def ensure_roles():
	for role, grants in ROLE_GRANTS.items():
		if not frappe.db.exists("Role", role):
			frappe.get_doc({
				"doctype": "Role", "role_name": role, "desk_access": 1,
			}).insert(ignore_permissions=True)
			print(f"created role: {role}")
		for doctype, (read, write, create) in grants.items():
			perm = frappe.db.get_value(
				"Custom DocPerm", {"parent": doctype, "role": role}, "name"
			)
			if perm:
				frappe.db.set_value("Custom DocPerm", perm, {
					"read": read, "write": write, "create": create,
				})
				continue
			frappe.get_doc({
				"doctype": "Custom DocPerm",
				"parent": doctype,
				"parenttype": "DocType",
				"parentfield": "permissions",
				"role": role,
				"read": read, "write": write, "create": create,
				"report": read, "email": read, "print": read,
			}).insert(ignore_permissions=True)
		print(f"granted {role} perms on {len(grants)} doctypes")


def ensure_users():
	from frappe.utils.password import update_password

	for spec in USERS:
		if frappe.db.exists("User", spec["email"]):
			user = frappe.get_doc("User", spec["email"])
			have = {r.role for r in user.roles}
			missing = [r for r in spec["roles"] if r not in have]
			if missing:
				for r in missing:
					user.append("roles", {"role": r})
				user.save(ignore_permissions=True)
				print(f"updated roles for {spec['email']}: +{missing}")
			continue
		user = frappe.get_doc({
			"doctype": "User",
			"email": spec["email"],
			"first_name": spec["first_name"],
			"last_name": spec["last_name"],
			"enabled": 1,
			"user_type": "System User",
			"send_welcome_email": 0,
			"roles": [{"role": r} for r in spec["roles"]],
		})
		user.insert(ignore_permissions=True)
		update_password(user.name, spec["password"])
		print(f"created user: {spec['email']}")


def execute():
	ensure_roles()
	ensure_users()
	frappe.db.commit()  # nosemgrep: frappe-manual-commit -- batch/seed/migration script runs outside the request cycle; explicit commit persists the staged writes
	print("Roles and demo users ready.")
