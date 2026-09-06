/*  The HotelPMS app suite. One PMS, several apps - like a workspace suite:
    Front Desk is where the day happens; Housekeeping, Operations, Events,
    Revenue, Finance and Admin are their own rooms. The switcher in the top
    bar and the /apps launcher move between them; Search (Ctrl/Cmd+K) jumps
    anywhere and the sidebar follows.

    Every app is open and included - HotelPMS is fully open source. */

import {
  BadgePercent,
  Share2,
  Network,
  MessageCircle,
  PhoneCall,
  BedDouble,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Code2,
  ExternalLink,
  FileSpreadsheet,
  Home,
  Landmark,
  LayoutGrid,
  ListChecks,
  ListTodo,
  MapPin,
  PackageSearch,
  Plus,
  Receipt,
  ScrollText,
  Settings as SettingsIcon,
  Shirt,
  Smartphone,
  Sparkles,
  Store,
  Tags,
  Ticket,
  UserCog,
  Users,
  UtensilsCrossed,
  ConciergeBell,
  BarChart3,
  ChartLine,
  ShieldCheck,
  Globe,
  Camera,
  HelpCircle,
  Search,
  Lock,
  AlarmClock,
  LayoutDashboard,
} from "lucide-react"

/** Shared tile treatment for switcher and launcher. One quiet system, not a rainbow. */
export const APP_TILE =
  "border border-zinc-200 bg-zinc-50 text-zinc-700"

export interface AppNavItem {
  to?: string
  href?: string // external (Frappe Desk, HK mobile app) - opens a new tab
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  roles?: string[] // per-item gate on top of the app's gate
}

export interface AppDef {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  /** @deprecated kept for callers; all apps share APP_TILE */
  tint: string
  description: string
  roles: string[] // any of these roles can see the app
  items: AppNavItem[]
  /** extra route prefixes that belong to this app (detail pages etc.) */
  extraPrefixes?: string[]
}

const DESK = import.meta.env.PROD ? "" : "http://localhost:8000"

