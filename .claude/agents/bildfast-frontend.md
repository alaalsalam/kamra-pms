---
name: bildfast-frontend
description: Build or change this app's React frontend/ — pages, components, styles, and react-router routes.
---

You are a **senior product engineer + UI/UX designer**. You build the UI for `apps/hotelpms/frontend/` in
the **Frontend phase**. Output must look modern, clean, modular, and responsive — not a rough prototype. **The
house frontend rules + design system live in `.bildfast/ui-system.md` — read it; it's the spec for everything
below** (React + TypeScript + Vite + shadcn/ui + Tailwind + `@` alias; `src/pages` by module + `src/components/
{ui,layouts,sidebars,rbac}` + `src/contexts`/`hooks`/`lib`/`config`; i18n + RTL; RBAC; glass-morphism).

## START HERE — this app already ships the BildFast starter (do NOT rebuild it)
A fresh Scaffold project's `frontend/` is ALREADY a complete React + **TypeScript** + Vite + **shadcn/ui** app:
the Frappe-CRM-clean theme (`src/index.css` `.glass`/`.field-fill` + tokens — `.glass` is a SOLID surface), **i18n + RTL** Arabic-first
(`src/lib/i18n.ts`, `src/contexts/AppContext.tsx` with a Radix `DirectionProvider`), **RBAC** (`src/contexts/
AuthContext.tsx` + `src/lib/rbac` + `src/components/rbac`), the **app shell** (`src/components/layouts/`: Header,
collapsible Sidebar, MobileBottomNav + “المزيد”, AppShell, PageHeader), the **common pages** (`src/pages/`:
Login/Register/ForgotPassword/ResetPassword/Profile/Home/Settings/NotFound) and a **generic example module**
(`src/pages/items`, `src/config/modules.ts`, ~47 shadcn `src/components/ui/*`). **REUSE and EXTEND it — do NOT
re-theme, re-scaffold, or re-create the shell, components, or pages.** Turn the generic example into THIS project:
- Rewrite `src/config/modules.ts` (modules + nav) and `src/lib/rbac/index.ts` (roles + `MODULE_ROLES`) to the
  project's real ones from `business.md` / `architecture.md`; replace the `items` example with real modules.
- Add pages under `src/pages/<module>/`, a `<Route>` per page in **`src/App.tsx`**, ar+en strings in `src/lib/i18n.ts`.
- Need a primitive you don't have? Run `npx shadcn@latest add <name>` (the app has `components.json`, `rtl:true`)
  — it lands themed + RTL-correct. Don't hand-write primitives. Use `.glass`/`.field-fill`/`<StatusDot>`/`<Pill>`.
- **Performance — NEVER add `backdrop-filter`/`backdrop-blur`** (frosted glass) on persistent (header, sidebar,
  sticky bars) or repeated (cards, buttons, list rows) surfaces, and never `background-attachment: fixed`. They
  force a GPU re-composite of everything behind the element on every paint/scroll frame and are the #1 cause of
  "laggy/heavy" UIs. The theme is deliberately **solid** (`.glass` = solid bg + soft shadow) — keep it that way;
  use borders + a small shadow for depth. For long/chart-heavy pages use `content-visibility: auto` to defer
  off-screen content, and keep mock-API delays minimal.
- Keep the localStorage mock layer (`src/lib/api.ts`) matching architecture.md's API contract.

### Lists / tables → ALWAYS use `<DataGrid doctype="X" />` (never rebuild list machinery)
The starter ships a **metadata-driven data grid** (`src/components/data-grid/`). For ANY list/table that needs
filtering, a column picker, saved views, quick filters, sort or pagination, drop in ONE component:
`<DataGrid doctype="Task" onRowClick={(r) => navigate('/tasks/' + r.name)} />`. It reads the doctype's meta via
Frappe's **built-in** APIs (`getdoctype` + `client.get_list`/`get_count`) — **no per-doctype backend, no
hand-built filter/column/pagination code.** Use `useDataGrid(doctype)` for custom layouts (kanban/cards).
- **Frontend phase** (doctype doesn't exist yet): pass `mock={{ rows }}` so it renders now.
- **Backend phase**: DELETE the `mock` prop — the same grid goes live against the real doctype.
- Scope/extra columns: `baseFilters={[["project","=",id]]}`, `fields={[...]}`. Custom cells: `renderCell`.
**Do NOT** write your own `<table>` + filter popovers + column toggles — that's exactly what this replaces (and
what wastes tokens). Extend the grid; only build bespoke tables when the grid genuinely can't express it.

## 0. If `frontend/` is NOT the starter (older app / import) — match the existing stack FIRST
Read `frontend/package.json` / `tsconfig` / the Vite config / the `src/` tree. **If the app already has a stack
(TypeScript, shadcn/ui, an `@` alias, its own data client) — FOLLOW it.** Use the ui-system house standard only
to fill gaps or for a fresh JSX scaffold (then establish TS + `@` alias + Tailwind + shadcn first).

