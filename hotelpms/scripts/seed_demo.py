"""Seed a demo property so the local build shows a living hotel.

Run with:
    bench --site hotelpms.localhost execute hotelpms.scripts.seed_demo.execute

Idempotent: does nothing if the demo property already exists.
To wipe a public playground and rebuild from scratch, use
``hotelpms.scripts.reset_demo.execute`` instead.
"""

import random

import frappe
from frappe.utils import add_days, nowdate

PROPERTY = "فندق نُزُل الرياض | Nuzul Riyadh Hotel"

ROOM_TYPES = [
	("STD", "غرفة نُزُل كلاسيك | Nuzul Classic Room", 650, "أفق الرياض | Riyadh Skyline", ["101", "102", "103", "104", "105", "106"]),
	("DLX", "غرفة نُزُل ديلوكس | Nuzul Deluxe Room", 950, "المسبح | Pool", ["201", "202", "203", "204", "205"]),
	("STE", "جناح نُزُل التنفيذي | Nuzul Executive Suite", 1650, "برج المملكة | Kingdom Centre", ["301", "302", "303"]),
]

GUESTS = [
	("نورا", "القحطاني", "+966 50 810 1002"),
	("عبدالله", "العتيبي", "+966 55 810 1003"),
	("ريم", "الشمري", "+966 56 810 1004"),
	("فيصل", "الغامدي", "+966 54 810 1005"),
	("سارة", "الحربي", "+966 53 810 1006"),
	("Omar", "Haddad", "+962 79 010 1007"),
	("Lina", "Mansour", "+961 70 101 008"),
	("Maya", "Rahman", "+44 7700 900109"),
	("Daniel", "Lee", "+65 9101 0110"),
	("خالد", "الدوسري", "+966 58 810 1011"),
]


