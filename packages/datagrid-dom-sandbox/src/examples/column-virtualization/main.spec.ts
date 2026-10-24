import { afterEach, describe, expect, it } from "vitest"
import { mountColumnVirtualizationDemo, type ColumnVirtualizationDemoHandle } from "./main"

describe("column virtualization sandbox example", () => {
  let demo: ColumnVirtualizationDemoHandle | undefined
  let root: HTMLDivElement
  let metricDescriptors: Map<string, PropertyDescriptor | undefined>

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
    for (const [key, descriptor] of metricDescriptors ?? []) {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
      else Reflect.deleteProperty(HTMLElement.prototype, key)
    }
  })

  it("keeps a bounded column window and reveals distant columns through Core", async () => {
    root = document.createElement("div")
    document.body.append(root)
    metricDescriptors = installGridMetrics()
    demo = mountColumnVirtualizationDemo(root)
    await demo.grid.ready

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    expect(grid.getAttribute("aria-colcount")).toBe("120")
    expect(root.querySelectorAll(".affino-grid-dom__header [role=columnheader]").length).toBeLessThan(30)
    expect(root.querySelector('[role=columnheader][data-column-index="0"]')).not.toBeNull()
    expect(root.querySelector('[role=columnheader][data-column-index="119"]')).not.toBeNull()
    expect(root.querySelectorAll(".affino-grid-dom__column-spacer").length).toBeGreaterThan(0)
    expect(readColumnTrackWidth(grid)).toBe(18_000)

    demo.grid.api.view.scrollToColumn({ columnIndex: 90, columnKey: "field-90" })
    await new Promise(resolve => setTimeout(resolve, 40))

    const headers = Array.from(root.querySelectorAll<HTMLElement>(".affino-grid-dom__header [role=columnheader]"))
    const renderedIndices = headers.map(cell => Number(cell.dataset.columnIndex))
    expect(renderedIndices).toContain(90)
    expect(renderedIndices).toContain(0)
    expect(renderedIndices).toContain(119)
    expect(headers.length).toBeLessThan(30)
    expect(readColumnTrackWidth(grid)).toBe(18_000)

    const lastCenterColumn = Math.max(...renderedIndices.filter(index => index !== 0 && index !== 119))
    root.querySelector<HTMLElement>(`[data-row-index="0"][data-column-index="${lastCenterColumn}"]`)?.click()
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }))
    await new Promise(resolve => setTimeout(resolve, 40))
    expect(demo.grid.api.selection.getSnapshot()?.activeCell).toMatchObject({ colIndex: lastCenterColumn + 1 })
    expect(root.querySelector(`[data-row-index="0"][data-column-index="${lastCenterColumn + 1}"]`)).not.toBeNull()
  })

  it("keeps live DOM node counts bounded while the column window moves", async () => {
    root = document.createElement("div")
    document.body.append(root)
    metricDescriptors = installGridMetrics()
    demo = mountColumnVirtualizationDemo(root)
    await demo.grid.ready

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    expect(grid.classList.contains("affino-grid-dom--column-virtualization-demo")).toBe(true)
    const nodeCounts: number[] = []
    for (let pass = 0; pass < 3; pass += 1) {
      for (let columnIndex = 12; columnIndex < 120; columnIndex += 12) {
        demo.grid.api.view.scrollToColumn({ columnIndex, columnKey: `field-${columnIndex}` })
        await new Promise(resolve => setTimeout(resolve, 24))
        nodeCounts.push(grid.querySelectorAll("*").length + 1)
      }
    }

    expect(Math.max(...nodeCounts)).toBeLessThan(1_600)
    expect(grid.querySelectorAll("[role=row]").length).toBe(81)
    expect(root.querySelectorAll(".affino-grid-dom__header [role=columnheader]").length).toBeLessThan(30)
  })

  it("refreshes column metadata and values instead of retaining stale viewport cells", async () => {
    root = document.createElement("div")
    document.body.append(root)
    metricDescriptors = installGridMetrics()
    demo = mountColumnVirtualizationDemo(root)
    await demo.grid.ready

    demo.grid.api.columns.setWidth("field-0", 200)
    await new Promise(resolve => setTimeout(resolve, 40))
    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    expect(grid.style.getPropertyValue("--affino-grid-dom-columns").split(/\s+/)[0]).toBe("200px")

    demo.grid.api.columns.setAll([{
      key: "renamed", field: "field-1", label: "Renamed", initialState: { width: 180 },
    }])
    await new Promise(resolve => setTimeout(resolve, 40))
    expect(root.querySelector("[role=columnheader]")?.textContent).toBe("Renamed")
    expect(root.querySelector('[data-row-index="0"] [data-column-index="0"]')?.textContent).toBe("R1 · C2")
    expect(grid.getAttribute("aria-colcount")).toBe("1")
  })
})

function readColumnTrackWidth(grid: HTMLElement): number {
  return grid.style.getPropertyValue("--affino-grid-dom-columns")
    .split(/\s+/)
    .reduce((total, track) => total + Number.parseFloat(track), 0)
}

function installGridMetrics(): Map<string, PropertyDescriptor | undefined> {
  const descriptors = new Map(["clientWidth", "clientHeight", "scrollWidth", "scrollHeight"]
    .map(key => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)]))
  Object.defineProperties(HTMLElement.prototype, {
    clientWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("affino-grid-dom")
          || this.classList.contains("affino-grid-dom__body") ? 600 : 0
      },
    },
    clientHeight: {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("affino-grid-dom")
          || this.classList.contains("affino-grid-dom__body") ? 400 : 48
      },
    },
    scrollWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("affino-grid-dom")
          || this.classList.contains("affino-grid-dom__body") ? 18_000 : this.clientWidth
      },
    },
    scrollHeight: {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("affino-grid-dom")
          || this.classList.contains("affino-grid-dom__body") ? 12_000 : this.clientHeight
      },
    },
  })
  return descriptors
}
