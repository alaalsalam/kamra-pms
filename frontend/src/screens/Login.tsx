import { useEffect, useState } from "react"
import { ArrowRight, BadgeCheck, BedDouble, ChartNoAxesCombined, UtensilsCrossed } from "lucide-react"

import { login } from "../lib/api"
import { BrandLogo } from "../components/BrandLogo"
import { Button } from "../components/ui/button"
import UtilityControls from "../components/UtilityControls"
import { getSiteInfo } from "../lib/siteInfo"
import { useT } from "../lib/i18n"

const inputCls =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm " +
  "text-zinc-900 placeholder:text-zinc-400 " +
  "transition focus:border-gold-500 focus:outline-none focus:ring-4 focus:ring-gold-500/10"

const DEMO_ACCOUNTS = [
  { label: "System Admin", usr: "admin@hotelpms.local", pwd: "HotelPMSAdmin1!" },
  { label: "Hotel Admin (GM)", usr: "gm@hotelpms.local", pwd: "HotelPMSGM1!" },
  { label: "Front Desk", usr: "frontdesk@hotelpms.local", pwd: "HotelPMSDesk1!" },
  { label: "Revenue", usr: "revenue@hotelpms.local", pwd: "HotelPMSRevenue1!" },
  { label: "Finance", usr: "finance@hotelpms.local", pwd: "HotelPMSFinance1!" },
  { label: "Housekeeping", usr: "housekeeping@hotelpms.local", pwd: "HotelPMSHousekeeping1!" },
  { label: "Restaurant POS", usr: "pos@hotelpms.local", pwd: "HotelPMSPOS1!" },
  { label: "Kitchen Display", usr: "kitchen@hotelpms.local", pwd: "HotelPMSKitchen1!" },
]

export default function Login(props: { onSuccess: () => void }) {
  const { t } = useT()
  const [usr, setUsr] = useState("")
  const [pwd, setPwd] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Demo accounts only exist on the seeded demo site; hide them elsewhere.
  const [demoMode, setDemoMode] = useState(false)
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    getSiteInfo().then((info) => {
      setDemoMode(Boolean(info.demo_mode))
      setVersion(info.version ?? null)
    })
  }, [])

  async function submit(u = usr, p = pwd) {
    setBusy(true)
    setError(null)
    try {
      await login(u, p)
      // Navigation + the production CSRF re-boot are handled by the /login
      // route (LoginPage.onSuccess).
      sessionStorage.removeItem("hotelpms_session_ended")
      props.onSuccess()
    } catch {
      setError(t("Wrong email, username, or password."))
    } finally {
      setBusy(false)
    }
  }

  const sessionEnded = sessionStorage.getItem("hotelpms_session_ended") === "1"

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#f6f4ef] px-4 py-8 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden
        style={{
          background:
            "radial-gradient(56rem 34rem at 8% 0%, rgba(201,162,75,.16), transparent 64%), radial-gradient(60rem 42rem at 100% 100%, rgba(8,43,92,.12), transparent 62%)",
        }}
      />
      <div className="fixed inset-x-0 top-0 z-20 h-1 bg-gradient-to-r from-navy-900 via-gold-500 to-navy-900" aria-hidden />

      <div className="fixed end-4 top-4 z-30 sm:end-6 sm:top-5">
        <UtilityControls tone="light" />
      </div>

      <div className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_32px_90px_rgba(8,43,92,.18)] lg:grid-cols-[1.05fr_.95fr]">
        <aside className="relative hidden min-h-[720px] flex-col justify-between overflow-hidden bg-navy-950 p-10 text-white lg:flex xl:p-14">
          <div className="absolute -end-24 -top-28 h-80 w-80 rounded-full border border-gold-400/20" aria-hidden />
          <div className="absolute -end-8 -top-12 h-56 w-56 rounded-full border border-gold-400/20" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/20 to-transparent" aria-hidden />

          <BrandLogo size={46} tone="dark" tagline />

          <div className="relative max-w-lg">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold-300/25 bg-gold-300/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-gold-200">
              <BadgeCheck size={15} />
              {t("Built for Saudi hospitality")}
            </span>
            <h1 className="text-4xl font-semibold leading-[1.2] tracking-tight xl:text-5xl">
              {t("One platform. Every guest moment.")}
            </h1>
            <p className="mt-5 max-w-md text-base leading-8 text-navy-100">
              {t("Run reservations, rooms, restaurant operations and revenue from one secure bilingual workspace.")}
            </p>

            <div className="mt-9 grid grid-cols-3 gap-3">
              {[
                [BedDouble, "Front desk"],
                [UtensilsCrossed, "Restaurant POS"],
                [ChartNoAxesCombined, "Revenue"],
              ].map(([Icon, label]) => (
                <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[.06] p-4 backdrop-blur-sm">
                  <Icon className="mb-3 text-gold-300" size={22} />
                  <span className="text-xs font-medium text-navy-100">{t(String(label))}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-between border-t border-white/10 pt-6 text-xs text-navy-200">
            <span>{t("Arabic + English")}</span>
            <span>{t("SAR · 15% VAT ready")}</span>
            <span>{t("Role-based access")}</span>
          </div>
        </aside>

        <main className="flex min-h-[680px] items-center px-5 py-16 sm:px-10 lg:min-h-[720px] lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-9 lg:hidden">
              <BrandLogo size={44} tagline tone="light" />
            </div>

            <div className="mb-7">
              <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-700">{t("Secure staff access")}</p>
              <h2 className="text-3xl font-semibold tracking-tight text-navy-950">{t("Welcome back")}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{t("Sign in to continue to your hotel workspace.")}</p>
            </div>

            {sessionEnded && (
              <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {t("Your session ended. Sign in to pick up where you left off.")}
              </p>
            )}

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">{t("Email or username")}</span>
                <input className={inputCls} type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={usr} onChange={(e) => setUsr(e.target.value)} placeholder={t("name@hotel.com")} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-zinc-700">{t("Password")}</span>
                <input className={inputCls} type="password" autoComplete="current-password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" />
              </label>

              {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

              <Button variant="navy" className="group w-full justify-center rounded-xl py-3 shadow-lg shadow-navy-900/15" disabled={busy || !usr || !pwd} type="submit">
                {busy ? t("Signing in...") : t("Sign in")}
                {!busy && <ArrowRight size={16} className="ms-1 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />}
              </Button>
            </form>

            {demoMode && (
              <section className="mt-7 border-t border-zinc-100 pt-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-navy-950">{t("Explore the live demo")}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{t("Choose a role to open its dedicated workspace")}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{t("DEMO")}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map((a) => (
                    <button key={a.usr} type="button" disabled={busy} onClick={() => submit(a.usr, a.pwd)} className="group rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2.5 text-start transition hover:border-gold-400 hover:bg-gold-50/40 disabled:opacity-60">
                      <span className="block text-xs font-semibold text-zinc-800 group-hover:text-navy-900">{t(a.label)}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-zinc-400" dir="ltr">{a.usr}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-7 flex items-center justify-between text-[11px] text-zinc-400">
              <span>{t("Protected by role-based access")}</span>
              {version && <span>HotelPMS · v{version}</span>}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
