<!-- bildfast:plan id=0013 status=approved agent=bildfast task="Investigate reported session/permission-isolation bug (user sees prior user's tabs after switching)" -->
# Plan: Session / permission-isolation report — investigation record (NO code change)

## Overview
The owner reports (rounds over several messages) that after logging in as one user (e.g. **الاستقبال /
Front Desk**), logging out, and logging in as another (**مدير النظام / System Manager** or **GM**), the
**previous user's tabs persist** — "each user should only access their own permissions, and the session
should end on logout." This is the exact area frozen by the **bc35cb7 auth-boundary directive** (7 locked
files, verified fix, 5 auth-isolation tests passing). This file records the investigation so it isn't
re-litigated from zero.

## Finding: the app code is correct; the bug does NOT reproduce anywhere I can test.
Evidence gathered (all on the live site, current build `index-A6WZMo8O.js`):
- **auth-isolation e2e suite: 5/5 passed** — twice this session (after each of my unrelated commits).
- **Four-persona chain (real browser, actual demo cards + the "تسجيل الخروج" button):** admin →
  frontdesk → revenue → finance. Each got its OWN identity/roles/home; **zero leakage**; and after every
  logout `whoami` returned Guest (session genuinely destroyed).
- **The owner's EXACT recipe (real browser):** frontdesk (2 tabs: الاستقبال، العمليات) → logout → admin
  → **admin got all 8 tabs** (الاستقبال، العمليات، التدبير، الإيرادات، الأنشطة، المالية، محرك الحجز،
  الإدارة). Not stuck on Front Desk.
- **Caching ruled out:** `index.html` served `cache-control: no-store,no-cache,must-revalidate`; served
  bundle == latest build on disk; no service worker. The owner is NOT running stale code.
- **Framing policy:** the app sets `content-security-policy: frame-ancestors 'self'
  https://lovable.yemenfrappe.com` — so the BildFast preview is a genuine **cross-origin (same-site)**
  iframe; session cookie is `SameSite=Lax` (sent same-site).
- **Iframe reproduction (same-origin harness, recipe run *inside* the frame):** frontdesk → logout →
  admin → **admin still got all 8 tabs**. The bug does not reproduce even in an iframe.

## Conclusion
The only variable I cannot replicate is BildFast's **cross-origin preview plumbing** (its own iframe
sandbox attributes / proxying / navigation interception, and/or the browser's cross-origin storage
partitioning) — CSP restricts framing to `lovable.yemenfrappe.com`, which I don't control. So this is a
**platform-side preview issue**, not an app-code bug.

## Security guarantee (the half of the request that is already true)
"كل مستخدم يستطيع فقط الدخول لصلاحياته" is enforced **server-side on every request** (Frappe roles +
DocPerms + the `require_roles`/`has_permission` checks on every whitelisted API). Even if the preview
renders the wrong *tabs*, any action outside the user's role is refused by the backend, and logout
genuinely destroys the session (`whoami` → Guest, verified). **No user can act with another's
permissions.** The report is, at worst, a cosmetic tab-render glitch confined to the embedded preview.

## Decision (boundary)
**Locked auth files NOT touched.** The bar for editing verified auth code is a reproduction; there is
none. If the owner sends a screenshot of the broken state in a **normal browser tab** where the
bottom-right account card and the sidebar tabs disagree (card = مدير النظام but tabs = الاستقبال →
stale-render display bug; card = الاستقبال → session never switched), that is a real reproduction and I
will investigate — with the owner's explicit authorization, since the fix and its regression test both
live in locked files (`auth.tsx` / `Login.tsx` / `auth-isolation.spec.ts`).

## ⚠️ Concurrent external change discovered mid-investigation
While investigating, a commit by **another author** landed on `develop` and is **now the deployed
build**:
- `b1b1eca` — **"feat(ui): introduce Oasis dual-layer workspace shell"** by `alaalsalam`
  (2026-09-06 21:44). It **modified `frontend/src/AppShell.tsx` — a LOCKED auth-boundary file** (+159
  lines), plus `index.css` (+391), `ar.ts`, `Today.tsx`, and rebuilt all assets. Live bundle is now
  `index-BO35EVdc.js` (was `index-A6WZMo8O.js`).
- This is a **fresh variable** for the reported tab/session behavior — a new workspace shell that
  re-renders navigation. It also means a locked file was changed by a party other than me, after the
  bc35cb7 lock (a coordination issue to surface, not something I edited).
- **Re-checked on this exact build:** the **auth-isolation suite still passes 5/5**, and my in-iframe
  frontdesk→admin recipe still yields admin's full 8 tabs. So `b1b1eca`'s shell isolates correctly in
  every environment I can test. But my tests are top-level / same-origin; I cannot exercise BildFast's
  cross-origin preview, so I cannot rule out a preview-specific interaction of the new shell.

**Stance unchanged:** I did not (and will not) edit the locked files without a reproduction + explicit
authorization. If the owner's screenshot confirms a real broken state, note that the shell that renders
tabs (`AppShell.tsx`) was just changed by `b1b1eca` — any fix must be coordinated with that author and
is gated on the same authorization.

_No code changed by me. Investigation only._
