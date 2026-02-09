import { describe, expect, it, vi } from "vitest"
import { useDataGridClearSelectionLifecycle } from "../useDataGridClearSelectionLifecycle"

describe("useDataGridClearSelectionLifecycle contract", () => {
  it("resets selection pointers/ranges and calls cleanup callbacks", () => {
    const setCellAnchor = vi.fn()
    const setCellFocus = vi.fn()
    const setActiveCell = vi.fn()
    const setDragSelecting = vi.fn()
    const setFillDragging = vi.fn()
    const setDragPointer = vi.fn()
    const setFillPointer = vi.fn()
    const setFillBaseRange = vi.fn()
    const setFillPreviewRange = vi.fn()
    const clearLastDragCoord = vi.fn()
    const closeContextMenu = vi.fn()
    const stopRangeMove = vi.fn()
    const stopColumnResize = vi.fn()
    const stopAutoScrollFrameIfIdle = vi.fn()

    const lifecycle = useDataGridClearSelectionLifecycle({
      setCellAnchor,
      setCellFocus,
      setActiveCell,
      setDragSelecting,
      setFillDragging,
      setDragPointer,
      setFillPointer,
      setFillBaseRange,
      setFillPreviewRange,
      clearLastDragCoord,
      closeContextMenu,
      stopRangeMove,
      stopColumnResize,
      stopAutoScrollFrameIfIdle,
    })

    lifecycle.clearCellSelection()

    expect(setCellAnchor).toHaveBeenCalledWith(null)
    expect(setCellFocus).toHaveBeenCalledWith(null)
    expect(setActiveCell).toHaveBeenCalledWith(null)
    expect(setDragSelecting).toHaveBeenCalledWith(false)
    expect(setFillDragging).toHaveBeenCalledWith(false)
    expect(setDragPointer).toHaveBeenCalledWith(null)
    expect(setFillPointer).toHaveBeenCalledWith(null)
    expect(setFillBaseRange).toHaveBeenCalledWith(null)
    expect(setFillPreviewRange).toHaveBeenCalledWith(null)
    expect(clearLastDragCoord).toHaveBeenCalledTimes(1)
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
    expect(stopRangeMove).toHaveBeenCalledWith(false)
    expect(stopColumnResize).toHaveBeenCalledTimes(1)
    expect(stopAutoScrollFrameIfIdle).toHaveBeenCalledTimes(1)
  })
})