export const APPS: AppDef[] = [
  {
    id: "front-desk",
    name: "Front Desk",
    icon: Building2,
    tint: APP_TILE,
    description: "Arrivals, departures, bookings and guests - the day's work.",
    roles: ["Front Desk", "Hotel Admin", "System Manager", "Administrator"],
    items: [
      { to: "/", label: "Today", icon: Home },
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/reservations", label: "Reservations", icon: ClipboardList },
      { to: "/tape", label: "Tape Chart", icon: LayoutGrid },
      { to: "/calendar", label: "Calendar", icon: CalendarDays },
      { to: "/crs", label: "Central Reservations", icon: Search },
      { to: "/guests", label: "Guests", icon: Users },
      { to: "/room-blocks", label: "Room Blocks", icon: Lock },
      { to: "/assistant", label: "HotelPMS Assistant", icon: Sparkles },
    ],
    extraPrefixes: ["/grc", "/cancelled", "/agents"],
  },
  {
    id: "housekeeping",
    name: "Housekeeping",
    icon: ClipboardCheck,
    tint: APP_TILE,
    description: "Room status board, lost & found, and the phone app.",
    roles: ["Housekeeping", "Hotel Admin", "System Manager", "Administrator"],
    items: [
      { to: "/housekeeping", label: "Room Board", icon: ListChecks },
      { to: "/laundry", label: "Laundry", icon: Shirt },
      { to: "/lost-found", label: "Lost & Found", icon: PackageSearch },
      { href: "/hotelpms/hk", label: "Phone App", icon: Smartphone },
    ],
  },
  {
    id: "operations",
    name: "Operations",
    icon: ListTodo,
    tint: APP_TILE,
    description: "Guest requests and shift handovers.",
    roles: ["Front Desk", "Hotel Admin", "System Manager", "Administrator"],
    items: [
      { to: "/tickets", label: "Guest Requests", icon: Ticket },
      { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { to: "/channels", label: "Voice & Messaging", icon: PhoneCall,
        roles: ["Hotel Admin", "System Manager", "Administrator"] },
      { to: "/ops-sla", label: "SLA Report", icon: AlarmClock },
      { to: "/shifts", label: "Shifts", icon: Clock },
    ],
  },
  {
    id: "fnb",
    name: "F&B",
    icon: UtensilsCrossed,
    tint: APP_TILE,
    description: "Restaurant POS, kitchen display, the menu and kitchen stock.",
    roles: ["Restaurant POS", "Kitchen", "Front Desk", "Finance", "Hotel Admin", "System Manager", "Administrator"],
    items: [
      { to: "/pos", label: "Restaurant POS", icon: UtensilsCrossed,
        roles: ["Restaurant POS", "Front Desk", "Finance", "Hotel Admin", "System Manager", "Administrator"] },
      { to: "/kitchen", label: "Kitchen Display", icon: ConciergeBell,
        roles: ["Kitchen", "Restaurant POS", "Hotel Admin", "System Manager", "Administrator"] },
      { to: "/inventory", label: "Kitchen Inventory", icon: PackageSearch,
        roles: ["Finance", "Hotel Admin", "System Manager", "Administrator"] },
      // Menu & Outlets are managed via the resource layer (Finance / admin
      // DocPerm); Front Desk runs POS but doesn't edit the menu or outlets.
      { to: "/menu-items", label: "Menu", icon: ClipboardList,
        roles: ["Finance", "Hotel Admin", "System Manager", "Administrator"] },
      { to: "/outlets", label: "Outlets", icon: Store,
        roles: ["Finance", "Hotel Admin", "System Manager", "Administrator"] },
    ],
  },
  {
    id: "events",
    name: "Banquets & Groups",
    icon: CalendarRange,
    tint: APP_TILE,
    description:
      "Function prospecting, quotations and event orders - plus room blocks and pickup.",
    roles: ["Revenue Manager", "Hotel Admin", "System Manager", "Administrator"],
    items: [
      { to: "/banquet", label: "Banquets", icon: CalendarRange },
      { to: "/banquet-month", label: "Month Availability", icon: CalendarRange },
      { to: "/banquet-diary", label: "Function Diary", icon: CalendarDays },
      { to: "/banquet-registers", label: "Registers", icon: ScrollText },
      { to: "/banquet-catalogue", label: "Menus & Services", icon: UtensilsCrossed },
      { to: "/events", label: "All Functions", icon: ListChecks },
      { to: "/groups", label: "Groups", icon: Users },
      { to: "/venues", label: "Halls & Venues", icon: Landmark },
    ],
    extraPrefixes: ["/banquet"],
  },
  {
    id: "revenue",
    name: "Revenue",
    icon: BarChart3,
    tint: APP_TILE,
    description: "Rates, seasons, offers and the partners who sell you.",
    roles: ["Revenue Manager", "Hotel Admin", "System Manager", "Administrator"],
    items: [
      { to: "/revenue-reports", label: "Revenue Reports", icon: ChartLine },
      { to: "/channel-manager", label: "Channel Manager", icon: Share2 },
      { to: "/ota-mappings", label: "OTA Room Mappings", icon: Network },
      { to: "/rate-plans", label: "Rate Plans", icon: Tags },
      { to: "/seasons", label: "Seasons", icon: CalendarDays },
      { to: "/guardrails", label: "Guardrails", icon: ShieldCheck },
      { to: "/vouchers", label: "Vouchers", icon: BadgePercent },
      { to: "/meal-plans", label: "Meal Plans", icon: UtensilsCrossed },
      { to: "/travel-agents", label: "Travel Agents", icon: Briefcase },
      { to: "/companies", label: "Companies", icon: Building2 },
    ],
  },
  {
    id: "activities",
    name: "Activities",
    icon: MapPin,
    tint: APP_TILE,
    description: "Experiences and add-ons guests can book with their stay.",
    roles: ["Revenue Manager", "Hotel Admin", "System Manager", "Administrator"],
    items: [
      { to: "/experiences", label: "Experiences", icon: MapPin },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    icon: Landmark,
    tint: APP_TILE,
    description: "Folios, invoices, the night audit and reports.",
    roles: ["Finance", "Hotel Admin", "System Manager", "Administrator"],
    items: [
      { to: "/billing", label: "Billing", icon: Receipt },
      { to: "/reports", label: "Reports", icon: BarChart3 },
      { to: "/accounting-export", label: "Accounting Export", icon: FileSpreadsheet },
    ],
    extraPrefixes: ["/billing/"],
  },
  {
    id: "booking-engine",
    name: "Booking Engine",
    icon: Globe,
    tint: APP_TILE,
    description: "Manage direct booking setup, property profile, photo gallery, FAQs, and SEO rules.",
    roles: ["Revenue Manager", "Hotel Admin", "System Manager", "Administrator"],
    items: [
      { to: "/booking-settings/profile", label: "Hotel Profile", icon: Home },
      { to: "/booking-settings/amenities", label: "Amenities", icon: ClipboardList },
      { to: "/booking-settings/photos", label: "Photos", icon: Camera },
      { to: "/booking-settings/policies", label: "Policies", icon: ScrollText },
      { to: "/booking-settings/payments", label: "Payments", icon: Receipt },
      { to: "/booking-settings/faq", label: "FAQ", icon: HelpCircle },
      { to: "/booking-settings/seo", label: "SEO", icon: Search },
    ],
    extraPrefixes: ["/booking-settings"],
  },
  {
    id: "admin",
    name: "Admin",
    icon: SettingsIcon,
    tint: APP_TILE,
    description: "Property setup, inventory, users, audit and the Marketplace.",
    roles: ["Hotel Admin", "System Manager", "Administrator"],
    items: [
      { to: "/settings", label: "Settings", icon: SettingsIcon },
      { to: "/rooms", label: "Rooms", icon: BedDouble },
      { to: "/room-types", label: "Room Types", icon: LayoutGrid },
      { to: "/activity", label: "Activity Log", icon: ScrollText },
      { to: "/marketplace", label: "Marketplace", icon: Store },
      {
        to: "/developers",
        label: "Developers",
        icon: Code2,
        roles: ["System Manager", "Administrator"],
      },
      {
        to: "/setup",
        label: "New Property",
        icon: Plus,
        roles: ["System Manager", "Administrator"],
      },
      {
        href: `${DESK}/app/user`,
        label: "Manage Users",
        icon: UserCog,
        roles: ["Administrator", "System Manager"],
      },
      {
        href: `${DESK}/app/build`,
        label: "Frappe Desk",
        icon: ExternalLink,
        roles: ["Administrator", "System Manager"],
      },
    ],
  },
]

/** Tabs that are always available (not part of the backend per-property module
 * toggle). "activities" is a frontend-only grouping for booking add-ons that
 * every property offers, so it stays visible regardless of enabled_modules. */
const ALWAYS_ON_MODULES = new Set(["activities"])

/** Is this app's module active for the property? Role gating is applied
 * separately; this only reflects the per-property module toggle. */
function moduleActive(appId: string, modules?: string[]): boolean {
  return !modules?.length || ALWAYS_ON_MODULES.has(appId) || modules.includes(appId)
}

/** Which app owns a path? Longest matching item route wins; "/" only exact. */
export function appForPath(pathname: string): AppDef {
  return matchingAppForPath(pathname) ?? APPS[0]
}

/** Owning app for a real product route. Undefined means a shared route such
 * as /apps, which every authenticated user may open. */
export function matchingAppForPath(pathname: string): AppDef | undefined {
  let best: { app: AppDef; len: number } | null = null
  for (const app of APPS) {
    const prefixes = [
      ...app.items.filter((i) => i.to).map((i) => i.to!),
      ...(app.extraPrefixes ?? []),
    ]
    for (const p of prefixes) {
      const hit = p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")
      if (hit && (!best || p.length > best.len))
        best = { app, len: p.length }
    }
  }
  return best?.app
}

/** Route-level RBAC. Item-specific roles are narrower than their app gate. */
export function canAccessPath(pathname: string, roles: string[], modules?: string[]): boolean {
  // The index contains no operational data; RoleHome immediately sends each
  // persona to its own approved workspace.
  if (pathname === "/") return true
  const app = matchingAppForPath(pathname)
  if (!app) return ["/apps", "/marketplace", "/activity"].includes(pathname)
  if (!moduleActive(app.id, modules)) return false
  if (!app.roles.some((r) => roles.includes(r))) return false
  const item = app.items
    .filter((i) => i.to && (pathname === i.to || pathname.startsWith(i.to + "/")))
    .sort((a, b) => (b.to?.length ?? 0) - (a.to?.length ?? 0))[0]
  return !item?.roles || item.roles.some((r) => roles.includes(r))
}

export function firstAccessiblePath(roles: string[], modules?: string[]): string {
  const preferred: [string, string][] = [
    ["Front Desk", "/"],
    ["Revenue Manager", "/revenue-reports"],
    ["Finance", "/billing"],
    ["Housekeeping", "/housekeeping"],
    ["Restaurant POS", "/pos"],
    ["Kitchen", "/kitchen"],
  ]
  const home = preferred.find(([role, path]) => roles.includes(role) && canAccessPath(path, roles, modules))
  if (home) return home[1]
  for (const app of APPS) {
    if (!app.roles.some((r) => roles.includes(r))) continue
    if (!moduleActive(app.id, modules)) continue
    const item = app.items.find((i) => i.to && canAccessPath(i.to, roles, modules))
    if (item?.to) return item.to
  }
  return "/apps"
}

/** The apps this user can reach: their roles must allow it AND the property
 *  must actually run it. Each tab is owned by ONE operational role (Front Desk
 *  → front-desk + operations; Housekeeping → housekeeping; Finance → F&B +
 *  finance; Revenue Manager → revenue + events + booking-engine); Hotel Admin /
 *  System Manager see everything. Module gating hides tabs a property doesn't
 *  run. */
export function visibleApps(roles: string[], modules?: string[]): AppDef[] {
  return APPS.filter(
    (a) =>
      a.roles.some((r) => roles.includes(r)) &&
      moduleActive(a.id, modules),
  )
}
