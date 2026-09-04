# Copyright (c) 2026, HeyKoala and contributors
# For license information, please see license.txt

"""Pure tests for deposit_satisfied logic without a Frappe site."""


def deposit_satisfied_logic(required: float, status: str | None, collected: float) -> bool:
	if required <= 0:
		return True
	if status is None:
		return False
	if status == "Waived":
		return True
	return collected + 0.01 >= required


def test_no_deposit_required():
	assert deposit_satisfied_logic(0, None, 0) is True


def test_required_uncollected():
	assert deposit_satisfied_logic(5000, "Required", 0) is False


def test_waived():
	assert deposit_satisfied_logic(5000, "Waived", 0) is True


def test_fully_collected():
	assert deposit_satisfied_logic(5000, "Collected", 5000) is True


def should_release_uncollected_deposit(status: str | None, collected: float) -> bool:
	"""Mirror of ``hotelpms.deposit.release_uncollected_deposit``'s guard: on
	cancellation, release a deposit only when it is Required with nothing
	collected. There is no Authorized state in this model — an
	authorized-but-uncollected hold maps to Required (status flips the moment
	any amount is captured) — and a collected or already-terminal deposit is
	left untouched for the refund flow. Never a refund, never a folio entry."""
	if status is None:
		return False  # no deposit row → nothing to release
	return status == "Required" and collected <= 0


def test_release_required_uncollected():
	# case 1: Required / Authorized, nothing captured → released on cancel
	assert should_release_uncollected_deposit("Required", 0) is True


def test_no_release_when_collected():
	# case 2: money was captured → left for refund flow, never auto-touched
	assert should_release_uncollected_deposit("Collected", 5000) is False


def test_no_release_when_no_deposit():
	# case 3: property requires no deposit → cancel is clean, nothing to do
	assert should_release_uncollected_deposit(None, 0) is False


def test_no_release_when_already_terminal():
	# a Waived/refunded deposit is terminal — don't re-touch it
	assert should_release_uncollected_deposit("Waived", 0) is False
