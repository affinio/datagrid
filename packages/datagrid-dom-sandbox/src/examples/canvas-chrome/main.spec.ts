import { afterEach, describe, expect, it, vi } from "vitest"
import { mountCanvasChromeDemo, type CanvasChromeDemoHandle } from "./main"

describe("Canvas chrome sandbox example", () => {
  let demo: CanvasChromeDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
    vi.restoreAllMocks()
  })

  it("keeps virtualized cell content in the DOM and adds an aria-hidden canvas layer", async () => {
    const context = {
      setTransform: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
      beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
      rect: vi.fn(), clip: vi.fn(), strokeStyle: "", lineWidth: 1,
    }
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(context as unknown as CanvasRenderingContext2D)
    root = document.createElement("div")
    document.body.append(root)
    demo = mountCanvasChromeDemo(root)
    await demo.grid.ready

    expect(getContext).toHaveBeenCalled()

    expect(demo.grid.api.rows.getCount()).toBe(2_000)
    expect(root.querySelector(".affino-grid-dom--canvas-chrome-demo")?.classList.contains("affino-grid-dom--canvas-chrome"))
      .toBe(true)
    await vi.waitFor(() => expect(root.querySelector("canvas.affino-grid-dom__chrome-canvas[aria-hidden='true']"), root.innerHTML).not.toBeNull())
    expect(root.querySelector(".affino-grid-dom__header-right")?.textContent).toContain("Region")
    expect(root.querySelector("[role=grid]")?.getAttribute("aria-colcount")).toBe("9")
    expect(root.querySelector('.affino-grid-dom__body .affino-grid-dom__cell[data-column-index="0"]')?.textContent)
      .toContain("Person 0001")

    const body = root.querySelector<HTMLElement>(".affino-grid-dom__body")!
    const anchor = body.querySelector(".affino-grid-dom__chrome-anchor")!
    const observer = new MutationObserver(() => undefined)
    observer.observe(body, { childList: true })
    demo.grid.api.view.scrollToRow({ rowIndex: 500, rowId: "person-501" })
    await vi.waitFor(() => expect(body.querySelector('[data-row-index="500"]')).not.toBeNull())
    const anchorMutations = observer.takeRecords().filter(record =>
      [...record.addedNodes, ...record.removedNodes].includes(anchor),
    )
    expect(anchorMutations).toHaveLength(0)

    demo.grid.api.rows.patch([{ rowId: "person-501", data: { status: "Updated" } }])
    expect(body.querySelector(".affino-grid-dom__chrome-anchor")).toBe(anchor)
    expect(anchor.querySelector("canvas.affino-grid-dom__chrome-canvas")).not.toBeNull()
    expect(observer.takeRecords().some(record =>
      [...record.addedNodes, ...record.removedNodes].includes(anchor),
    )).toBe(false)
    observer.disconnect()
  })
})
