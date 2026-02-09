import { describe, expect, it, vi } from "vitest"
import { useDataGridVisibleRowsSyncScheduler } from "../useDataGridVisibleRowsSyncScheduler"

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

describe("useDataGridVisibleRowsSyncScheduler contract", () => {
  it("syncs rows and visible range and skips duplicate sync", () => {
    const rows = [{ id: "r1" }, { id: "r2" }, { id: "r3" }]
    const range = { start: 0, end: 1 }
    const setRows = vi.fn()
    const syncRowsInRange = vi.fn(() => rows.slice(0, 2))
    const applyVisibleRows = vi.fn()

    const composable = useDataGridVisibleRowsSyncScheduler({
      resolveRows: () => rows,
      resolveRange: () => range,
      setRows,
      syncRowsInRange,
      applyVisibleRows,
    })

    composable.syncVisibleRows()
    composable.syncVisibleRows()

    expect(setRows).toHaveBeenCalledTimes(1)
    expect(syncRowsInRange).toHaveBeenCalledTimes(1)
    expect(applyVisibleRows).toHaveBeenCalledTimes(1)
  })

  it("applies empty visible rows for invalid range", () => {
    const rows = [{ id: "r1" }]
    const setRows = vi.fn()
    const syncRowsInRange = vi.fn()
    const applyVisibleRows = vi.fn()

    const composable = useDataGridVisibleRowsSyncScheduler({
      resolveRows: () => rows,
      resolveRange: () => ({ start: 2, end: 1 }),
      setRows,
      syncRowsInRange,
      applyVisibleRows,
    })

    composable.syncVisibleRows()

    expect(syncRowsInRange).not.toHaveBeenCalled()
    expect(applyVisibleRows).toHaveBeenCalledWith([])
  })

  it("schedules a single RAF sync and disposes frame", () => {
    const raf = createRafHarness()
    const rows = [{ id: "r1" }]
    const composable = useDataGridVisibleRowsSyncScheduler({
      resolveRows: () => rows,
      resolveRange: () => ({ start: 0, end: 0 }),
      setRows: vi.fn(),
      syncRowsInRange: () => rows,
      applyVisibleRows: vi.fn(),
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    composable.scheduleVisibleRowsSync()
    composable.scheduleVisibleRowsSync()
    expect(raf.handles().length).toBe(1)

    const [frame] = raf.handles()
    composable.dispose()
    expect(raf.cancelled()).toEqual([frame])
    expect(raf.handles().length).toBe(0)
  })
})
