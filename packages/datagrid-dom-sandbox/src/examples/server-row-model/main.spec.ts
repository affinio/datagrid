import { afterEach, describe, expect, it, vi } from "vitest"
import { mountServerRowModelDemo, type ServerRowModelDemoHandle } from "./main"

describe("server row-model sandbox example", () => {
  let demo: ServerRowModelDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("loads viewport rows and routes filter changes through the datasource", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountServerRowModelDemo(root)
    await demo.grid.ready

    await vi.waitFor(() => {
      const range = demo!.rowModel.getSnapshot().viewportRange
      const renderedRows = root.querySelectorAll(".affino-grid-dom__row[data-row-index]")
      expect(range.start).toBe(0)
      expect(renderedRows.length).toBeGreaterThan(0)
      expect(root.querySelectorAll(".affino-grid-dom__row--data-loading")).toHaveLength(0)
    })

    const initialRange = demo.rowModel.getSnapshot().viewportRange
    const windowSize = initialRange.end - initialRange.start + 1
    const nextRange = {
      start: initialRange.end + 1,
      end: Math.min(demo.rowModel.getRowCount() - 1, initialRange.end + windowSize),
    }
    await vi.waitFor(() => {
      expect(demo!.getPullRequests().some(request => request.reason === "prefetch")).toBe(true)
      expect(demo!.rowModel.getRow(nextRange.start)).toBeDefined()
    })
    const pullCountBeforeBufferedScroll = demo.getPullRequests().length
    demo.rowModel.setViewportRange(nextRange)
    expect(demo.getPullRequests()).toHaveLength(pullCountBeforeBufferedScroll)
    expect(demo.rowModel.getRowsInRange(nextRange).every(row => !("__dataSourceLoadingRow" in row))).toBe(true)

    const filter = root.querySelector<HTMLSelectElement>("[data-server-row-model-region]")!
    filter.value = "North"
    filter.dispatchEvent(new Event("change", { bubbles: true }))

    await vi.waitFor(() => {
      expect(demo!.rowModel.getSnapshot().rowCount).toBe(334)
    })
    expect(root.querySelector("[data-server-row-model-status]")?.textContent).toContain("334 rows")
    expect(demo.rowModel.getSnapshot().filterModel?.columnFilters.region).toMatchObject({ kind: "valueSet" })
  })

  it("reports a failed request and retries it without losing the datasource model", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountServerRowModelDemo(root)
    await demo.grid.ready
    await vi.waitFor(() => {
      expect(demo!.rowModel.getBackpressureDiagnostics().prefetchCompleted).toBeGreaterThan(0)
    })

    root.querySelector<HTMLButtonElement>("[data-server-row-model-fail]")!.click()
    const filter = root.querySelector<HTMLSelectElement>("[data-server-row-model-region]")!
    filter.value = "South"
    filter.dispatchEvent(new Event("change", { bubbles: true }))
    await vi.waitFor(() => expect(demo!.rowModel.getSnapshot().error?.message).toContain("Temporary datasource failure"))

    root.querySelector<HTMLButtonElement>("[data-server-row-model-retry]")!.click()
    await vi.waitFor(() => expect(demo!.rowModel.getSnapshot().rowCount).toBe(333))
    expect(demo.rowModel.getSnapshot().error).toBeNull()
  })

  it("forwards header sorting to the remote projection", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountServerRowModelDemo(root)
    await demo.grid.ready
    await vi.waitFor(() => {
      expect(demo!.rowModel.getSnapshot().loading || demo!.rowModel.getSnapshot().refreshing).toBe(false)
    })

    root.querySelector<HTMLElement>('.affino-grid-dom__column-header[data-column-index="1"]')!.click()
    expect(demo.grid.api.rows.getSnapshot().sortModel).toEqual([{ key: "customer", direction: "asc" }])
    await vi.waitFor(() => {
      expect(demo!.getPullRequests().at(-1)?.sortModel).toEqual([{ key: "customer", direction: "asc" }])
    })
  })
})
