"""Localization seam. The core PMS never knows about GST, VAT or fiscal
printers - it asks the country pack. Packs are resolved through the
`hotelpms_localization` hook (ERPNext regional_overrides style), so a future
`hotelpms_uae` app claims its country just by declaring the hook. Countries
without a pack fall back to a plain flat-tax `generic` pack.

Interface every pack implements (see india.py):
  calculate_room_tax(property, room_type_doc, nightly_rate) -> Decimal
  fnb_tax_rate(property) -> float
  tax_rate_options(property) -> list[float]
  invoice_context(prop_doc) -> dict   (labels, service code, place of supply)
  locale(prop_doc) -> dict            (currency_symbol, locale, tax_label...)

Optional, for invoice printing - a pack that doesn't implement these gets
a sensible default from the accessors at the bottom of this file, so an
existing pack keeps working untouched:
  service_code_for(prop_doc, charge_type) -> dict | None   (per-LINE SAC/HSN)
  tax_split(prop_doc, buyer_tax_id) -> list[(label, share)]
  amount_in_words(prop_doc, amount) -> str
"""

import importlib

import frappe


def pack_for(property: str | None = None):
	country = None
	if property:
		country = frappe.get_cached_value("Property", property, "country")
	country = country or "India"
	mapping = frappe.get_hooks("hotelpms_localization") or {}
	target = mapping.get(country)
	if target:
		path = target[-1] if isinstance(target, (list, tuple)) else target
		try:
			return importlib.import_module(path)
		except ModuleNotFoundError:
			pass
	from hotelpms.localization import generic
	return generic


# ── currency: the property's own currency is the single source of truth ───
# The country pack decides the tax vocabulary (VAT/GST); the currency SYMBOL
# comes from the property's `currency` field so the Default Currency chosen in
# Property Setup drives every screen and document. Trailing space where the UI
# concatenates symbol + amount (so "ر.س 1,500", not "ر.س1,500").
_CURRENCY_SYMBOLS = {
	"SAR": "ر.س ",
	"YER": "ر.ي ",
	"AED": "د.إ ",
	"KWD": "د.ك ",
	"QAR": "ر.ق ",
	"BHD": "د.ب ",
	"OMR": "ر.ع ",
	"EGP": "ج.م ",
	"JOD": "د.أ ",
	"USD": "$",
	"EUR": "€",
	"GBP": "£",
	"INR": "₹",
	"IDR": "Rp ",
	"MYR": "RM ",
	"THB": "฿",
}


def currency_symbol_for(currency: str | None) -> str | None:
	"""Display symbol for a currency code: explicit map → Frappe Currency master
	→ the code itself. Never falls back to another country's symbol (no stray ₹)."""
	if not currency:
		return None
	code = str(currency).strip().upper()
	if code in _CURRENCY_SYMBOLS:
		return _CURRENCY_SYMBOLS[code]
	sym = frappe.db.get_value("Currency", code, "symbol")
	return sym or f"{code} "


_ARABIC_COUNTRIES = {
	"Saudi Arabia", "Yemen", "United Arab Emirates", "Qatar", "Kuwait",
	"Bahrain", "Oman", "Egypt", "Jordan", "Iraq", "Lebanon", "Syria",
	"Palestine", "Libya", "Sudan", "Algeria", "Morocco", "Tunisia",
}


def locale_for_country(country: str | None) -> str:
	"""Number-formatting locale for a country, so a new property never inherits
	another market's grouping (e.g. Indian lakhs on a Yemen property). Arabic
	markets use ar-SA (standard grouping + Arabic-Indic digits); everyone else
	falls back to en-US."""
	return "ar-SA" if (country or "") in _ARABIC_COUNTRIES else "en-US"


def locale_for(prop_doc) -> dict:
	"""The pack's locale, but with the currency symbol driven by the property's
	own `currency` when one is set. Contract: currency set → currency wins;
	not set → the pack's default wins (existing properties stay pixel-identical)."""
	loc = pack_for(prop_doc.name).locale(prop_doc)
	currency = prop_doc.get("currency")
	if currency:
		loc["currency_symbol"] = currency_symbol_for(currency)
	return loc


# ── optional pack behaviour, with defaults ───────────────────────────────
# A pack that predates these keeps working: each accessor falls back to
# something correct-but-plain, so adding a country never means editing the
# invoice printer.


def service_code_for(pack, prop_doc, charge_type: str | None = None):
	"""The tax service code for ONE line. A bill that mixes a room night,
	a restaurant cover and a laundry bag carries three different codes -
	printing the accommodation code against all of them is wrong."""
	fn = getattr(pack, "service_code_for", None)
	if fn:
		return fn(prop_doc, charge_type)
	return pack.invoice_context(prop_doc).get("service_code")


def tax_split(pack, prop_doc, buyer_tax_id: str | None = None):
	"""How the tax on this bill is named and divided - [(label, share)].
	Passed the buyer's tax id because in some countries who they are (and
	where) changes the answer."""
	fn = getattr(pack, "tax_split", None)
	if fn:
		return fn(prop_doc, buyer_tax_id)
	return pack.invoice_context(prop_doc)["split"]


def amount_in_words(pack, prop_doc, amount) -> str:
	fn = getattr(pack, "amount_in_words", None)
	if fn:
		return fn(prop_doc, amount)
	from hotelpms.localization.words import amount_in_words as spell

	loc = pack.locale(prop_doc)
	return spell(amount, loc.get("currency") or "", indian=False)
