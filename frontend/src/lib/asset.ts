// Resolve a static asset shipped in frontend/public against the build base.
// Dev: BASE_URL is "/", so asset("hotelpms-mark.svg") -> "/hotelpms-mark.svg".
// Prod: BASE_URL is "/assets/hotelpms/frontend/", so the same call resolves to
// "/assets/hotelpms/frontend/hotelpms-mark.svg" (where Frappe serves it).
export const asset = (path: string) =>
  import.meta.env.BASE_URL + path.replace(/^\//, "")
