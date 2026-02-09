import { describe, expect, it, vi } from "vitest"
import { useDataGridFillHandleStart } from "../useDataGridFillHandleStart"

describe("useDataGridFillHandleStart contract", () => {
  it("returns false for non-primary button or missing selection range", () => {
    const start = useDataGridFillHandleStart({
      resolveSelectionRange: () => null,
      focusViewport: vi.fn(),
      stopRangeMove: vi.fn(),
      setDragSelecting: vi.fn(),
      setDragPointer: vi.fn(),
      setFillDragging: vi.fn(),
      setFillBaseRange: vi.fn(),
      setFillPreviewRange: vi.fn(),
      setFillPointer: vi.fn(),
      startInteractionAutoScroll: vi.fn(),
      setLastAction: vi.fn(),
    })

    expect(start.onSelectionHandleMouseDown({ button: 0 } as MouseEvent)).toBe(false)
    expect(start.onSelectionHandleMouseDown({ button: 1 } as MouseEvent)).toBe(false)
  })

  it("starts fill-handle lifecycle from current selection range", () => {
    const focusViewport = vi.fn()
    const stopRangeMove = vi.fn()
    const setDragSelecting = vi.fn()
    const setDragPointer = vi.fn()
    const setFillDragging = vi.fn()
    const setFillBaseRange = vi.fn()
    const setFillPreviewRange = vi.fn()
    const setFillPointer = vi.fn()
    const startInteractionAutoScroll = vi.fn()
    const setLastAction = vi.fn()
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const range = { startRow: 1, endRow: 2, startColumn: 3, endColumn: 4 }

    const start = useDataGridFillHandleStart({
      resolveSelectionRange: () => range,
      focusViewport,
      stopRangeMove,
      setDragSelecting,
      setDragPointer,
      setFillDragging,
      setFillBaseRange,
      setFillPreviewRange,
      setFillPointer,
      startInteractionAutoScroll,
      setLastAction,
    })

    const started = start.onSelectionHandleMouseDown({
      button: 0,
      clientX: 42,
      clientY: 84,
      preventDefault,
      stopPropagation,
    } as unknown as MouseEvent)

    expect(started).toBe(true)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(focusViewport).toHaveBeenCalledTimes(1)
    expect(stopRangeMove).toHaveBeenCalledWith(false)
    expect(setDragSelecting).toHaveBeenCalledWith(false)
    expect(setDragPointer).toHaveBeenCalledWith(null)
    expect(setFillDragging).toHaveBeenCalledWith(true)
    expect(setFillBaseRange).toHaveBeenCalledWith(range)
    expect(setFillPreviewRange).toHaveBeenCalledWith(range)
    expect(setFillPointer).toHaveBeenCalledWith({ clientX: 42, clientY: 84 })
    expect(startInteractionAutoScroll).toHaveBeenCalledTimes(1)
    expect(setLastAction).toHaveBeenCalledWith("Fill handle active")
  })
})
