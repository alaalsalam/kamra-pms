import { useEffect, useRef, type ReactNode } from "react"

/**
 * Oasis contextual side panel (Mews "smart panel" pattern). On desktop it is a
 * 372px panel pinned below the top bar on the inline-end side, WITHOUT a scrim,
 * so the list stays visible and clickable (pick another row → panel updates). On
 * mobile it becomes a full-screen sheet with a scrim. Escape closes it and focus
 * returns to the element that opened it. The content (header + body + actions)
 * is supplied as children — this component owns positioning and accessibility.
 */
export function ContextPanel({
  onClose,
  label,
  children,
}: {
  onClose: () => void
  label?: string
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      // return focus to the invoking row/button so keyboard users aren't lost
      returnFocus.current?.focus?.()
    }
  }, [onClose])

  return (
    <>
      {/* scrim on mobile only; desktop keeps the list visible (no scrim) */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 animate-fade-in lg:hidden"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={label}
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 top-0 z-[60] flex flex-col bg-white shadow-2xl outline-none animate-sheet-in lg:inset-x-auto lg:end-0 lg:top-[60px] lg:z-40 lg:w-[372px] lg:border-s lg:border-zinc-200 lg:shadow-[0_18px_44px_rgba(27,36,32,0.16)]"
      >
        {children}
      </div>
    </>
  )
}
