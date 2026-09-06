"""Regression: the public booking engine must let an anonymous Guest book.

The bug: ``hotelpms.public_api.book`` computed the pre-insert pricing quote
while still running as the ``Guest`` user. ``hotelpms.pricing.quote`` reads
config doctypes the public Guest role cannot access (Room Type / Meal Plan /
Rate Plan / Property), so the moment a meal plan was included — the booking
page auto-selects the first one — Frappe raised

    User Guest does not have doctype access via role permission for document
    Meal Plan / Property

and the guest saw a permission error instead of a confirmation. The fix runs
the quote under the same governed booking agent already used for the write.
This test guards the whole flow: a Guest booking that includes a meal plan
must succeed (or fail only for a real business reason), never on permissions.
"""

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_days, nowdate

from hotelpms import public_api

PROP = "Perm Regression Hotel"


def _ensure(doctype: str, filters: dict, payload: dict) -> str:
    existing = frappe.db.exists(doctype, filters)
    if existing:
        return existing
    return (
        frappe.get_doc({"doctype": doctype, **payload})
        .insert(ignore_permissions=True)
        .name
    )


class TestPublicBookingPermissions(FrappeTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.prop = _ensure(
            "Property",
            {"property_name": PROP},
            {"property_name": PROP, "city": "Testville", "booking_engine_enabled": 1},
        )
        cls.rt = _ensure(
            "Room Type",
            {"property": PROP, "room_type_code": "STD"},
            {
                "property": PROP,
                "room_type_code": "STD",
                "room_type_name": "Standard",
                "base_price": 1000,
                "base_occupancy": 2,
            },
        )
        _ensure(
            "Room",
            {"property": PROP, "room_number": "101"},
            {"property": PROP, "room_number": "101", "room_type": cls.rt},
        )
        cls.mp = _ensure(
            "Meal Plan",
            {"property": PROP, "code": "CP"},
            {
                "property": PROP,
                "code": "CP",
                "label": "Breakfast",
                "price_per_adult": 100,
                "price_per_child": 50,
            },
        )
        frappe.db.commit()

    def _cleanup_reservation(self, name: str):
        for dt, field in (("Security Deposit", "reservation"), ("Folio", "reservation")):
            for n in frappe.get_all(dt, filters={field: name}, pluck="name"):
                frappe.delete_doc(dt, n, force=True, ignore_permissions=True)
        frappe.delete_doc("Reservation", name, force=True, ignore_permissions=True)

    def test_guest_booking_with_meal_plan_is_not_a_permission_error(self):
        ci, co = add_days(nowdate(), 45), add_days(nowdate(), 47)
        reservation = None
        frappe.set_user("Guest")
        try:
            result = public_api.book(
                property=self.prop,
                room_type=self.rt,
                check_in_date=ci,
                check_out_date=co,
                guest_name="Regression Guest",
                phone="+911234500099",
                adults=2,
                children=0,
                meal_plan=self.mp,
            )
            reservation = result.get("reservation")
        except frappe.PermissionError as exc:  # the exact bug being guarded
            self.fail(f"public book raised a permission error as Guest: {exc}")
        finally:
            frappe.set_user("Administrator")

        self.assertTrue(reservation, "Guest booking with a meal plan returned no reservation")
        if reservation:
            self._cleanup_reservation(reservation)
            frappe.db.commit()
