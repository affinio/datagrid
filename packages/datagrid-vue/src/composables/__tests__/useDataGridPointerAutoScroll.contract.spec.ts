import { describe, expect, it, vi } from "vitest"
import { useDataGridPointerAutoScroll } from "../useDataGridPointerAutoScroll"

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

describe("useDataGridPointerAutoScroll contract", () => {
  it("schedules only one frame while active", () => {
    const raf = createRafHarness()
    const composable = useDataGridPointerAutoScroll({
      resolveInteractionState: () => ({ isDragSelecting: true, isFillDragging: false, isRangeMoving: false }),
      resolveRangeMovePointer: () => null,
      resolveFillPointer: () => null,
      resolveDragPointer: () => ({ clientX: 0, clientY: 0 }),
      resolveViewportElement: () => null,
      resolveHeaderHeight: () => 0,
      resolveAxisAutoScrollDelta: () => 0,
      setScrollPosition: () => undefined,
      applyRangeMovePreviewFromPointer: vi.fn(),
      applyFillPreviewFromPointer: vi.fn(),
      applyDragSelectionFromPointer: vi.fn(),
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    composable.startInteractionAutoScroll()
    composable.startInteractionAutoScroll()

    expect(raf.handles().length).toBe(1)
  })

  it("updates viewport scroll and dispatches active interaction preview", () => {
    const raf = createRafHarness()
    const applyRangeMovePreviewFromPointer = vi.fn()
    const applyFillPreviewFromPointer = vi.fn()
    const applyDragSelectionFromPointer = vi.fn()
    const setScrollPosition = vi.fn()
    const viewport = {
      scrollTop: 100,
      scrollLeft: 120,
      scrollHeight: 2000,
      clientHeight: 400,
      scrollWidth: 1800,
      clientWidth: 500,
      getBoundingClientRect: () => ({ top: 100, bottom: 500, left: 50, right: 550 }),
    } as unknown as HTMLElement

    const composable = useDataGridPointerAutoScroll({
      resolveInteractionState: () => ({ isDragSelecting: false, isFillDragging: false, isRangeMoving: true }),
      resolveRangeMovePointer: () => ({ clientX: 546, clientY: 496 }),
      resolveFillPointer: () => null,
      resolveDragPointer: () => null,
      resolveViewportElement: () => viewport,
      resolveHeaderHeight: () => 32,
      resolveAxisAutoScrollDelta(pointer, min, max) {
        if (pointer < min + 20) return -10
        if (pointer > max - 20) return 10
        return 0
      },
      setScrollPosition,
      applyRangeMovePreviewFromPointer,
      applyFillPreviewFromPointer,
      applyDragSelectionFromPointer,
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    composable.startInteractionAutoScroll()
    const [frame] = raf.handles()
    raf.run(frame ?? -1)

    expect(viewport.scrollTop).toBe(110)
    expect(viewport.scrollLeft).toBe(130)
    expect(setScrollPosition).toHaveBeenCalledWith({ top: 110, left: 130 })
    expect(applyRangeMovePreviewFromPointer).toHaveBeenCalledTimes(1)
    expect(applyFillPreviewFromPointer).not.toHaveBeenCalled()
    expect(applyDragSelectionFromPointer).not.toHaveBeenCalled()
    expect(raf.handles().length).toBe(1)
  })

  it("stops scheduled frame when interaction becomes idle", () => {
    const raf = createRafHarness()
    const interactionState = { isDragSelecting: true, isFillDragging: false, isRangeMoving: false }
    const composable = useDataGridPointerAutoScroll({
      resolveInteractionState: () => interactionState,
      resolveRangeMovePointer: () => null,
      resolveFillPointer: () => null,
      resolveDragPointer: () => ({ clientX: 0, clientY: 0 }),
      resolveViewportElement: () => null,
      resolveHeaderHeight: () => 0,
      resolveAxisAutoScrollDelta: () => 0,
      setScrollPosition: () => undefined,
      applyRangeMovePreviewFromPointer: vi.fn(),
      applyFillPreviewFromPointer: vi.fn(),
      applyDragSelectionFromPointer: vi.fn(),
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    composable.startInteractionAutoScroll()
    const [frame] = raf.handles()
    interactionState.isDragSelecting = false
    composable.stopAutoScrollFrameIfIdle()

    expect(raf.cancelled()).toEqual([frame])
    expect(raf.handles().length).toBe(0)
  })

  it("disposes scheduled frame explicitly", () => {
    const raf = createRafHarness()
    const composable = useDataGridPointerAutoScroll({
      resolveInteractionState: () => ({ isDragSelecting: true, isFillDragging: false, isRangeMoving: false }),
      resolveRangeMovePointer: () => null,
      resolveFillPointer: () => null,
      resolveDragPointer: () => ({ clientX: 0, clientY: 0 }),
      resolveViewportElement: () => null,
      resolveHeaderHeight: () => 0,
      resolveAxisAutoScrollDelta: () => 0,
      setScrollPosition: () => undefined,
      applyRangeMovePreviewFromPointer: vi.fn(),
      applyFillPreviewFromPointer: vi.fn(),
      applyDragSelectionFromPointer: vi.fn(),
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    })

    composable.startInteractionAutoScroll()
    const [frame] = raf.handles()
    composable.dispose()

    expect(raf.cancelled()).toEqual([frame])
    expect(raf.handles().length).toBe(0)
  })
})
