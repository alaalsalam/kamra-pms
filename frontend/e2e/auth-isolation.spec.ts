import { expect, test } from "playwright/test"

const base = process.env.HOTELPMS_E2E_BASE_URL ?? "https://hotelpms.yemenfrappe.com"

async function identity(page: import("playwright/test").Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/method/hotelpms.api.whoami", {
      credentials: "include",
    })
    return (await response.json()).message as { user: string; roles: string[] }
  })
}

test("demo personas do not share sessions, routes or navigation", async ({ page }) => {
  await page.goto(`${base}/hotelpms/login`)
  await page.getByText("finance@hotelpms.local", { exact: true }).click()
  await expect(page).toHaveURL(/\/hotelpms\/billing$/)

  const finance = await identity(page)
  expect(finance.user).toBe("finance@hotelpms.local")
  expect(finance.roles).toContain("Finance")
  expect(finance.roles).not.toContain("Restaurant POS")
  await expect(page.locator('a[href="/hotelpms/reservations"]')).toHaveCount(0)
  await expect(page.getByRole("button", { name: /حجز جديد|New booking/ })).toHaveCount(0)

  await page.getByRole("button", { name: /تسجيل الخروج|Sign out/ }).click()
  await expect(page).toHaveURL(/\/hotelpms\/login$/)
  expect((await identity(page)).user).toBe("Guest")

  await page.getByText("pos@hotelpms.local", { exact: true }).click()
  await expect(page).toHaveURL(/\/hotelpms\/pos$/)
  const pos = await identity(page)
  expect(pos.user).toBe("pos@hotelpms.local")
  expect(pos.roles).toContain("Restaurant POS")
  expect(pos.roles).not.toContain("Finance")
  await expect(page.locator('a[href="/hotelpms/billing"]')).toHaveCount(0)

  await page.goto(`${base}/hotelpms/billing`)
  await expect(page).toHaveURL(/\/hotelpms\/pos$/)

  await page.goto(`${base}/hotelpms/apps`)
  await expect(page.locator("aside nav a")).toHaveCount(0)
})

test("an already-open tab adopts logout and the next persona", async ({ page, context }) => {
  await page.goto(`${base}/hotelpms/login`)
  await page.getByText("finance@hotelpms.local", { exact: true }).click()
  await expect(page).toHaveURL(/\/hotelpms\/billing$/)

  const oldTab = await context.newPage()
  await oldTab.goto(`${base}/hotelpms/billing`)
  await expect(oldTab).toHaveURL(/\/hotelpms\/billing$/)
  expect((await identity(oldTab)).user).toBe("finance@hotelpms.local")

  await page.getByRole("button", { name: /تسجيل الخروج|Sign out/ }).click()
  await expect(page).toHaveURL(/\/hotelpms\/login$/)
  // Storage-event synchronization removes the old Finance shell without the
  // user refreshing the second tab manually.
  await expect(oldTab).toHaveURL(/\/hotelpms\/login$/)
  expect((await identity(oldTab)).user).toBe("Guest")

  await page.getByText("pos@hotelpms.local", { exact: true }).click()
  await expect(page).toHaveURL(/\/hotelpms\/pos$/)
  // The old tab is rebound to the new principal and its remembered Finance
  // route is rejected by RBAC; no previous-user navigation survives.
  await expect(oldTab).toHaveURL(/\/hotelpms\/pos$/)
  expect((await identity(oldTab)).user).toBe("pos@hotelpms.local")
  await expect(oldTab.locator('a[href="/hotelpms/billing"]')).toHaveCount(0)
})

test("every advertised demo account opens its own real role home", async ({ page }) => {
  const personas = [
    ["admin@hotelpms.local", /\/hotelpms(?:\/|\/setup)?$/, "Hotel Admin"],
    ["gm@hotelpms.local", /\/hotelpms\/?$/, "Hotel Admin"],
    ["frontdesk@hotelpms.local", /\/hotelpms\/?$/, "Front Desk"],
    ["revenue@hotelpms.local", /\/hotelpms\/revenue-reports$/, "Revenue Manager"],
    ["finance@hotelpms.local", /\/hotelpms\/billing$/, "Finance"],
    ["housekeeping@hotelpms.local", /\/hotelpms\/housekeeping$/, "Housekeeping"],
    ["pos@hotelpms.local", /\/hotelpms\/pos$/, "Restaurant POS"],
    ["kitchen@hotelpms.local", /\/hotelpms\/kitchen$/, "Kitchen"],
  ] as const

  await page.goto(`${base}/hotelpms/login`)
  for (const [email, home, role] of personas) {
    await page.getByText(email, { exact: true }).click()
    await expect(page).toHaveURL(home)
    const current = await identity(page)
    expect(current.user).toBe(email)
    expect(current.roles).toContain(role)

    await page.getByRole("button", { name: /تسجيل الخروج|Sign out/ }).click()
    await expect(page).toHaveURL(/\/hotelpms\/login$/)
    expect((await identity(page)).user).toBe("Guest")
  }
})
