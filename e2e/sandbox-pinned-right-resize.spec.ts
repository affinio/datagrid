import { expect, test } from "@playwright/test"

test("leading pinned-right column resizes from its left edge", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/vue/shell/base-grid?pinnedProfile=wide-pinned")

  const header = page.locator(".grid-header-pane--right .grid-cell--header[data-column-key]").first()
  const handle = header.locator(".col-resize")
  const secondHeader = page.locator(".grid-header-pane--right .grid-cell--header[data-column-key]").nth(1)
  await expect(header).toBeVisible()
  await expect(handle).toHaveClass(/col-resize--left/)
  await expect(secondHeader.locator(".col-resize")).not.toHaveClass(/col-resize--left/)

  const before = (await header.boundingBox())!
  const handleBox = (await handle.boundingBox())!
  expect(Math.abs(handleBox.x - before.x)).toBeLessThan(1)

  const pointerStart = { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 }
  await page.mouse.move(pointerStart.x, pointerStart.y)
  await page.mouse.down()
  await page.mouse.move(pointerStart.x - 36, pointerStart.y, { steps: 4 })
  await expect.poll(async () => (await header.boundingBox())!.width).toBeGreaterThan(before.width + 25)
  await page.mouse.up()

  const after = (await header.boundingBox())!
  expect(after.x + after.width).toBeCloseTo(before.x + before.width, 0)
})
