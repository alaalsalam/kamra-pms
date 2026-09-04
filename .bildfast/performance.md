# Performance Review

_Written by the **performance** agent: issues found, severity, and fixes applied or recommended._

## Findings

### Product runtime

- **[HIGH, fixed 2026-09-04] Cross-persona session residue:** the client swallowed a failed logout and
  immediately painted an anonymous state even if the server cookie survived. Logout now has a server-side
  `whoami` postcondition, keeps the user signed in with an error when termination fails, clears the selected
  property, and hard-reloads the SPA after success. Playwright verified Finance → Guest → Restaurant POS and
  direct-route denial for `/billing`.
- **[HIGH, fixed] Inconsistent module navigation:** shell, launcher, command palette and route guard did not
  share the same `Property.enabled_modules` value. A shared/unowned route also fell back visually to the first
  allowed app. They now use one cached/in-flight module loader; route access enforces `role ∩ enabled module`;
  `/apps` has neutral navigation instead of borrowing the first app's sidebar.
- **[HIGH, fixed] Public booking unavailable after nightly reset:** reset deleted the governed writer account.
  The account is now preserved and repaired by every demo seed; public booking was verified live with
  `RES-2026-01105`.
- **[MEDIUM] Main frontend chunk:** current production build reports ~545 kB minified / ~166 kB gzip for the
  shared index. Screens are already lazy-loaded; a future pass should split command/search and large shared
  registries, then compare cold-load LCP before/after rather than changing the warning threshold.

### BildFast execution path review

- The prior UI round completed useful work but consumed about **69.5 minutes, 197 turns, 179k output tokens
  and $83.63**, with no delegated agents, while explicitly leaving backend/RBAC/session flows untested.
- For future improvement rounds: begin with one smoke matrix (Guest + each demo persona), split visual and
  auth/data tracks, cap each track to a concrete screen list, reuse a single browser session, and preserve a
  small evidence manifest (URL, role, viewport, console/network errors). Run `tsc`, the targeted Playwright
  spec and one public booking probe before declaring the round complete.
- Do not repeatedly regenerate broad project context after `.bildfast/project-memory.md` is current. Read the
  memory plus only the files owning the selected flow, then append verified deltas once.
