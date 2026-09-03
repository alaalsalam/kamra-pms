"""Saudi Arabia localization pack for the YF Hotels showcase.

Saudi VAT is a single federal tax line. The pack deliberately does not claim
ZATCA e-invoicing compliance: production clearance, UUID/hash chaining, QR
content and cryptographic stamping belong to a dedicated integration.
"""

from decimal import Decimal


DEFAULT_VAT = Decimal("15")


def calculate_room_tax(property, room_type_doc, nightly_rate) -> Decimal:
	"""Use the configured room VAT, falling back to the Saudi standard rate."""
	rate = room_type_doc.get("tax_percent") if room_type_doc else None
	return Decimal(str(rate)) if rate is not None else DEFAULT_VAT


def fnb_tax_rate(property) -> float:
	return float(DEFAULT_VAT)


def tax_rate_options(property) -> list:
	return [0, 15]


def invoice_context(prop_doc) -> dict:
	return {
		"tax_label": "VAT | ضريبة القيمة المضافة",
		"tax_id_label": "VAT Registration No. | الرقم الضريبي",
		"service_code": None,
		"sac": None,
		"place_of_supply": prop_doc.get("city") or prop_doc.get("state"),
		"split": [("vat", Decimal("1"))],
		"footer": (
			"Tax Invoice | فاتورة ضريبية — demo document. Configure the "
			"ZATCA e-invoicing and QR integration before production use."
		),
	}


def locale(prop_doc) -> dict:
	return {
		# The UI concatenates the symbol and amount, hence the trailing space.
		"currency_symbol": "ر.س ",
		"locale": prop_doc.get("locale") or "ar-SA",
		"currency": prop_doc.get("currency") or "SAR",
		"tax_label": "VAT",
		"tax_id_label": "VAT Registration No.",
		"tax_rates": tax_rate_options(prop_doc.name),
	}
