import { describe, expect, it, vi } from "vitest"
import {
  useDataGridGlobalPointerLifecycle,
  type DataGridPointerInteractionState,
} from "../useDataGridGlobalPointerLifecycle"

function createMouseEvent(type: string, init: MouseEventInit = {}): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
}

function createPointerEvent(type: string, init: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, { bubbles: true, cancelable: true, ...init })
}

describe("useDataGridGlobalPointerLifecycle contract", () => {
  it("routes mouse move branches deterministically by active interaction", () => {
    let state: DataGridPointerInteractionState = {
      isRangeMoving: true,
      isColumnResizing: false,
      isFillDragging: false,
      isDragSelecting: false,
    }
    let rangePointer: { clientX: number; clientY: number } | null = null
    const setRangeMovePointer = vi.fn((pointer: { clientX: number; clientY: number }) => {
      rangePointer = pointer
    })
    const applyRangeMovePreviewFromPointer = vi.fn()
    const applyColumnResizeFromPointer = vi.fn()
    const setFillPointer = vi.fn()
    const applyFillPreviewFromPointer = vi.fn()
    const setDragPointer = vi.fn()
    const applyDragSelectionFromPointer = vi.fn()

    const lifecycle = useDataGridGlobalPointerLifecycle({
      resolveInteractionState: () => state,
      resolveRangeMovePointer: () => rangePointer,
      setRangeMovePointer,
      applyRangeMovePreviewFromPointer,
      stopRangeMove: vi.fn(),
      applyColumnResizeFromPointer,
      stopColumnResize: vi.fn(),
      resolveFillPointer: () => null,
      setFillPointer,
      applyFillPreviewFromPointer,
      stopFillSelection: vi.fn(),
      resolveDragPointer: () => null,
      setDragPointer,
      applyDragSelectionFromPointer,
      stopDragSelection: vi.fn(),
    })

    const rangeMoveEvent = createMouseEvent("mousemove", { buttons: 1, clientX: 10, clientY: 20 })
    expect(lifecycle.dispatchGlobalMouseMove(rangeMoveEvent)).toBe(true)
    expect(setRangeMovePointer).toHaveBeenCalledWith({ clientX: 10, clientY: 20 })
    expect(applyRangeMovePreviewFromPointer).toHaveBeenCalledTimes(1)

    state = {
      isRangeMoving: false,
      isColumnResizing: true,
      isFillDragging: false,
      isDragSelecting: false,
    }
    const resizeEvent = createMouseEvent("mousemove", { buttons: 1, clientX: 77, clientY: 5 })
    expect(lifecycle.dispatchGlobalMouseMove(resizeEvent)).toBe(true)
    expect(applyColumnResizeFromPointer).toHaveBeenCalledWith(77)

    state = {
      isRangeMoving: false,
      isColumnResizing: false,
      isFillDragging: true,
      isDragSelecting: false,
    }
    const fillEvent = createMouseEvent("mousemove", { buttons: 1, clientX: 15, clientY: 18 })
    expect(lifecycle.dispatchGlobalMouseMove(fillEvent)).toBe(true)
    expect(setFillPointer).toHaveBeenCalledWith({ clientX: 15, clientY: 18 })
    expect(applyFillPreviewFromPointer).toHaveBeenCalledTimes(1)

    state = {
      isRangeMoving: false,
      isColumnResizing: false,
      isFillDragging: false,
      isDragSelecting: true,
    }
    const dragEvent = createMouseEvent("mousemove", { buttons: 1, clientX: 99, clientY: 55 })
    expect(lifecycle.dispatchGlobalMouseMove(dragEvent)).toBe(true)
    expect(setDragPointer).toHaveBeenCalledWith({ clientX: 99, clientY: 55 })
    expect(applyDragSelectionFromPointer).toHaveBeenCalledTimes(1)
  })

  it("finalizes interactions on mouse/pointer up and contextmenu capture", () => {
    const stopRangeMove = vi.fn()
    const stopColumnResize = vi.fn()
    const stopFillSelection = vi.fn()
    const stopDragSelection = vi.fn()
    let state: DataGridPointerInteractionState = {
      isRangeMoving: true,
      isColumnResizing: true,
      isFillDragging: true,
      isDragSelecting: true,
    }

    const lifecycle = useDataGridGlobalPointerLifecycle({
      resolveInteractionState: () => state,
      resolveRangeMovePointer: () => null,
      setRangeMovePointer: vi.fn(),
      applyRangeMovePreviewFromPointer: vi.fn(),
      stopRangeMove,
      applyColumnResizeFromPointer: vi.fn(),
      stopColumnResize,
      resolveFillPointer: () => null,
      setFillPointer: vi.fn(),
      applyFillPreviewFromPointer: vi.fn(),
      stopFillSelection,
      resolveDragPointer: () => null,
      setDragPointer: vi.fn(),
      applyDragSelectionFromPointer: vi.fn(),
      stopDragSelection,
    })

    const upEvent = createMouseEvent("mouseup", { clientX: 3, clientY: 4 })
    expect(lifecycle.dispatchGlobalMouseUp(upEvent)).toBe(true)
    expect(stopRangeMove).toHaveBeenCalledWith(true)
    expect(stopColumnResize).toHaveBeenCalledTimes(1)
    expect(stopFillSelection).toHaveBeenCalledWith(true)
    expect(stopDragSelection).toHaveBeenCalledTimes(1)

    const pointerUpEvent = createPointerEvent("pointerup", { clientX: 6, clientY: 7 })
    expect(lifecycle.dispatchGlobalPointerUp(pointerUpEvent)).toBe(true)

    const contextEvent = createMouseEvent("contextmenu", { clientX: 20, clientY: 30 })
    expect(lifecycle.dispatchGlobalContextMenuCapture(contextEvent)).toBe(true)
    expect(contextEvent.defaultPrevented).toBe(true)

    expect(lifecycle.dispatchGlobalPointerCancel()).toBe(true)

    expect(lifecycle.dispatchGlobalWindowBlur()).toBe(true)

    state = {
      isRangeMoving: false,
      isColumnResizing: false,
      isFillDragging: false,
      isDragSelecting: false,
    }
    const inactiveContextEvent = createMouseEvent("contextmenu")
    expect(lifecycle.dispatchGlobalContextMenuCapture(inactiveContextEvent)).toBe(false)
    expect(inactiveContextEvent.defaultPrevented).toBe(false)
    expect(lifecycle.dispatchGlobalWindowBlur()).toBe(false)
  })

  it("finalizes from mousemove when buttons are released mid-interaction", () => {
    const stopRangeMove = vi.fn()
    const lifecycle = useDataGridGlobalPointerLifecycle({
      resolveInteractionState: () => ({
        isRangeMoving: true,
        isColumnResizing: false,
        isFillDragging: false,
        isDragSelecting: false,
      }),
      resolveRangeMovePointer: () => null,
      setRangeMovePointer: vi.fn(),
      applyRangeMovePreviewFromPointer: vi.fn(),
      stopRangeMove,
      applyColumnResizeFromPointer: vi.fn(),
      stopColumnResize: vi.fn(),
      resolveFillPointer: () => null,
      setFillPointer: vi.fn(),
      applyFillPreviewFromPointer: vi.fn(),
      stopFillSelection: vi.fn(),
      resolveDragPointer: () => null,
      setDragPointer: vi.fn(),
      applyDragSelectionFromPointer: vi.fn(),
      stopDragSelection: vi.fn(),
    })

    const moveWithoutButtons = createMouseEvent("mousemove", { buttons: 0, clientX: 11, clientY: 12 })
    expect(lifecycle.dispatchGlobalMouseMove(moveWithoutButtons)).toBe(true)
    expect(stopRangeMove).toHaveBeenCalledWith(true)
  })

  it("coalesces pointer preview updates in raf mode", () => {
    const applyRangeMovePreviewFromPointer = vi.fn()
    const frameQueue: FrameRequestCallback[] = []
    const lifecycle = useDataGridGlobalPointerLifecycle({
      resolveInteractionState: () => ({
        isRangeMoving: true,
        isColumnResizing: false,
        isFillDragging: false,
        isDragSelecting: false,
      }),
      resolveRangeMovePointer: () => null,
      setRangeMovePointer: vi.fn(),
      applyRangeMovePreviewFromPointer,
      stopRangeMove: vi.fn(),
      applyColumnResizeFromPointer: vi.fn(),
      stopColumnResize: vi.fn(),
      resolveFillPointer: () => null,
      setFillPointer: vi.fn(),
      applyFillPreviewFromPointer: vi.fn(),
      stopFillSelection: vi.fn(),
      resolveDragPointer: () => null,
      setDragPointer: vi.fn(),
      applyDragSelectionFromPointer: vi.fn(),
      stopDragSelection: vi.fn(),
      pointerPreviewApplyMode: "raf",
      requestAnimationFrame(callback) {
        frameQueue.push(callback)
        return frameQueue.length
      },
      cancelAnimationFrame: vi.fn(),
    })

    expect(lifecycle.dispatchGlobalMouseMove(createMouseEvent("mousemove", { buttons: 1, clientX: 11, clientY: 12 }))).toBe(true)
    expect(lifecycle.dispatchGlobalMouseMove(createMouseEvent("mousemove", { buttons: 1, clientX: 21, clientY: 22 }))).toBe(true)
    expect(lifecycle.dispatchGlobalMouseMove(createMouseEvent("mousemove", { buttons: 1, clientX: 31, clientY: 32 }))).toBe(true)

    expect(applyRangeMovePreviewFromPointer).not.toHaveBeenCalled()
    expect(frameQueue.length).toBe(1)

    const flush = frameQueue.shift()
    flush?.(16.6)

    expect(applyRangeMovePreviewFromPointer).toHaveBeenCalledTimes(1)
  })
})
