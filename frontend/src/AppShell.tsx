import { useEffect, useRef, useState } from "react"
import { Building2, ChevronDown, LayoutGrid, LogOut, Menu, Plus, SaudiRiyal, Search, X } from "lucide-react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { BookingDialog } from "./components/BookingDialog"
import { BrandLogo } from "./components/BrandLogo"
import { CommandPalette } from "./components/CommandPalette"
import HelpPanel from "./components/HelpPanel"
import UtilityControls from "./components/UtilityControls"
import { Button } from "./components/ui/button"
import {
  matchingAppForPath,
  visibleApps,
  type AppDef,
  type AppNavItem,
} from "./lib/apps"
import {
  call,
  getCurrentProperty,
  myProperties,
  setCurrentProperty,
  type PropertyRow,
} from "./lib/api"
import { useAuth } from "./lib/auth"
import { subscribeRealtime } from "./lib/realtime"
import { t as translate, useT } from "./lib/i18n"
import { loadLocale } from "./lib/money"
import { useEnabledModules } from "./lib/modules"
import { cn } from "./lib/utils"
import { useKiosk } from "./lib/kiosk"

export interface BookingInitial {
  room_type?: string
  date?: string
  guest?: string
  guest_name?: string
  phone?: string
  stays?: number
}

export interface ShellContext {
  refreshKey: number
  openBooking: (initial: BookingInitial) => void
  /** Whether this user's role may create a booking (gate booking affordances). */
  canCreateBooking: boolean
  /** Switch the active property (keeps the top-bar selector in sync). */
  switchProperty: (name: string) => void
}

function SearchShortcut() {
  const { t } = useT()
  const isMac = /Mac|iP(hone|ad|od)/.test(navigator.platform)
  const combo = isMac ? "⌘K" : "Ctrl+K"
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("hotelpms:open-palette"))}
      title={`${t("Search reservations, guests, rooms…")} — ${combo}`}
      aria-label={t("Open search")}
      className="flex min-h-10 w-full items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-[13px] text-zinc-400 shadow-sm transition hover:border-zinc-300 hover:text-zinc-600"
    >
      <Search className="size-4" aria-hidden />
      <span>{t("Search reservations, guests, rooms…")}</span>
      <kbd className="ms-auto hidden rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 md:inline" dir="ltr">
        {combo}
      </kbd>
    </button>
  )
}

/** App switcher in the top bar: quiet grid, one accent for the current app. */
function AppSwitcher({ apps, current }: { apps: AppDef[]; current?: AppDef }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener("mousedown", onDown)
    return () => window.removeEventListener("mousedown", onDown)
  }, [open])

  const go = (app: AppDef) => {
    setOpen(false)
    const first = app.items.find((i) => i.to)
    if (first?.to) navigate(first.to)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Switch app"
        title="Switch app"
        className="flex size-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
      >
        <LayoutGrid className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-50 w-64 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5">
          <div className="grid grid-cols-3 gap-0.5">
            {apps.map((app) => {
              const active = app.id === current?.id
              return (
                <button
                  key={app.id}
                  onClick={() => go(app)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-md px-1.5 py-2.5 text-center transition-colors",
                    active ? "bg-zinc-100" : "hover:bg-zinc-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-md border",
                      active
                        ? "border-brand-200 bg-brand-50 text-brand-700"
                        : "border-zinc-200 bg-white text-zinc-600",
                    )}
                  >
                    <app.icon className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-medium leading-tight",
                      active ? "text-zinc-900" : "text-zinc-600",
                    )}
                  >
                    {translate(app.name)}
                  </span>
                </button>
              )
            })}
          </div>
          <NavLink
            to="/apps"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-md px-3 py-2 text-center text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
          >
            View all apps
          </NavLink>
        </div>
      )}
    </div>
  )
}

/**
 * The permanent product rail is the first major Oasis structural layer.
 * It separates switching operational areas from navigating inside one area,
 * so a receptionist never has to parse a single, very long mixed menu.
 */
