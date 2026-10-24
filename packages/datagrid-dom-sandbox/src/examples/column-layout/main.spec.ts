import { afterEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { mountColumnLayoutDemo } from "./main"

const sandboxStyles = readFileSync(resolve(process.cwd(), "src/style.css"), "utf8")

describe("column layout example", () => {
  const mounted: Array<Awaited<ReturnType<typeof mountColumnLayoutDemo>>> = []
  afterEach(async () => {
    await Promise.all(mounted.splice(0).map(demo => demo.destroy()))
  })

  it("routes visibility and pin controls through Core and reflects external API changes", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    const demo = mountColumnLayoutDemo(root)
    mounted.push(demo)
    await demo.grid.ready

    const teamVisibility = root.querySelector<HTMLInputElement>('[data-column-visibility="team"]')!
    teamVisibility.checked = false
    teamVisibility.dispatchEvent(new Event("change", { bubbles: true }))
    expect(demo.grid.api.columns.get("team")?.visible).toBe(false)
    expect(root.querySelector('[role=columnheader][data-column-index="2"]')?.textContent).toBe("Status")

    const statusPin = root.querySelector<HTMLSelectElement>('[data-column-pin="status"]')!
    statusPin.value = "right"
    statusPin.dispatchEvent(new Event("change", { bubbles: true }))
    expect(demo.grid.api.columns.get("status")?.pin).toBe("right")
    expect(Array.from(root.querySelectorAll<HTMLElement>("[role=columnheader]")).find(header => header.textContent === "Status")?.classList.contains("affino-grid-dom__cell--pinned-right")).toBe(true)

    demo.grid.api.columns.setVisibility("team", true)
    expect(teamVisibility.checked).toBe(true)
  })

  it("marks both pinned zone boundaries in the column layout example", () => {
    expect(sandboxStyles).toContain(".affino-grid-dom__cell--pinned-left:has(+ :not(.affino-grid-dom__cell--pinned-left))")
    expect(sandboxStyles).toContain(":not(.affino-grid-dom__cell--pinned-right) + .affino-grid-dom__cell--pinned-right")
    expect(sandboxStyles).toContain(".column-layout-demo__grid .affino-grid-dom__header-left")
    expect(sandboxStyles).toContain(".column-layout-demo__grid .affino-grid-dom__header-right")
  })
})
