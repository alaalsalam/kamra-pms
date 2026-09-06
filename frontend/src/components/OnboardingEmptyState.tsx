import { useNavigate } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import { ShieldAlert } from "lucide-react"
import { useAuth } from "../lib/auth"
import { useEnabledModules } from "../lib/modules"
import { canAccessPath } from "../lib/apps"
import { cn } from "../lib/utils"
import { Button } from "./ui/button"

type Cta = { label: string; to: string }

/**
 * Zero-data onboarding / permission-denied panel. It explains what is missing
 * and — only when the current role can actually reach the setup route — offers
 * the create-CTA; otherwise it shows guidance instead of a dead button, so a
 * front-desk user staring at an empty calendar is told an admin must add the
 * master data rather than handed a link they cannot open.
 */
export function OnboardingEmptyState(props: {
  icon?: LucideIcon
  title: string
  message: string
  /** Primary action — usually "create the prerequisite master data". Gated. */
  cta?: Cta
  /** Optional second action. Gated. */
  secondary?: Cta
  /** Shown in place of a gated CTA the current role cannot reach. */
  gatedNote?: string
  variant?: "empty" | "denied"
}) {
  const navigate = useNavigate()
  const { roles } = useAuth()
  const modules = useEnabledModules()
  const denied = props.variant === "denied"
  const Icon = props.icon ?? (denied ? ShieldAlert : undefined)
  const can = (to: string) => canAccessPath(to, roles, modules)

  const actions: Cta[] = []
  if (props.cta && can(props.cta.to)) actions.push(props.cta)
  if (props.secondary && can(props.secondary.to)) actions.push(props.secondary)
  // A create-CTA was offered but this role cannot reach it and has no usable action.
  const gated = !denied && !!props.cta && actions.length === 0

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 py-12 text-center">
      {Icon && (
        <div
          className={cn(
            "mb-3 flex size-12 items-center justify-center rounded-2xl",
            denied ? "bg-rose-50 text-rose-500" : "bg-brand-50 text-brand-600",
          )}
        >
          <Icon className="size-6" aria-hidden />
        </div>
      )}
      <h3 className="text-base font-semibold text-zinc-800">{props.title}</h3>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-zinc-500">
        {props.message}
      </p>
      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {actions.map((a, i) => (
            <Button
              key={a.to}
              variant={i === 0 ? "primary" : "outline"}
              onClick={() => navigate(a.to)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
      {gated && (
        <p className="mt-3 text-xs text-zinc-400">
          {props.gatedNote ?? "Ask a hotel administrator to set this up."}
        </p>
      )}
    </div>
  )
}