function ProductRail({ apps, current }: { apps: AppDef[]; current?: AppDef }) {
  const navigate = useNavigate()
  const { t } = useT()

  const go = (app: AppDef) => {
    const first = app.items.find((item) => item.to)
    if (first?.to) navigate(first.to)
  }

  return (
    <aside className="oasis-product-rail" aria-label={t("Apps")}>
      <button
        type="button"
        className="oasis-rail-brand"
        onClick={() => navigate("/")}
        aria-label="HotelPMS"
      >
        <BrandLogo size={38} showWordmark={false} tone="dark" />
      </button>
      <nav className="oasis-rail-apps">
        {apps.map((app) => {
          const active = app.id === current?.id
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => go(app)}
              className={cn("oasis-rail-app", active && "is-active")}
              aria-current={active ? "page" : undefined}
              aria-label={t(app.name)}
              title={t(app.name)}
            >
              <app.icon className="size-[19px]" strokeWidth={1.8} aria-hidden />
              <span>{t(app.name)}</span>
            </button>
          )
        })}
      </nav>
      <NavLink to="/apps" className="oasis-rail-all" title={t("View all apps")}>
        <LayoutGrid className="size-5" aria-hidden />
        <span>{t("All")}</span>
      </NavLink>
    </aside>
  )
}

