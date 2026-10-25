import { expect, test } from "@playwright/test"

test("copies a selected grouped-grid column with its clipboard outline", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/vue/shell/grouped-grid")

  const header = page.locator('.grid-header-viewport .grid-cell--header[data-column-key="amount"]')
  await expect(header).toBeVisible()
  await header.click()
  await page.keyboard.press("Control+C")

  const groupAmountCell = page.locator('.grid-row.row--group .grid-cell[data-column-key="amount"]').first()
  await expect(groupAmountCell).toHaveClass(/grid-cell--clipboard-pending/)
  await expect(groupAmountCell).toHaveClass(/grid-cell--clipboard-pending-top|grid-cell--clipboard-pending-left|grid-cell--clipboard-pending-right/)
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text.length).toBeGreaterThan(0)
  expect(text.split("\n").length).toBeGreaterThan(1)
  expect(await groupAmountCell.evaluate(element => getComputedStyle(element, "::after").animationName)).toBe("grid-clipboard-ants")
})
