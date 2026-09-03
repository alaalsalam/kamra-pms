# BildFast Frontend Rules & UI System — how to build this app's frontend

> Read this in the **Frontend phase**. You are a **senior product engineer + UI/UX designer**: build a modern,
> clean, modular, responsive app. Per-project specifics (modules, roles, pages, API contract) come from
> `.bildfast/business.md` + `.bildfast/architecture.md`. (BildFast refreshes this file on updates; to keep a
> customized copy, ask BildFast to pin it.)
>
> **Lists/tables = `<DataGrid doctype="X" />`** (`src/components/data-grid/`). Metadata-driven via Frappe's
> built-in `getdoctype` + `client.get_list` — gives advanced filter + column picker + saved views + quick
> filters + sort + pagination from one prop, no per-doctype backend. Frontend phase: `mock={{ rows }}`;
> Backend phase: drop `mock`. `useDataGrid(doctype)` for custom layouts. NEVER hand-build list/filter/column code.
>
> **This app already ships the BildFast starter** — `frontend/` is a complete React + TS + Vite + shadcn/ui app
> implementing everything below (Frappe-CRM-clean **glass** theme, i18n + RTL Arabic-first, RBAC, the app shell,
> common auth pages, ~47 shadcn components, `components.json` with `rtl:true`). So this doc is the **reference for
> the conventions already in place** — your job is to **extend** the starter (real modules/pages/roles), NOT to
> rebuild the theme/shell/components. Add primitives with `npx shadcn@latest add <name>` (themed + RTL). Only when
> `frontend/` is NOT the starter (older app / import) do you set this up from scratch.

## 0. MATCH the app's existing stack first
Read `frontend/package.json`, `tsconfig`, the Vite config and the `src/` tree BEFORE coding. **If the app
already has an established stack — TypeScript, shadcn/ui, an `@` alias, its own data client — FOLLOW it
exactly; do not impose a different one.** The rules below are the **house standard for fresh apps** and the
convention everyone converges toward. (Note: the data layer is **Frappe** here, not Supabase — see §11.)

## 0b. Before styling — confirm with the user (clickable questions)
1. **Default language** — Arabic-first (⇒ RTL default) or English-first (⇒ LTR default)? Both supported.
2. **Visual identity** — propose the §Visual-identity palette + **Zain** font; keep or customize.
3. **Logo** — provide one, or use a tasteful placeholder wordmark for now.

## 1. Core stack (house standard)
- **React + TypeScript + Vite.** **shadcn/ui** as the primary UI foundation + **Tailwind CSS** for styling.
- The **`@` alias** for imports from `src` (configure in `vite.config` `resolve.alias` + `tsconfig` `paths`).
- **React Router** for routing. **React Query** available for async/server-state caching.
- A fresh BildFast scaffold starts as plain JSX — if so, ESTABLISH this stack first: switch the entry to `.tsx`,
  add `tsconfig.json` + the `@` alias, set up Tailwind (`tailwind.config.ts` + postcss + `src/index.css`
  tokens) and shadcn/ui (`components.json` + the primitives you use). Add deps to `frontend/package.json`; the
  pipeline runs `yarn install`.

## 2. Folder structure (under `src/`) — same as the Tanfidi layout
- `src/pages` — **route-level pages only**, grouped by business module
- `src/components` — reusable components · `src/components/ui` — **shadcn primitives** ·
  `src/components/layouts` — layout shells (e.g. `ModuleLayout`) · `src/components/sidebars` — sidebar
  components · `src/components/rbac` — auth/permission UI wrappers
- `src/contexts` — global app/auth state only (`AppContext`, `AuthContext`)
- `src/hooks` — reusable hooks · `src/lib` — utilities/helpers/config-like logic (`utils.ts` with `cn()`,
  `i18n.ts`, `rbac/`) · `src/config` — app/module configuration · `src/data` — static/mock/seed data ·
  `src/integrations` — external integrations · `src/assets` — assets

## 3. Pages & modules
- Every routable screen under `src/pages`, **grouped by domain/module** (e.g. `pages/beneficiaries/…`,
  `pages/housing/…`, `pages/settings/…`). Route files are page-level **containers** (orchestration), not logic
  dumps — extract reusable sections into `src/components/<feature>` (e.g. `components/beneficiary-form`).

## 4. Components & reusability
- App-wide reusable → `src/components`; feature-specific → `src/components/<feature>`; low-level primitives →
  `src/components/ui` (don't duplicate shadcn primitives). Shared layouts → `src/components/layouts`.
- **Reuse before creating** — check `components/ui`, `components`, and feature folders first. Never duplicate
  buttons / cards / badges / dialogs / tables / toasts / tooltips / sidebar patterns.

## 5. Naming
- Components **PascalCase** (`AppHeader.tsx`, `ModuleLayout.tsx`). Hooks `useXxx.ts(x)`. Contexts
  `XxxContext.tsx`. Utilities camelCase / existing style (`utils.ts`, `i18n.ts`, `workOrderStatus.ts`).

## 6. Imports
- Prefer **`@/` absolute** (`@/components/ui/button`, `@/contexts/AuthContext`); relative only within a small
  folder. Order: 1) external libs · 2) `@/…` · 3) local relative · 4) styles/assets.

## 7. Styling & 8. Theming
- Tailwind utility classes in components; **semantic tokens** (`bg-background`, `text-foreground`,
  `border-border`, `text-muted-foreground`) — never hardcode a color when a token exists. Design-system colors
  are **HSL / CSS-variable based** in `src/index.css`; reuse conventions like `transition-smooth`.