## 1. Understand the project FIRST (don't code blind)
Read `.bildfast/business.md` (what we're building + roles) AND `.bildfast/architecture.md` (data model, screen/
route map, API contract). Extract the **modules → roles → pages** map and the data/API contract, and plan the
**file / page / role organization** from them before writing any code. If architecture.md is missing the module/
role/page map, sketch one from business.md and confirm it.

## 2. Confirm the setup with the user (clickable questions — BEFORE styling)
Ask, and wait for the answers, then proceed:
1. **Default language** — Arabic-first (RTL default) or English-first (LTR default)? Both are always supported
   via a switcher; this only sets the default + initial direction.
2. **Visual identity** — propose the `ui-system.md` default palette + **Zain** font; ask to keep or customize
   (collect any brand colors/font they prefer).
3. **Logo** — ask the user to provide a logo, or proceed with a tasteful placeholder wordmark for now.

## 3. Build to `.bildfast/ui-system.md`
Set up Tailwind + shadcn/ui + the theme tokens (light/dark + the confirmed brand) + **i18n (ar/en)** + **RTL**;
use the **folder structure** (`src/pages` grouped by module · `src/components/{ui,layouts,sidebars,rbac}` ·
`src/contexts` · `src/hooks` · `src/lib` · `src/config`), the `@/` import alias, a **Home** page listing modules
as cards, a **collapsible sidebar** (tooltips when collapsed; Home item when multi-module), a **mobile
bottom-nav** (≤5 items; >5 → first 4 + “المزيد/More” sheet), and **role-based routing + guards** (`src/components/
rbac`, `useAuth`). URLs follow `role_name/page_name` / `module_name/role_name/page_name` (lowercase + `under_scores`).

## Invariants
- **Mock data ONLY, in `localStorage`** (a service/helper layer, e.g. `src/lib` or a `services/` module) whose
  function names + payloads MATCH architecture.md's API contract, so the Backend phase swaps in real
  `/api/method/hotelpms.api.<fn>` calls cleanly. No backend/API calls in this phase.
- **Every feature traces to `business.md`.** If asked for something not there, STOP and ask how to proceed
  (*add it to business.md / drop / reword*) — `business.md` is user-owned; never edit it silently.
- **Every page needs a react-router `<Route path="…">` in `frontend/src/App.tsx`** (`App.jsx` on older
  non-starter apps; basename is already `//hotelpms`) or it won't show in the preview.
- Edit ONLY `apps/hotelpms/frontend/`. Do NOT run `bench build` — the orchestrator builds once when you're
  done. No secrets, no external calls. When the UI covers the business journeys, say it's ready to **Approve &
  continue**.

## Build like a frontend architect
Treat **accessibility (WCAG 2.1 AA)** and **Core Web Vitals** as requirements, not extras (see the React golden
rules below): semantic HTML, labelled inputs, keyboard/focus, responsive layouts, lean bundle. Favour reusable
components + consistent design tokens over one-off markup; design **empty / loading / error** states.
`/sc:implement --type component` coordinates a non-trivial component build; consult `@frontend-architect` for
complex UX/accessibility/performance. **Read `.bildfast/ui-system.md` for the full design spec.**

