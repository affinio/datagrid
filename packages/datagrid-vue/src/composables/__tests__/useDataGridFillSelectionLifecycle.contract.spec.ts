import { describe, expect, it, vi } from "vitest"
import { useDataGridFillSelectionLifecycle } from "../useDataGridFillSelectionLifecycle"

describe("useDataGridFillSelectionLifecycle contract", () => {
  it("stops fill selection without preview apply when disabled", () => {
    const applyFillPreview = vi.fn()
    const setFillDragging = vi.fn()
    const clearFillPointer = vi.fn()
    const clearFillBaseRange = vi.fn()
    const clearFillPreviewRange = vi.fn()
    const stopAutoScrollFrameIfIdle = vi.fn()

    const lifecycle = useDataGridFillSelectionLifecycle({
      applyFillPreview,
      setFillDragging,
      clearFillPointer,
      clearFillBaseRange,
      clearFillPreviewRange,
      stopAutoScrollFrameIfIdle,
    })

    lifecycle.stopFillSelection(false)

    expect(applyFillPreview).not.toHaveBeenCalled()
    expect(setFillDragging).toHaveBeenCalledWith(false)
    expect(clearFillPointer).toHaveBeenCalledTimes(1)
    expect(clearFillBaseRange).toHaveBeenCalledTimes(1)
    expect(clearFillPreviewRange).toHaveBeenCalledTimes(1)
    expect(stopAutoScrollFrameIfIdle).toHaveBeenCalledTimes(1)
  })

  it("applies preview before stopping when enabled", () => {
    const applyFillPreview = vi.fn()
    const lifecycle = useDataGridFillSelectionLifecycle({
      applyFillPreview,
      setFillDragging: vi.fn(),
      clearFillPointer: vi.fn(),
      clearFillBaseRange: vi.fn(),
      clearFillPreviewRange: vi.fn(),
      stopAutoScrollFrameIfIdle: vi.fn(),
    })

    lifecycle.stopFillSelection(true)
    expect(applyFillPreview).toHaveBeenCalledTimes(1)
  })
})