- Support **light + dark**: every new component works in both via token classes (not fixed light-only colors).
  New tokens are defined centrally in `src/index.css` and wired into `tailwind.config.ts`.

## 9. i18n / RTL (bilingual ar + en)
- Reuse `src/lib/i18n.ts` + the app context; add **both ar + en** for any new string. Every screen is
  direction-aware (use `start/end`, never hardcode left/right); must render correctly under `dir="rtl"` and
  `dir="ltr"`. An `AppContext` holds language/direction/theme; a switcher + theme toggle live in the header.

## 10. State
- `src/contexts` = **global cross-app state only** (auth, app preferences, direction/theme/language, session).
  `src/hooks` = feature/page-local reusable logic (forms, query-params). Don't dump everything into one god
  context; don't put page-local state in a global context.

## 11. Data / API — Frappe (NOT Supabase)
- The backend is **Frappe** (doctypes + `@frappe.whitelist()` APIs). Keep data access in a **service/helper
  layer** separate from UI. In the **Frontend phase** use a `localStorage` mock whose function names + payloads
  MATCH `architecture.md`'s API contract; the Backend phase swaps it for `fetch('/api/method/__APP_NAME__.api.<fn>')`
  (POST + `X-Frappe-CSRF-Token: window.csrf_token`, read `data.message`). Use **React Query** where caching
  matters. Don't create a second data client. (If an imported app already uses a different client, follow it.)

## 12. Auth / RBAC
- Respect the auth/permission model: reuse `useAuth()`, RBAC helpers/types from `@/lib/rbac`, and
  `src/components/rbac` (e.g. `RouteGuard`, a `GatedButton` that disables + explains, hide unauthorized nav,
  a “غير مصرح / Unauthorized” view). Module pages stay inside the module layout/gating pattern. Don't bypass
  permission checks. (Frontend phase mocks roles/users; the Backend phase wires real permissions.)

## 13. Routing
- Routes declared centrally in `src/App.tsx`. Module route style (`/beneficiaries/…`, `/housing/…`); use
  `ModuleLayout` for module pages, public/auth pages outside it. Params in the existing style (`:id`,
  `:projectId`, `:beneficiaryId`). **Every page needs a `<Route>`** (basename is already `/__APP_ROUTE__`).
  URL pattern: `role_name/page_name` and `module_name/role_name/page_name` (lowercase + `under_scores`).

## 14. Page composition & 15. Forms & 16. TypeScript & 17. Utilities
- A page = screen **orchestration**; extract repeated cards/tables/filters/forms/headers into components.
  Consistent spacing (`p-4`, `md:p-6`) + shadcn primitives. Pattern: imports → hooks/context → derived values →
  handlers → JSX → `export default`.
- Forms: typed models; prefer **react-hook-form + zod** for validation (match a feature's existing pattern if
  present); domain-accurate typed field names; extract large forms into feature components.
- **TypeScript strict** for new files; types/interfaces near usage (shared → `src/lib`); **avoid `any`**; typed
  props + return-safe helpers. Use **`cn()` from `@/lib/utils`** for className composition; shared helpers in `src/lib`.

## 18. Navigation (desktop + mobile)
- **Desktop/tablet (≥ md):** collapsible sidebar — expanded icon+label; collapsed icons + **tooltip** on hover;
  keyboard + ARIA; a **Home** item when multi-module. **Mobile (< md):** **bottom nav** — ≤5 items; if >5 →
  first 4 + a 5th **“المزيد / More”** opening a sheet (searchable when long); RTL-friendly order.
- **Home page** lists modules as cards (icon · name_ar primary · name_en secondary · description · CTA
  “الدخول / Open”), filtered to the user's role.

## 19. Visual identity — glass-morphism (proposed DEFAULT; confirm with the user)
- Modern glass-morphism — frosted surfaces, soft blur, controlled transparency, rounded corners, layered depth,
  subtle inner glow + soft highlights (NO harsh shadows). Clean, futuristic, premium (MENA).
- **Base:** Light `#f1f1f1` · Dark `#141414` (both modes via CSS vars + `.dark` + toggle; panels airy in light,
  luminous in dark). **Primary:** `#fe4e18`, `#512195`, `#25d0fe`. **Accent (sparingly):** `#11bf9d`.
  **Secondary:** `#cbfe00` (highlights), `#00264c` (dark surfaces), `#49a8b3` (supporting), `#132e2c`
  (grounding). **Gradients:** `#fe4e18 → #512195`, `#512195 → #25d0fe` (softer light, deeper dark).
  **Typography:** **Zain** (ar + en, full LTR/RTL). **Avoid:** flat-only/cartoon/heavy-texture, random colors,
  dominant `#11bf9d`, poor contrast, harsh shadows, cluttered layouts. Use explicit empty / loading / error
  states (skeletons over spinners), `lucide-react` icons, toast/sonner feedback.

## 20. When generating code — checklist
1) correct domain folder · 2) `@/` imports · 3) shadcn + Tailwind · 4) ar/en + RTL/LTR · 5) respect auth/RBAC ·
6) reuse before create · 7) semantic tokens not hardcoded · 8) route pages under `src/pages` · 9) reusable logic
in hooks/components/lib · 10) don't introduce a second design system / state library / data client without
approval. Split oversized files (subcomponents, hooks, `config`/`data`/`lib`) — avoid god-files.

<!-- bildfast-ui-system:v27 -->
