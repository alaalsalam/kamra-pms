import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "@fontsource-variable/alexandria/wght.css"
import "./index.css"
import App from "./App"
import { initTheme } from "./lib/theme"
import { initLang } from "./lib/dir"
import { initI18n } from "./lib/i18n"
import { asset } from "./lib/asset"
import { BRAND_LOGO_URL } from "./lib/brand"
import { AuthProvider } from "./lib/auth"
import { CashierAuthProvider } from "./lib/cashierAuth"
import { ROUTER_BASENAME } from "./lib/routing"

initTheme()
initLang()
initI18n()

// Favicons, base-aware (see index.html note).
function setIcon(rel: string, href: string, type?: string) {
  const link = document.createElement("link")
  link.rel = rel
  link.href = href.startsWith("/") ? href : asset(href)
  if (type) link.type = type
  document.head.appendChild(link)
}
setIcon("icon", BRAND_LOGO_URL, "image/svg+xml")
setIcon("apple-touch-icon", BRAND_LOGO_URL, "image/svg+xml")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={ROUTER_BASENAME}>
      <AuthProvider>
        <CashierAuthProvider>
          <App />
        </CashierAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
