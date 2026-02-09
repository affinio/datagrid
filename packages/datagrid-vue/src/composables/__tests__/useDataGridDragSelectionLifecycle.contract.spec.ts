import { describe, expect, it, vi } from "vitest"
import { useDataGridDragSelectionLifecycle } from "../useDataGridDragSelectionLifecycle"

describe("useDataGridDragSelectionLifecycle contract", () => {
  it("stops drag selection deterministically", () => {
    const setDragSelecting = vi.fn()
    const clearDragPointer = vi.fn()
    const clearLastDragCoord = vi.fn()
    const stopAutoScrollFrameIfIdle = vi.fn()

    const lifecycle = useDataGridDragSelectionLifecycle({
      setDragSelecting,
      clearDragPointer,
      clearLastDragCoord,
      stopAutoScrollFrameIfIdle,
    })

    lifecycle.stopDragSelection()

    expect(setDragSelecting).toHaveBeenCalledWith(false)
    expect(clearDragPointer).toHaveBeenCalledTimes(1)
    expect(clearLastDragCoord).toHaveBeenCalledTimes(1)
    expect(stopAutoScrollFrameIfIdle).toHaveBeenCalledTimes(1)
  })
})
