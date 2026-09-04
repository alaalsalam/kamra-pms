import { useEffect, useState } from "react"

import { enabledModules, getCurrentProperty } from "./api"

const cache = new Map<string, string[]>()
const inFlight = new Map<string, Promise<string[]>>()

function loadModules(property: string): Promise<string[]> {
  const saved = cache.get(property)
  if (saved) return Promise.resolve(saved)
  const pending = inFlight.get(property)
  if (pending) return pending
  const request = enabledModules(property).then((next) => {
    cache.set(property, next)
    return next
  }).finally(() => inFlight.delete(property))
  inFlight.set(property, request)
  return request
}

/** One module source for the shell, launcher, command palette and route guard.
 * This prevents a disabled tab appearing in one surface and falling back to
 * another tab's sidebar after it is clicked. */
export function useEnabledModules(): string[] | undefined {
  const [property, setProperty] = useState(getCurrentProperty())
  const [modules, setModules] = useState<string[] | undefined>(() => cache.get(property))

  useEffect(() => {
    const changed = (event: Event) => {
      const next = (event as CustomEvent<string>).detail || getCurrentProperty()
      setProperty(next)
    }
    window.addEventListener("hotelpms:property-changed", changed)
    return () => window.removeEventListener("hotelpms:property-changed", changed)
  }, [])

  useEffect(() => {
    let cancelled = false
    setModules(cache.get(property))
    loadModules(property)
      .then((next) => {
        if (!cancelled) setModules(next)
      })
      .catch(() => {
        // Backend APIs remain the enforcement layer. If module preferences are
        // temporarily unavailable, fall back to all role-authorized modules
        // rather than trapping the entire application on its splash screen.
        if (!cancelled) setModules([])
      })
    return () => {
      cancelled = true
    }
  }, [property])

  return modules
}
