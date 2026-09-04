import { NavLink } from "react-router-dom"
import { CalendarDays, LayoutGrid, BedDouble } from "lucide-react"
import { useAuth } from "../lib/auth"
import { useEnabledModules } from "../lib/modules"
import { canAccessPath } from "../lib/apps"
import { cn } from "../lib/utils"

const TABS = [
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/tape", label: "Tape Chart", icon: LayoutGrid },
  { to: "/rooms", label: "Rooms", icon: BedDouble },
]

/** Quick switch between the availability views (Calendar / Tape / Rooms),
 *  showing only the boards this user's role + enabled modules can open. */
export function BoardNav({ className }: { className?: string }) {
  const { roles } = useAuth()
  const modules = useEnabledModules()
  const tabs = TABS.filter((t) => canAccessPath(t.to, roles, modules))
  if (tabs.length < 2) return null
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-sm",
        className,
      )}
    >
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600",
              isActive
                ? "bg-brand-600 text-white"
                : "text-zinc-600 hover:text-zinc-900",
            )
          }
        >
          <t.icon className="size-4" aria-hidden />
          {t.label}
        </NavLink>
      ))}
    </div>
  )
}
