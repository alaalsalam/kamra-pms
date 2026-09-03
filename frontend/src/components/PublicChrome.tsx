import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { BrandLogo } from "./BrandLogo"
import UtilityControls from "./UtilityControls"
import { cn } from "../lib/utils"

export interface PublicNavLink {
  label: string
  href: string
}

/** The navy top bar shared by every public guest surface (booking, listing,
 *  self check-in, QR menu). Solid navy in both themes — no backdrop-filter.
 *  Carries the brand lockup, optional in-page anchor links, the language +
 *  theme controls, and an optional gold CTA. */
export function PublicHeader({
  links = [],
  cta,
  className,
}: {
  links?: PublicNavLink[]
  cta?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-white/10 bg-navy-900 text-white",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
        <Link to="/book" aria-label="HotelPMS" className="shrink-0">
          <BrandLogo size={30} tone="dark" />
        </Link>
        {links.length > 0 && (
          <nav className="ms-2 hidden items-center gap-5 text-sm font-medium text-navy-100 md:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="transition-colors hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>
        )}
        <div className="ms-auto flex items-center gap-3">
          <UtilityControls tone="dark" />
          {cta}
        </div>
      </div>
    </header>
  )
}

/** The navy footer shared by public surfaces. */
export function PublicFooter({ note }: { note?: ReactNode }) {
  return (
    <footer className="mt-16 bg-navy-900 text-navy-100">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-start">
          <BrandLogo size={34} tone="dark" tagline />
          <p className="max-w-md text-xs leading-relaxed text-navy-200">
            {note ?? "A refined hospitality experience — at every step."}
          </p>
        </div>
        <div className="rule-gold my-6" />
        <div className="flex flex-col items-center justify-between gap-2 text-xs text-navy-300 sm:flex-row">
          <span>© 2025 HotelPMS. All rights reserved.</span>
          <span>Hospitality Management System</span>
        </div>
      </div>
    </footer>
  )
}