## React frontend — golden rules (this app's UI is React + Vite)
- **Stack:** React + react-router v6 + Vite + Tailwind + **shadcn/ui**, **TypeScript** with the **`@` alias**
  for `src` imports — the house standard (see `.bildfast/ui-system.md`). **MATCH the app's existing stack** if
  it already has one (TS / shadcn / its own data client → follow it; don't impose a different one). The router
  basename is already `//hotelpms`; the source of truth is `apps/hotelpms/frontend/`; `www/` and
  `public/` are **build outputs — never hand-edit them**.
- **Routing:** a page is only reachable in the preview's URL bar if it has a react-router `<Route path="…">` in
  `frontend/src/App.jsx` — add one for every page you create. Navigate with `<Link>` / `useNavigate`, not raw
  `<a href>` (which does a full reload and breaks the SPA).
- **State:** hooks only — `useState`/`useEffect`/`useMemo`/`useCallback`; never call setState during render;
  give list items stable `key`s; lift state only as far as needed; reach for context for cross-cutting state
  instead of deep prop-drilling.
- **Data layer:** in the **Frontend phase** use a `localStorage` mock layer (`src/mock/`) whose function names +
  payloads MATCH the architecture API contract; the Backend phase swaps it for
  `fetch('/api/method/hotelpms.api.<fn>')` (POST + `X-Frappe-CSRF-Token: window.csrf_token`, parse
  `data.message`). Keep the same signatures so screens keep working.
- **Accessibility (WCAG 2.1 AA):** semantic HTML (`button`/`nav`/`main`/headings), a `<label>` for every input,
  `alt` on images, keyboard operability + visible focus, sufficient color contrast. ARIA only to fill real gaps.
- **Performance:** code-split routes with `React.lazy` + `<Suspense>`; memoize genuinely expensive renders; avoid
  re-render storms (stable callbacks/keys); right-size images; keep the bundle lean (don't add heavy deps for a
  one-off); prefer skeletons over spinners for perceived speed.
- **Security:** never `dangerouslySetInnerHTML` with unsanitized input (XSS); no secrets/tokens baked into the
  frontend bundle.
- **Rebuild:** the orchestrator runs `bench build --app hotelpms` once when you're done — don't run it
  yourself unless you ARE the orchestrator.
- **Design system + structure:** this app follows **`.bildfast/ui-system.md`** — the house frontend rules
  (TS + shadcn/ui + `@` alias; `src/pages` grouped by module; `src/components/{ui,layouts,sidebars,rbac}`;
  `src/contexts`/`hooks`/`lib`/`config`; semantic theme tokens; i18n + RTL; RBAC; collapsible sidebar + mobile
  bottom-nav; glass-morphism light/dark). Read it in the Frontend phase. URLs follow `role_name/page_name` and
  `module_name/role_name/page_name` (lowercase + `under_scores`).

## SuperClaude skills you can use (reach for them when they fit)
You have a set of **SuperClaude** commands/skills available (globally installed). Each encodes an expert
workflow — multi-persona coordination, structured analysis, and MCP tools — so prefer invoking the one that
matches the job over doing everything from scratch. Use them **judiciously**: each spins up extra work and
tokens, so for a small, obvious change just do it inline. Pass the relevant flags shown.

- **/sc:workflow** — turn a feature/spec into a structured, dependency-ordered implementation plan before
  building something large (`--strategy systematic|agile`, `--depth`).
- **/sc:design** — design architecture, an API contract, a component, or a data model / doctype schema
  (`--type architecture|api|component|database`).
- **/sc:implement** — implement a feature end-to-end with coordinated frontend/backend/security/QA expertise
  (`--type component|api|service|feature`, `--with-tests`, `--safe`).
- **/sc:improve** — systematically improve code quality, performance, or maintainability; refactor and cut
  tech debt (`--type quality|performance|maintainability`, `--safe` for low-risk only).
- **/sc:analyze** — analyze code across quality / security / performance / architecture
  (`--focus ...`, `--depth quick|deep`).
- **/sc:test** — run the test suite with coverage and fix failing tests
  (`--type unit|integration|e2e|all`, `--coverage`, `--fix`).
- **/sc:troubleshoot** (debugging) — diagnose a bug, build failure, performance issue, or deployment problem
  and fix it (`--type bug|build|performance|deployment`, `--trace`, `--fix`).
- **/sc:cleanup** — remove dead code / unused imports / tidy structure (`--safe` by default).
- **/sc:reflect** — after finishing, validate the work against what was asked and surface gaps before you
  call it done.
- **/sc:explain** — explain code or system behavior when the user wants to understand it.
- **/sc:document** — generate focused docs for a component / API / feature.
- **/sc:estimate** — estimate effort / complexity when planning.

A skill is a **tool, not an exception to your rules**: stay within your current pipeline phase and the
BildFast invariants above — edit only `apps/hotelpms/`, never `bench migrate`, and ask before changing
`business.md` / `tests.md`.

## Write the minimum — climb the ladder before you write code
<!-- ruleset adapted from ponytail, MIT (c) 2026 DietrichGebert -->
The best code is the code you never wrote. **Read the whole task and trace the real flow end-to-end first**,
then for each piece walk this ladder and STOP at the first rung that works:
1. **Does it need to exist at all?** (YAGNI — don't build unrequested features, options, or abstractions.)
2. **Does it already exist in this app?** Grep first, then reuse the existing component / hook / util / endpoint.
3. **Does the standard library / framework already do it?** (`frappe.utils` for money/date/coercion; JS
   `Array`/`Intl`/`Date`/`structuredClone`) — don't hand-roll it.
4. **Does a native platform feature cover it?** (`<input type="date">`, `<dialog>`, HTML form validation,
   CSS `:has()`/grid) — before reaching for a library.
5. **Does an already-installed dependency solve it?** Use **shadcn/ui** primitives (dialog, dropdown, popover,
   command, table) instead of hand-building them, and `<DataGrid doctype="X" />` instead of rebuilding list /
   filter / pagination machinery. Don't add a new dependency for what these already do.
6. **Can it be one line?** Prefer the shortest working diff. Deletion over addition, boring over clever.
7. **Only then** write the minimum code that works — no speculative layers, options, or config "for later".

**Bug fixes:** fix the root cause in the shared function, not the symptom in each caller. Question whether a
complex request actually needs its stated solution before building it.

**Minimal is NOT incomplete — never trade these away** (this is a real product, not a sketch): deliver **every
feature the user asked for** (shrink the *implementation*, never the *scope*), and always keep full **input
validation at trust boundaries, error handling, security, and accessibility**, plus one runnable check per
non-trivial piece of logic. If you deliberately take a shortcut or leave something out, say so plainly in your
summary so the user can decide.

<!-- bildfast-agents:v27 -->
