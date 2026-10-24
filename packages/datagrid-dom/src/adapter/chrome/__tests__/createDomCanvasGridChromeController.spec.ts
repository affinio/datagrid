import { afterEach, describe, expect, it, vi } from "vitest"
import { createDomCanvasGridChromeController } from "../createDomCanvasGridChromeController.js"

describe("DOM Canvas grid chrome", () => {
  afterEach(() => vi.restoreAllMocks())

  it("draws viewport lines on an aria-hidden canvas and releases it on detach", async () => {
    const grid = document.createElement("div")
    const body = document.createElement("div")
    body.className = "affino-grid-dom__body"
    Object.defineProperties(body, {
      clientWidth: { value: 320 },
      clientHeight: { value: 120 },
    })
    grid.append(body)
    document.body.append(grid)

    const context = {
      setTransform: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
      beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
      rect: vi.fn(), clip: vi.fn(), strokeStyle: "", lineWidth: 1,
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(context as unknown as CanvasRenderingContext2D)

    const controller = createDomCanvasGridChromeController({
      grid,
      rowSelection: false,
      resolveViewportState: () => ({
        virtualRows: { startIndex: 0, endIndex: 2, totalRowCount: 3, rowHeight: 40 },
        virtualColumns: {
          columns: [
            { index: 0, width: 100, pin: "left", offset: 0 },
            { index: 1, width: 120, pin: "none", offset: 0 },
            { index: 2, width: 100, pin: "right", offset: 0 },
          ],
          leftPadding: 0,
          rightPadding: 180,
        },
      }),
    })

    controller.attach()
    controller.sync()
    expect(body.querySelector("canvas[aria-hidden='true']")).not.toBeNull()

    await vi.waitFor(() => expect(context.lineTo).toHaveBeenCalled())
    expect(grid.classList.contains("affino-grid-dom--canvas-chrome-active")).toBe(true)
    controller.detach()
    expect(body.querySelector("canvas")).toBeNull()
    grid.remove()
  })
})
