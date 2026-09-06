<!-- bildfast:plan id=0012 status=approved agent=bildfast task="Move Experiences into a new 'Activities' tab + confirm System Manager access" -->
# Plan: Move Experiences into an "Activities (الأنشطة)" tab

## Overview
Follow-up to plan 0011. The owner asked to (1) confirm the Experiences screen is accessible to the
**System Manager** role, and (2) move it out of the **Revenue** tab into a dedicated **"Activities /
الأنشطة"** tab — since experiences ARE activities and that's where they'd look to add them.

## Plan
Frontend-only nav change (no backend, no `bench restart`): add an `activities` app in `lib/apps.ts`
and move the `/experiences` nav item into it. Confirm System Manager access live.

## Execution Note
Done + built + **auth-isolation suite passed (5/5)** + verified live as System Manager. No protected
auth-boundary file touched.

**Why frontend-only:** apps are module-gated by `enabled_modules(property)` which returns the backend
`ALL_MODULES` tuple (`hotelpms/api.py`). Adding a real `activities` module id there would require a
**`bench restart`** (site `developer_mode: 0`, no auto-reload) — and this is a **shared bench (~20
sites)**, so a restart would disrupt every tenant. Instead the `activities` tab is registered
frontend-only and marked always-on.

**Files changed (all non-protected):**
- `frontend/src/lib/apps.ts` — removed `{ /experiences }` from the `revenue` app; added a new
  `activities` AppDef (name "Activities", icon `MapPin`, roles `["Revenue Manager", "Hotel Admin",
  "System Manager", "Administrator"]`) containing the Experiences item. Added `ALWAYS_ON_MODULES` +
  a `moduleActive(appId, modules)` helper and routed the three gates (`canAccessPath`,
  `firstAccessiblePath`, `visibleApps`) through it, so `activities` shows regardless of the
  per-property module toggle (role gating is unchanged).
- `frontend/src/lib/translations/ar.ts` — `Activities`→الأنشطة + the app description.

**Verification:**
- **System Manager access (request 1):** logged in live as `admin@hotelpms.local` (System Manager) —
  reached `/experiences` (no login redirect), and the sidebar shows **"الأنشطة" → "التجارب"** with all
  10 experiences + the "New" button. Screenshot: `verify-activities-tab-sysmanager-ar.png`.
- **Activities tab (request 2):** Experiences no longer under Revenue; now its own **الأنشطة** tab.
- **Boundary (bc35cb7):** none of the 7 locked files touched; ran the full **auth-isolation e2e suite
  → 5 passed** before committing (the gating functions I edited are exactly what those tests guard).

**Note:** the `activities` tab is a frontend grouping and is NOT in the backend per-property module
toggle (`ALL_MODULES`) — it's always available to its roles. If you later want it toggleable per
property, add `"activities"` to `ALL_MODULES` in `hotelpms/api.py` and `bench restart` (deferred to
avoid the shared-bench restart).
