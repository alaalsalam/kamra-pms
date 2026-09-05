import { cn } from "../../lib/utils"
import type { ButtonHTMLAttributes } from "react"

type Variant = "primary" | "outline" | "ghost" | "gold" | "navy"

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-[0_4px_12px_rgba(14,122,108,.24)] hover:bg-brand-700 focus-visible:outline-brand-600",
  outline:
    "border border-zinc-300 bg-white text-zinc-800 shadow-sm hover:bg-zinc-100 focus-visible:outline-brand-600",
  ghost: "text-brand-700 hover:bg-brand-50 focus-visible:outline-brand-600",
  gold: "bg-gold-500 text-[#3a2405] shadow-[0_4px_12px_rgba(232,150,62,.28)] hover:bg-gold-400 focus-visible:outline-gold-500",
  navy: "bg-navy-800 text-white hover:bg-navy-700 focus-visible:outline-navy-800",
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold",
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
