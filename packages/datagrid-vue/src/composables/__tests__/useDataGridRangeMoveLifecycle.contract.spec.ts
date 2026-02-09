import { describe, expect, it, vi } from "vitest"
import { useDataGridRangeMoveLifecycle } from "../useDataGridRangeMoveLifecycle"

describe("useDataGridRangeMoveLifecycle contract", () => {
  it("stops range move without apply when preview apply is disabled", () => {
    const applyRangeMove = vi.fn(() => true)
    const setRangeMoving = vi.fn()
    const clearRangeMovePointer = vi.fn()
    const clearRangeMoveBaseRange = vi.fn()
    const clearRangeMoveOrigin = vi.fn()
    const clearRangeMovePreviewRange = vi.fn()
    const stopAutoScrollFrameIfIdle = vi.fn()

    const lifecycle = useDataGridRangeMoveLifecycle({
      applyRangeMove,
      setRangeMoving,
      clearRangeMovePointer,
      clearRangeMoveBaseRange,
      clearRangeMoveOrigin,
      clearRangeMovePreviewRange,
      stopAutoScrollFrameIfIdle,
    })

    lifecycle.stopRangeMove(false)

    expect(applyRangeMove).not.toHaveBeenCalled()
    expect(setRangeMoving).toHaveBeenCalledWith(false)
    expect(clearRangeMovePointer).toHaveBeenCalledTimes(1)
    expect(clearRangeMoveBaseRange).toHaveBeenCalledTimes(1)
    expect(clearRangeMoveOrigin).toHaveBeenCalledTimes(1)
    expect(clearRangeMovePreviewRange).toHaveBeenCalledTimes(1)
    expect(stopAutoScrollFrameIfIdle).toHaveBeenCalledTimes(1)
  })

  it("applies preview and stops range move on success", () => {
    const applyRangeMove = vi.fn(() => true)
    const lifecycle = useDataGridRangeMoveLifecycle({
      applyRangeMove,
      setRangeMoving: vi.fn(),
      clearRangeMovePointer: vi.fn(),
      clearRangeMoveBaseRange: vi.fn(),
      clearRangeMoveOrigin: vi.fn(),
      clearRangeMovePreviewRange: vi.fn(),
      stopAutoScrollFrameIfIdle: vi.fn(),
      onApplyRangeMoveError: vi.fn(),
    })

    lifecycle.stopRangeMove(true)
    expect(applyRangeMove).toHaveBeenCalledTimes(1)
  })

  it("invokes error hook when apply throws and still resets state", () => {
    const error = new Error("boom")
    const onApplyRangeMoveError = vi.fn()
    const setRangeMoving = vi.fn()
    const clearRangeMovePointer = vi.fn()
    const clearRangeMoveBaseRange = vi.fn()
    const clearRangeMoveOrigin = vi.fn()
    const clearRangeMovePreviewRange = vi.fn()
    const stopAutoScrollFrameIfIdle = vi.fn()

    const lifecycle = useDataGridRangeMoveLifecycle({
      applyRangeMove: () => {
        throw error
      },
      setRangeMoving,
      clearRangeMovePointer,
      clearRangeMoveBaseRange,
      clearRangeMoveOrigin,
      clearRangeMovePreviewRange,
      stopAutoScrollFrameIfIdle,
      onApplyRangeMoveError,
    })

    lifecycle.stopRangeMove(true)

    expect(onApplyRangeMoveError).toHaveBeenCalledWith(error)
    expect(setRangeMoving).toHaveBeenCalledWith(false)
    expect(clearRangeMovePointer).toHaveBeenCalledTimes(1)
    expect(clearRangeMoveBaseRange).toHaveBeenCalledTimes(1)
    expect(clearRangeMoveOrigin).toHaveBeenCalledTimes(1)
    expect(clearRangeMovePreviewRange).toHaveBeenCalledTimes(1)
    expect(stopAutoScrollFrameIfIdle).toHaveBeenCalledTimes(1)
  })
})
