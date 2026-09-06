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
        "inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-1 text-sm shadow-[0_8px_28px_-24px_rgba(27,36,32,.5)]",
        className,
      )}
    >
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 py-2 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600",
              isActive
                ? "bg-brand-800 text-white shadow-[0_7px_18px_-10px_rgba(7,59,52,.8)]"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900",
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