export default function AppShell() {
  const { account, user, roles, signOut } = useAuth()
  const { t } = useT()
  const location = useLocation()
  const navigate = useNavigate()
  const [booking, setBooking] = useState<BookingInitial | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [propertiesLoaded, setPropertiesLoaded] = useState(false)
  const [property, setProperty] = useState(getCurrentProperty())
  const [demoMode, setDemoMode] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    myProperties().then((props) => {
      setProperties(props)
      if (props.length && !props.some((p) => p.name === getCurrentProperty())) {
        setCurrentProperty(props[0].name)
        setProperty(props[0].name)
      }
    }).catch(() => setProperties([])).finally(() => setPropertiesLoaded(true))
    call<{ demo_mode: boolean }>("hotelpms.public_api.site_info")
      .then((info) => setDemoMode(info.demo_mode))
      .catch(() => setDemoMode(false))
  }, [])

  const canSetUpProperty = roles.some(
    (role) => role === "System Manager" || role === "Administrator",
  )
  useEffect(() => {
    if (
      propertiesLoaded &&
      properties.length === 0 &&
      location.pathname !== "/setup" &&
      canSetUpProperty
    ) {
      // A freshly purged/new site should lead its authorized operator to
      // setup, not leave them on a dashboard backed by no property.
      navigate("/setup", { replace: true })
    }
  }, [canSetUpProperty, location.pathname, navigate, properties.length, propertiesLoaded])

  useEffect(() => subscribeRealtime(() => setRefreshKey((k) => k + 1)), [])

  useEffect(() => setMobileNavOpen(false), [location.pathname])

  // currency symbol + number locale follow the property's country pack
  useEffect(() => {
    loadLocale().then(() => setRefreshKey((k) => k + 1))
  }, [property])

  function switchProperty(name: string) {
    setCurrentProperty(name)
    setProperty(name)
  }

  // which parts of the product this property runs - undefined until it
  // answers, so nothing flashes in and then disappears
  const modules = useEnabledModules()

  const apps = visibleApps(roles, modules)
  const routeApp = matchingAppForPath(location.pathname)
  const currentApp = routeApp && apps.some((a) => a.id === routeApp.id) ? routeApp : undefined
  const floor = location.pathname === "/pos" || location.pathname === "/kitchen"
  const { on: kiosk } = useKiosk()

  const items = (currentApp?.items ?? []).filter(
    (item) => !item.roles || item.roles.some((r) => roles.includes(r)),
  )
  const canCreateBooking = [
    "Front Desk",
    "Hotel Admin",
    "System Manager",
    "Administrator",
  ].some((role) => roles.includes(role))
  const primaryRole = [
    "System Manager",
    "Hotel Admin",
    "Front Desk",
    "Revenue Manager",
    "Finance",
    "Housekeeping",
    "Restaurant POS",
    "Kitchen",
  ].find((role) => roles.includes(role))

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError(false)
    try {
      await signOut()
    } catch {
      setSignOutError(true)
      setSigningOut(false)
    }
  }

  const renderItem = (item: AppNavItem) =>
    item.href ? (
      <a
        key={item.href}
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className="oasis-context-link"
      >
        <item.icon className="size-4" aria-hidden />
        {t(item.label)}
      </a>
    ) : (
      <NavLink
        key={item.to}
        to={item.to!}
        end={item.to === "/"}
        className={({ isActive }) =>
          cn(
            "oasis-context-link",
            isActive
              ? "is-active"
              : "",
          )
        }
      >
        <item.icon className="size-4" aria-hidden />
        {t(item.label)}
      </NavLink>
    )

  return (
    <div className="oasis-shell">
      {demoMode && !kiosk && (
        <div className="bg-gold-500 px-4 py-1.5 text-center text-xs font-semibold text-[#3a2405]">
          {t("HotelPMS demo — data is restored every night.")}
          {" "}
          <a
            href="/hotelpms/book"
            className="underline underline-offset-2 hover:text-black"
          >
            HotelPMS →
          </a>
        </div>
      )}
      <div className="oasis-shell-frame">
      {!kiosk && (
      <>
      <ProductRail apps={apps} current={currentApp} />
      <aside className="oasis-context-sidebar">
        <div className="oasis-context-brand">
          <BrandLogo size={34} tagline />
        </div>

        {currentApp && (
          <div className="oasis-context-heading">
            <span
              className="oasis-context-icon"
            >
              <currentApp.icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                {t("Workspace")}
              </span>
              <span className="block truncate text-[14px] font-bold text-zinc-900">
                {t(currentApp.name)}
              </span>
            </span>
          </div>
        )}

        <nav className="oasis-context-nav" aria-label={currentApp ? t(currentApp.name) : t("Navigation")}>
          <p className="oasis-context-label">{t("Navigation")}</p>
          {items.map(renderItem)}
        </nav>

        <div className="oasis-context-footer">
          <div className="oasis-property-card">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Building2 className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-zinc-900">
                {properties.find((p) => p.name === property)?.property_name ?? t("Property")}
              </span>
              <span className="block truncate text-[10px] text-zinc-500">
                {primaryRole ? t(primaryRole) : user}
              </span>
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="grid size-9 place-items-center rounded-xl text-zinc-400 transition hover:bg-rose-50 hover:text-rose-700"
              title={t(signingOut ? "Signing out..." : "Sign out")}
              aria-label={t(signingOut ? "Signing out..." : "Sign out")}
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </aside>
      </>
      )}

      <div className="oasis-workspace">
        {!kiosk && (
        <header className="oasis-topbar">
          <div className="sm:hidden"><AppSwitcher apps={apps} current={currentApp} /></div>
          <div className="oasis-mobile-wordmark sm:hidden"><BrandLogo size={30} /></div>
          {properties.length > 1 ? (
            <label className="oasis-property-select">
              <Building2 className="size-4 text-brand-700" aria-hidden />
              <select value={property} onChange={(e) => switchProperty(e.target.value)} aria-label="Property">
                {properties.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.property_name}{p.city ? ` · ${p.city}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-3.5 text-zinc-400" aria-hidden />
            </label>
          ) : (
            <div className="oasis-property-static">
              <Building2 className="size-4 text-brand-700" aria-hidden />
              <span>{properties[0]?.property_name ?? ""}</span>
            </div>
          )}
          <div className="oasis-top-search">
            <div className="hidden w-full max-w-[460px] md:block">
              <SearchShortcut />
            </div>
          </div>
          <div className="oasis-top-actions">
            <UtilityControls tone="light" />
            {canCreateBooking && (
              <Button variant="primary" className="shadow-[0_8px_22px_rgba(14,122,108,.2)]" onClick={() => setBooking({})}>
                <Plus className="size-4" aria-hidden />
                New booking
              </Button>
            )}
          </div>
        </header>
        )}

        {signOutError && !kiosk && (
          <div role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-center text-sm text-rose-700">
            {t("Could not sign out. Your session is still active; please try again.")}
          </div>
        )}

        <main
          key={property}
          className={
            floor
              ? cn(
                  "max-w-none",
                  kiosk
                    ? "h-[100dvh] overflow-hidden p-0"
                    : "min-h-[calc(100dvh-3.5rem)] overflow-auto p-3",
                )
              : "oasis-page-canvas"
          }
        >
          <Outlet
            context={
              {
                refreshKey,
                openBooking: (initial) => setBooking(initial),
                canCreateBooking,
                switchProperty,
              } satisfies ShellContext
            }
          />
        </main>
      </div>

      {!kiosk && !floor && (
        <>
          <nav
            aria-label={t("Mobile navigation")}
            className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 gap-1 rounded-2xl border border-zinc-200 bg-white/95 p-1.5 shadow-[0_16px_40px_rgba(27,36,32,.18)] backdrop-blur-xl sm:hidden"
          >
            {items.slice(0, 4).map((item) => {
              const cls = "flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold"
              if (item.href) {
                return (
                  <a key={item.href} href={item.href} className={`${cls} text-zinc-500 hover:bg-zinc-100`}>
                    <item.icon className="size-4" aria-hidden />
                    <span className="max-w-full truncate">{t(item.label)}</span>
                  </a>
                )
              }
              return (
                <NavLink
                  key={item.to}
                  to={item.to!}
                  end={item.to === "/"}
                  className={({ isActive }) => `${cls} ${isActive ? "bg-brand-50 text-brand-800" : "text-zinc-500 hover:bg-zinc-100"}`}
                >
                  <item.icon className="size-4" aria-hidden />
                  <span className="max-w-full truncate">{t(item.label)}</span>
                </NavLink>
              )
            })}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold text-zinc-500 hover:bg-zinc-100"
              aria-expanded={mobileNavOpen}
            >
              <Menu className="size-4" aria-hidden />
              <span>{t("More")}</span>
            </button>
          </nav>

          {mobileNavOpen && (
            <div className="fixed inset-0 z-[60] sm:hidden" role="dialog" aria-modal="true" aria-label={t("More navigation")}>
              <button
                type="button"
                className="absolute inset-0 bg-black/35"
                onClick={() => setMobileNavOpen(false)}
                aria-label={t("Close")}
              />
              <div className="animate-fade-in absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-y-auto rounded-t-[1.5rem] border border-zinc-200 bg-white p-4 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-zinc-900">{currentApp ? t(currentApp.name) : t("Navigation")}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{t("Choose where you want to go")}</p>
                  </div>
                  <button type="button" onClick={() => setMobileNavOpen(false)} className="grid size-10 place-items-center rounded-xl bg-zinc-100 text-zinc-600" aria-label={t("Close")}>
                    <X className="size-5" aria-hidden />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((item) => item.href ? (
                    <a key={item.href} href={item.href} className="flex min-h-14 items-center gap-3 rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-700">
                      <item.icon className="size-5 text-brand-600" aria-hidden />
                      {t(item.label)}
                    </a>
                  ) : (
                    <NavLink key={item.to} to={item.to!} end={item.to === "/"} className={({ isActive }) => `flex min-h-14 items-center gap-3 rounded-xl border px-3 text-xs font-semibold ${isActive ? "border-brand-200 bg-brand-50 text-brand-800" : "border-zinc-200 text-zinc-700"}`}>
                      <item.icon className="size-5 text-brand-600" aria-hidden />
                      {t(item.label)}
                    </NavLink>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <Building2 className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-zinc-900">{user}</span>
                    <span className="block truncate text-[10px] text-zinc-500" dir="ltr">
                      {account}{primaryRole ? ` · ${t(primaryRole)}` : ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-bold text-zinc-700"
                  >
                    <LogOut className="size-4" aria-hidden />
                    {t(signingOut ? "Signing out..." : "Sign out")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <HelpPanel />
      <CommandPalette />

      {booking && (
        <BookingDialog
          initial={booking}
          onClose={() => setBooking(null)}
          onBooked={() => setRefreshKey((k) => k + 1)}
        />
      )}

      <span className="hidden">
        <SaudiRiyal className="size-3" aria-hidden />
      </span>
    </div>
    </div>
  )
}
