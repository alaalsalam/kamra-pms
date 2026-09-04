import { type ElementType } from "react"
import { useT } from "../lib/i18n"

/**
 * Render a "Arabic | English" seed string as a clean hierarchy — the current
 * language's text prominent, the other language as a smaller muted line below —
 * instead of the raw "AR | EN" both inline. Order-agnostic: the Arabic vs Latin
 * segment is detected by script (some seed fields are "EN | AR"). The muted line
 * carries `data-no-translate` so the live translator leaves the secondary
 * language be, and the language comes from `useT().lang` so the on-page EN/ع
 * toggle flips the hierarchy live. Pass `primaryOnly` for dense contexts (chips,
 * grid rows) to show just the current language.
 */
export function Bilingual({
  value,
  as: Tag = "span",
  className = "",
  secondaryClassName = "text-zinc-400",
  primaryOnly = false,
}: {
  value: string
  as?: ElementType
  className?: string
  secondaryClassName?: string
  primaryOnly?: boolean
}) {
  const { lang } = useT()
  const parts = (value || "").split("|").map((s) => s.trim()).filter(Boolean)
  const isAr = (s: string) => /[؀-ۿ]/.test(s)
  const arPart = parts.find(isAr)
  const enPart = parts.find((s) => !isAr(s))
  const both = Boolean(arPart && enPart)
  const primary = (lang === "ar" ? arPart ?? enPart : enPart ?? arPart) ?? ""
  const secondary = primaryOnly || !both ? "" : (lang === "ar" ? enPart : arPart) ?? ""
  return (
    <>
      <Tag className={className} dir="auto">
        {primary}
      </Tag>
      {secondary && (
        <span data-no-translate dir="auto" className={"block font-normal " + secondaryClassName}>
          {secondary}
        </span>
      )}
    </>
  )
}
