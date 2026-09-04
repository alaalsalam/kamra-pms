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
