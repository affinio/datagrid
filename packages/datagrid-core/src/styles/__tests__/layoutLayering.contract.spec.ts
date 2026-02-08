import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const layoutCss = readFileSync(new URL("../layout.css", import.meta.url), "utf8")
const effectsCss = readFileSync(new URL("../effects.css", import.meta.url), "utf8")

function readLayerValue(variable: string): number {
  const match = layoutCss.match(new RegExp(`${variable}:\\s*(\\d+)\\s*;`))
  if (!match?.[1]) {
    throw new Error(`Missing CSS variable: ${variable}`)
  }
  return Number(match[1])
}

describe("layout layering contract", () => {
  it("keeps header > pinned > overlay > hover layer order", () => {
    const hover = readLayerValue("--ui-table-layer-hover")
    const overlay = readLayerValue("--ui-table-layer-overlay")
    const pinned = readLayerValue("--ui-table-layer-pinned")
    const header = readLayerValue("--ui-table-layer-header")

    expect(hover).toBeLessThan(overlay)
    expect(overlay).toBeLessThan(pinned)
    expect(pinned).toBeLessThan(header)
  })

  it("uses the declared layer variables for key structural surfaces", () => {
    expect(layoutCss).toContain("z-index: var(--ui-table-layer-header);")
    expect(layoutCss).toContain("z-index: var(--ui-table-layer-pinned);")
    expect(layoutCss).toContain("z-index: var(--ui-table-layer-overlay);")
    expect(effectsCss).toContain("z-index: var(--ui-table-layer-hover, 30);")
  })

  it("pins surface backgrounds to mask overlay content underneath", () => {
    expect(layoutCss).toContain(".ui-table__pinned-left {")
    expect(layoutCss).toContain(".ui-table__pinned-right {")
    expect(layoutCss).toContain("--ui-table-pinned-left-bg")
    expect(layoutCss).toContain("--ui-table-pinned-right-bg")
  })
})
