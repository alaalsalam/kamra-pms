import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

import { getLang, setLang, type Lang } from "../lib/dir"
import { getTheme, setTheme } from "../lib/theme"
import { cn } from "../lib/utils"

type Tone = "light" | "dark"

/** Language (segmented ع | EN) + light/dark theme, as one tidy control group.
 *  Lives in headers now instead of a floating corner pill. `tone="dark"` is for
 *  the fixed navy chrome (header/footer that stay navy in both themes). */
export default function UtilityControls({
  tone = "light",
  className,
}: {
  tone?: Tone
  className?: string
}) {
  const [lang, setLanguage] = useState<Lang>(getLang())
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  )

  useEffect(() => {
    const sync = () => setLanguage(getLang())
    window.addEventListener("hotelpms:lang", sync)
    return () => window.removeEventListener("hotelpms:lang", sync)
  }, [])

  const onDark = tone === "dark"
  const groupBorder = onDark ? "border-white/20" : "border-zinc-200"
  const segBase = onDark
    ? "text-navy-100 hover:text-white"
    : "text-zinc-500 hover:text-zinc-800"
  const segActive = onDark
    ? "bg-white/15 text-white"
    : "bg-navy-800 text-white"

  const pick = (l: Lang) => {
    if (l !== getLang()) setLang(l)
  }

  return (
    <div
      data-no-translate
      className={cn("flex items-center gap-1.5", className)}
    >
      <div
        role="group"
        aria-label="Language"
        className={cn(
          "flex items-center rounded-full border p-0.5 text-xs font-semibold",
          groupBorder,
        )}
      >
        <button
          type="button"
          data-testid="language-toggle"
          aria-pressed={lang === "ar"}
          onClick={() => pick("ar")}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            lang === "ar" ? segActive : segBase,
          )}
        >
          ع
        </button>
        <button
          type="button"
          aria-pressed={lang === "en"}
          onClick={() => pick("en")}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            lang === "en" ? segActive : segBase,
          )}
        >
          EN
        </button>
      </div>

      <button
        type="button"
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        title={
          getTheme() === "system"
            ? "Theme (following system)"
            : dark
              ? "Switch to light mode"
              : "Switch to dark mode"
        }
        onClick={() => {
          const nextDark = !dark
          setTheme(nextDark ? "dark" : "light")
          setDark(nextDark)
        }}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-full border transition-colors",
          onDark
            ? "border-white/20 text-navy-100 hover:bg-white/10 hover:text-white"
            : "border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800",
        )}
      >
        {dark ? (
          <Sun className="size-4" aria-hidden />
        ) : (
          <Moon className="size-4" aria-hidden />
        )}
      </button>
    </div>
  )
}
