import { describe, expect, it, vi } from "vitest"
import { useDataGridViewportMeasureScheduler } from "../useDataGridViewportMeasureScheduler"

interface RafHarness {
  request: (callback: FrameRequestCallback) => number
  cancel: (handle: number) => void
  run: (handle: number) => void
  handles: () => number[]
  cancelled: () => number[]
}

function createRafHarness(): RafHarness {
  let nextHandle = 1
  const callbacks = new Map<number, FrameRequestCallback>()
  const cancelledHandles: number[] = []

  return {
    request(callback) {
      const handle = nextHandle
      nextHandle += 1
      callbacks.set(handle, callback)
      return handle
    },
    cancel(handle) {
      cancelledHandles.push(handle)
      callbacks.delete(handle)
    },
    run(handle) {
      const callback = callbacks.get(handle)
      callbacks.delete(handle)
      callback?.(0)
    },
    handles() {
      return [...callbacks.keys()]
    },
    cancelled() {
      return [...cancelledHandles]
    },
  }
}

describe("useDataGridViewportMeasureScheduler contract", () => {
  it("applies measured metrics when values changed", () => {
    const state = {
      viewportHeight: 300,
      viewportWidth: 700,
      headerHeight: 30,
    }
    const applyMeasuredState = vi.fn((next: typeof state) => {
      state.viewportHeight = next.viewportHeight
      state.viewportWidth = next.viewportWidth
      state.headerHeight = next.headerHeight
    })

    const viewport = {
      clientHeight: 520,
      clientWidth: 900,
    } as HTMLElement
    const header = {
      getBoundingClientRect: () => ({ height: 52 }),
    } as unknown as HTMLElement

    const composable = useDataGridViewportMeasureScheduler({
      resolveViewportElement: () => viewport,
      resolveHeaderElement: () => header,
      resolveCurrentState: () => state,
      applyMeasuredState,
      rowHeight: 40,
      minViewportBodyHeight: 200,
    })

    composable.syncViewportHeight()

    expect(applyMeasuredState).toHaveBeenCalledWith({
      viewportHeight: 480,
      viewportWidth: 900,
      headerHeight: 52,
    })
  })

  it("schedules only one measurement frame while pending", () => {
    const raf = createRafHarness()
    const composable = useDataGridViewportMeasureScheduler({
      resolveViewportElement: () => null,
      resolveHeaderElement: () => null,
      resolveCurrentState: () => ({
        viewportHeight: 0,
        viewportWidth: 0,
        headerHeight: 0,
      }),
      applyMeasuredState: vi.fn(),
      rowHeight: 40,
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    composable.scheduleViewportMeasure()
    composable.scheduleViewportMeasure()

    expect(raf.handles().length).toBe(1)
    const [frame] = raf.handles()
    raf.run(frame ?? -1)
    expect(raf.handles().length).toBe(0)
  })

  it("disposes scheduled frame", () => {
    const raf = createRafHarness()
    const composable = useDataGridViewportMeasureScheduler({
      resolveViewportElement: () => null,
      resolveHeaderElement: () => null,
      resolveCurrentState: () => ({
        viewportHeight: 0,
        viewportWidth: 0,
        headerHeight: 0,
      }),
      applyMeasuredState: vi.fn(),
      rowHeight: 40,
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    composable.scheduleViewportMeasure()
    const [frame] = raf.handles()
    composable.dispose()

    expect(raf.cancelled()).toEqual([frame])
    expect(raf.handles().length).toBe(0)
  })
})
