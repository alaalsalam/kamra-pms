import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router-dom"

import { clearCurrentProperty, isNetworkError, logout, whoami } from "./api"
import { clearEnabledModulesCache } from "./modules"

// Single source of auth truth for the app. Any component reads it via useAuth();
// route guards (RequireAuth) redirect based on it, so the URL always reflects
// the real auth state.
type Status = "loading" | "anon" | "authed"

interface AuthValue {
  status: Status
  /** Stable Frappe user id/email; use this to bind component state to a session. */
  account: string | null
  user: string | null
  roles: string[]
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthCtx = createContext<AuthValue | null>(null)
const AUTH_SYNC_KEY = "hotelpms:auth-sync"

/** Notify other tabs that the shared Frappe session cookie changed. */
export function announceAuthChanged() {
  try {
    localStorage.setItem(
      AUTH_SYNC_KEY,
      `${Date.now()}:${Math.random().toString(36).slice(2)}`,
    )
  } catch {
    // Storage can be unavailable in private mode. Focus/pageshow checks remain.
  }
}

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx)
  if (!v) throw new Error("useAuth must be used within <AuthProvider>")
  return v
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading")
  const [account, setAccount] = useState<string | null>(null)
  const [user, setUser] = useState<string | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const navigate = useNavigate()
  const statusRef = useRef<Status>("loading")
  const accountRef = useRef<string | null>(null)
  const refreshSequence = useRef(0)
  statusRef.current = status
  accountRef.current = account

  const clearIdentityState = useCallback(() => {
    clearCurrentProperty()
    clearEnabledModulesCache()
  }, [])

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current
    try {
      const w = await whoami()
      if (sequence !== refreshSequence.current) return
      if (w.user === "Guest") {
        // the session really ended (not a network problem) - leave a note
        // for the login screen when it happened mid-work
        if (statusRef.current === "authed")
          sessionStorage.setItem("hotelpms_session_ended", "1")
        setStatus("anon")
        setAccount(null)
        setUser(null)
        setRoles([])
      } else {
        // A tab can survive logout/login performed elsewhere (or be restored
        // from the browser back-forward cache). Purge identity-adjacent state
        // and remount the shell before adopting the new principal.
        if (accountRef.current && accountRef.current !== w.user)
          clearIdentityState()
        setStatus("authed")
        setAccount(w.user)
        setUser(w.full_name || w.user)
        setRoles(w.roles)
      }
    } catch (e) {
      // an unreachable server is NOT a sign-out: keep the session and let
      // the connection banner + screen polling recover on their own
      if (isNetworkError(e)) {
        if (statusRef.current === "loading") setTimeout(refresh, 4000)
        return
      }
      if (statusRef.current === "authed")
        sessionStorage.setItem("hotelpms_session_ended", "1")
      setStatus("anon")
      setAccount(null)
      setUser(null)
      setRoles([])
    }
  }, [clearIdentityState])

  useEffect(() => {
    refresh()
  }, [refresh])

  // The session cookie is shared by every tab. Revalidate whenever another
  // tab announces login/logout, a BFCache page is restored, or this tab comes
  // back to the foreground. This prevents a live new session from being
  // paired with navigation and screen state belonging to the previous user.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_SYNC_KEY) void refresh()
    }
    const onPageShow = () => void refresh()
    const onFocus = () => void refresh()
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("pageshow", onPageShow)
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("pageshow", onPageShow)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [refresh])

  // A stale/expired session surfaces as a 401/403 on some background call. The
  // api layer emits this event; we re-check and, if the session is really gone,
  // drop to anon so RequireAuth redirects to /login instead of leaving a dead
  // screen showing a 403.
  useEffect(() => {
    const onAuthError = () => {
      // only meaningful once we're past the initial load
      if (status !== "loading") refresh()
    }
    window.addEventListener("hotelpms:auth-error", onAuthError)
    return () => window.removeEventListener("hotelpms:auth-error", onAuthError)
  }, [refresh, status])

  const signOut = useCallback(async () => {
    // Never paint a fake logout.  The old implementation swallowed a failed
    // POST and left the server cookie alive, so the next demo persona could
    // inherit the previous user's roles.
    await logout()
    const probe = await whoami()
    if (probe.user !== "Guest") throw new Error("The server session is still active.")
    clearIdentityState()
    sessionStorage.removeItem("hotelpms_session_ended")
    setStatus("anon")
    setAccount(null)
    setUser(null)
    setRoles([])
    announceAuthChanged()
    if (import.meta.env.PROD) window.location.replace("/hotelpms/login")
    else navigate("/login", { replace: true })
  }, [clearIdentityState, navigate])

  return (
    <AuthCtx.Provider value={{ status, account, user, roles, refresh, signOut }}>
      {children}
    </AuthCtx.Provider>
  )
}
