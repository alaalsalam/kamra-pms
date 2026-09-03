# Install via Frappe Cloud

[Frappe Cloud](https://frappecloud.com) is managed Frappe hosting by the
framework's makers — one-click installs from its Marketplace, with
backups and updates handled for you.

## After the listing is live

1. Create a Frappe Cloud account and a **site** on a v16 bench.
2. Open the **Marketplace**, search for **HotelPMS**, and install it
   (`payments` is pulled in automatically via `required_apps`).
3. Open `https://<your-site>/hotelpms`, sign in as **Administrator** (or
   **admin@example.com**) with the site password Frappe Cloud showed at
   create-site, and run `/hotelpms/setup` to create the first property.

HotelPMS itself is free on Frappe Cloud. Billing is only for the site.

For a walkthrough of the product after install, use the
[live demo](https://demo.hotelpms.yemenfrappe.com) — that is the same packaged SPA
a Marketplace install serves.

## What a Marketplace install actually does

Frappe Cloud clones `YemenFrappe/hotelpms` at the approved `main` SHA,
installs `payments`, then `bench --site <site> install-app hotelpms`. It
does **not** run `npm`. The UI is the committed build under
`hotelpms/public/frontend`.

That is why every release must keep:

- `pyproject.toml` with `requires-python >= 3.10` and Frappe
  `>=16.0.0-dev,<17.0.0`
- `required_apps = ["payments"]`
- `add_to_apps_screen` + `/hotelpms/<path:app_path>` route
- the prebuilt SPA (`index.html` pointing at `/assets/hotelpms/frontend/`)

## Simulation we run before each release

Two layers, both in GitHub Actions:

1. **Offline pack check** (`python hotelpms/scripts/marketplace_install_check.py`)
   — the same gates FC's auditor cares about, without MariaDB.
2. **Full bench path** (CI job *Backend eval harness*) —
   `bench init` → `get-app payments` → `get-app hotelpms` → `new-site` →
   `install-app hotelpms` → eval harness + front-desk journey +
   fresh-install role/SPA asserts.

Locally (from a clone of `main`):

```bash
python hotelpms/scripts/marketplace_install_check.py
```

Example run against the SHA that cleared Submission Gate
(`AUD-hotelpms-00003`, source `SRC-hotelpms-002`):

```
PASS  pyproject.toml valid (python >=3.10, frappe >=16.0.0-dev,<17.0.0)
PASS  hooks.py: payments, /hotelpms launcher, SPA route, AGPL
PASS  prebuilt SPA shipped (marketplace benches do not run npm)
PASS  license + FC yarn build entrypoint present
PASS  every frappe.set_user / db.commit has same-line nosemgrep
PASS  listing long description has no extra URLs

MARKETPLACE-INSTALL CHECKS PASSED
```

### Latest Submission Gate (AUD-hotelpms-00003)

The Jul 27 Fail (59 Semgrep Correctness issues) and the follow-up
Major `frappe-manual-commit` are gone. This scan is **22 passed · 1
warning** (Minor Semgrep Security `frappe-setuser`, now annotated
on the same line for the next release).

![Frappe Cloud audit AUD-hotelpms-00003](/marketplace/aud-hotelpms-00003.png)

The app stays **In Review** until a Frappe reviewer publishes it.
That badge is not another installer failure.

### After install — what the site looks like

Same UI as the [live demo](https://demo.hotelpms.yemenfrappe.com): sign-in, Today
board, tape chart, booking engine. Product screenshots for the
Marketplace listing live in
[`docs/marketplace-listing.md`](https://github.com/YemenFrappe/hotelpms/blob/main/docs/marketplace-listing.md).