def execute():
	from hotelpms.scripts.seed_users import ensure_governed_writer, ensure_users

	# Mark this as a demo site so the login screen shows the demo accounts.
	frappe.db.set_default("hotelpms_demo_mode", "1")
	if frappe.db.exists("Property", PROPERTY):
		ensure_users()
		ensure_governed_writer()
		from hotelpms.scripts.seed_showcase import execute as seed_showcase
		seed_showcase()
		seed_generic_properties()
		frappe.db.commit()  # nosemgrep: frappe-manual-commit -- batch/seed/migration script runs outside the request cycle; explicit commit persists the staged writes
		print("Demo property already exists — ensured demo users + showcase.")
		return

	random.seed(8)  # reproducible demo

	prop = frappe.get_doc(
		{
			"doctype": "Property",
			"property_name": PROPERTY,
			"city": "Riyadh | الرياض",
			"state": "Riyadh",
			"country": "Saudi Arabia",
			"currency": "SAR",
			"phone": "+966 11 400 8000",
			"email": "reservations@hotelpms.sa",
			"gstin": "310123456700003",
		}
	).insert(ignore_permissions=True)

	rooms_by_type = {}
	for code, label, price, view, room_numbers in ROOM_TYPES:
		rt = frappe.get_doc(
			{
				"doctype": "Room Type",
				"property": prop.name,
				"room_type_code": code,
				"room_type_name": label,
				"base_price": price,
				"base_occupancy": 2,
				"extra_adult_price": round(price * 0.25),
				"adults_capacity": 2 if code != "STE" else 3,
				"children_capacity": 1,
				"bed_type": "King" if code == "STE" else "Queen",
				"room_view": view,
				"tax_percent": 15,
				"amenities": "WiFi, AC, TV, Tea/Coffee",
			}
		).insert(ignore_permissions=True)
		rooms_by_type[rt.name] = []
		# spread the rooms across two floors so "high/low floor" preferences
		# have something to resolve against
		for idx, num in enumerate(room_numbers):
			floor = int(num[0]) + (1 if idx >= len(room_numbers) // 2 else 0)
			room = frappe.get_doc(
				{
					"doctype": "Room",
					"property": prop.name,
					"room_number": num,
					"room_type": rt.name,
					"floor": str(floor),
				}
			).insert(ignore_permissions=True)
			rooms_by_type[rt.name].append(room.name)

	frappe.get_doc(
		{
			"doctype": "Rate Plan",
			"property": prop.name,
			"rate_plan_name": "Best Available Rate",
			"code": "BAR",
			"modifier_type": "Percent",
			"modifier_value": 0,
			"is_default": 1,
		}
	).insert(ignore_permissions=True)

	guests = []
	for first, last, phone in GUESTS:
		guests.append(
			frappe.get_doc(
				{
					"doctype": "Guest",
					"first_name": first,
					"last_name": last,
					"phone": phone,
					"vip": 1 if first in ("Priya", "Vikram") else 0,
				}
			).insert(ignore_permissions=True)
		)

	today = nowdate()
	all_room_types = list(rooms_by_type.keys())
	used_rooms = set()

	def pick_room(rt):
		for r in rooms_by_type[rt]:
			if r not in used_rooms:
				used_rooms.add(r)
				return r
		return None

	def mk_res(guest, rt, ci, co, status, source, room=None):
		doc = frappe.get_doc(
			{
				"doctype": "Reservation",
				"property": prop.name,
				"guest": guest.name,
				"room_type": rt,
				"room": room,
				"check_in_date": ci,
				"check_out_date": co,
				"status": "Confirmed",
				"source": source,
				"adults": 2,
				"amount_before_tax": 0,
			}
		)
		doc.insert(ignore_permissions=True)
		if status != "Confirmed":
			doc.status = status
			doc.save(ignore_permissions=True)
		return doc

	# 3 in-house guests (checked in yesterday, leaving tomorrow/later)
	for i in range(3):
		rt = all_room_types[i % len(all_room_types)]
		room = pick_room(rt)
		mk_res(guests[i], rt, add_days(today, -1), add_days(today, 1 + i),
		       "Checked In", "OTA" if i == 0 else "Manual", room)

	# 2 of today's departures (checked in 2 days ago, leaving today)
	for i in range(3, 5):
		rt = all_room_types[i % len(all_room_types)]
		room = pick_room(rt)
		mk_res(guests[i], rt, add_days(today, -2), today,
		       "Checked In", "Phone", room)

	# 3 arrivals today (confirmed, not yet checked in; one by the AI agent)
	for i in range(5, 8):
		rt = all_room_types[i % len(all_room_types)]
		room = pick_room(rt)
		mk_res(guests[i], rt, today, add_days(today, 2),
		       "Confirmed", "AI Agent" if i == 5 else "Website", room)

	# 2 future bookings
	for i in range(8, 10):
		rt = all_room_types[i % len(all_room_types)]
		mk_res(guests[i], rt, add_days(today, 3), add_days(today, 5),
		       "Confirmed", "OTA")

	# A few savings-ledger rows so the counter is alive
	from hotelpms.savings import log_action

	for action, minutes, why in [
		("answer_guest_call", 6, "Answered rate inquiry on voice, quoted Deluxe"),
		("create_reservation", 8, "Booked 2-night Deluxe stay over WhatsApp"),
		("send_arrival_reminder", 4, "Confirmed ETA with tomorrow's arrival"),
		("night_audit_prep", 25, "Reconciled today's postings automatically"),
	]:
		log_action(
			action_type=action,
			property=prop.name,
			minutes_saved=minutes,
			rationale=why,
			agent_name="HotelPMS Agent",
			channel="Voice" if "call" in action else "WhatsApp",
		)

	# Demo login accounts (one per role) so the gated login buttons work.
	ensure_users()
	ensure_governed_writer()

	# showcase experiences + venues (safari, spa, romantic dinner, ballrooms)
	from hotelpms.scripts.seed_showcase import execute as seed_showcase
	seed_showcase()

	# Seed generic demo properties (lakeside villa with whole-property lock, and beach homestay with AC/non-AC rooms)
	seed_generic_properties()

	frappe.db.commit()  # nosemgrep: frappe-manual-commit -- batch/seed/migration script runs outside the request cycle; explicit commit persists the staged writes
	print(f"Seeded demo property '{PROPERTY}' with rooms, guests, reservations and login users.")


def seed_generic_properties():
	# 1. Seed منتجع نُزُل الدرعية | Nuzul Diriyah Retreat (Generic Tatasth structure)
	p1 = "منتجع نُزُل الدرعية | Nuzul Diriyah Retreat"
	if not frappe.db.exists("Property", p1):
		prop = frappe.get_doc({
			"doctype": "Property",
			"property_name": p1,
			"city": "Riyadh | الرياض",
			"state": "Riyadh",
			"country": "Saudi Arabia",
			"currency": "SAR",
			"phone": "+966 11 400 8001",
			"email": "diriyah@hotelpms.sa",
			"gstin": "310123456700004",
			"checkin_time": "14:00:00",
			"checkout_time": "11:00:00",
			"minimum_nights": 1,
			"booking_payment_mode": "Advance percent",
			"advance_percent": 100,
			"security_deposit_amount": 1000,
		}).insert(ignore_permissions=True)
		
		rt_std = frappe.get_doc({
			"doctype": "Room Type",
			"property": prop.name,
			"room_type_code": "STD",
			"room_type_name": "Standard Room",
			"room_category": "Private",
			"base_price": 800,
			"base_occupancy": 2,
			"extra_adult_price": 180,
			"child_price": 90,
			"free_child_age": 6,
			"adults_capacity": 2,
			"children_capacity": 1,
			"max_total_occupants": 3,
		}).insert(ignore_permissions=True)
		
		rt_villa = frappe.get_doc({
			"doctype": "Room Type",
			"property": prop.name,
			"room_type_code": "VILLA",
			"room_type_name": "Entire Property",
			"room_category": "Villa",
			"base_price": 4500,
			"base_occupancy": 10,
			"extra_adult_price": 180,
			"child_price": 90,
			"free_child_age": 6,
			"adults_capacity": 10,
			"children_capacity": 5,
			"max_total_occupants": 15,
		}).insert(ignore_permissions=True)
		
		# Tatasth physical rooms (Ground Floor & First Floor)
		for i in range(1, 6):
			floor = "Ground Floor" if i <= 3 else "First Floor"
			frappe.get_doc({
				"doctype": "Room",
				"property": prop.name,
				"room_number": f"Room {i}",
				"room_type": rt_std.name,
				"floor": floor
			}).insert(ignore_permissions=True)
			
		from hotelpms.api import set_room_rate
		set_room_rate(prop.name, rt_std.name, "2026-08-01", "2027-08-01", 920, reason="Weekend Rate", days_of_week=["Fri", "Sat"])
		set_room_rate(prop.name, rt_villa.name, "2026-08-01", "2027-08-01", 5200, reason="Weekend Rate", days_of_week=["Fri", "Sat"])
		print("Seeded generic منتجع نُزُل الدرعية | Nuzul Diriyah Retreat.")

	# 2. Seed أجنحة نُزُل العليا | Nuzul Olaya Suites (Generic Waterfront structure)
	p2 = "أجنحة نُزُل العليا | Nuzul Olaya Suites"
	if not frappe.db.exists("Property", p2):
		prop = frappe.get_doc({
			"doctype": "Property",
			"property_name": p2,
			"city": "Riyadh | الرياض",
			"state": "Riyadh",
			"country": "Saudi Arabia",
			"currency": "SAR",
			"phone": "+966 11 400 8002",
			"email": "olaya@hotelpms.sa",
			"gstin": "310123456700005",
			"checkin_time": "14:00:00",
			"checkout_time": "11:00:00",
			"minimum_nights": 1,
			"booking_payment_mode": "Advance percent",
			"advance_percent": 100,
			"security_deposit_amount": 500,
		}).insert(ignore_permissions=True)
		
		rt_tfac = frappe.get_doc({
			"doctype": "Room Type", "property": prop.name,
			"room_type_code": "TFAC", "room_type_name": "Top Floor AC",
			"room_category": "Private", "base_price": 680, "base_occupancy": 2,
			"adults_capacity": 2, "children_capacity": 1, "max_total_occupants": 3
		}).insert(ignore_permissions=True)
		
		rt_uf2r = frappe.get_doc({
			"doctype": "Room Type", "property": prop.name,
			"room_type_code": "UF2R", "room_type_name": "Upper Floor (2-room)",
			"room_category": "Private", "base_price": 950, "base_occupancy": 4,
			"adults_capacity": 4, "children_capacity": 2, "max_total_occupants": 6
		}).insert(ignore_permissions=True)
		
		rt_gfna = frappe.get_doc({
			"doctype": "Room Type", "property": prop.name,
			"room_type_code": "GFNA", "room_type_name": "Ground Floor Non-AC – Room A",
			"room_category": "Private", "base_price": 480, "base_occupancy": 2,
			"adults_capacity": 2, "children_capacity": 1, "max_total_occupants": 3
		}).insert(ignore_permissions=True)
		
		rt_gfnb = frappe.get_doc({
			"doctype": "Room Type", "property": prop.name,
			"room_type_code": "GFNB", "room_type_name": "Ground Floor Non-AC – Room B",
			"room_category": "Private", "base_price": 520, "base_occupancy": 2,
			"adults_capacity": 2, "children_capacity": 1, "max_total_occupants": 3
		}).insert(ignore_permissions=True)
		
		# Physical Rooms (Top Floor, Upper Floor, Ground Floor)
		frappe.get_doc({"doctype": "Room", "property": prop.name, "room_number": "Room 1", "room_type": rt_tfac.name, "floor": "Top Floor"}).insert(ignore_permissions=True)
		frappe.get_doc({"doctype": "Room", "property": prop.name, "room_number": "Room 2", "room_type": rt_uf2r.name, "floor": "Upper Floor"}).insert(ignore_permissions=True)
		frappe.get_doc({"doctype": "Room", "property": prop.name, "room_number": "Room 3", "room_type": rt_uf2r.name, "floor": "Upper Floor"}).insert(ignore_permissions=True)
		frappe.get_doc({"doctype": "Room", "property": prop.name, "room_number": "Room 4", "room_type": rt_gfna.name, "floor": "Ground Floor"}).insert(ignore_permissions=True)
		frappe.get_doc({"doctype": "Room", "property": prop.name, "room_number": "Room 5", "room_type": rt_gfnb.name, "floor": "Ground Floor"}).insert(ignore_permissions=True)
		print("Seeded generic أجنحة نُزُل العليا | Nuzul Olaya Suites.")
