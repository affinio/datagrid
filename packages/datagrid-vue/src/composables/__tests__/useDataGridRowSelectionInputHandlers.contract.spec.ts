import { describe, expect, it, vi } from "vitest"
import { useDataGridRowSelectionInputHandlers } from "../useDataGridRowSelectionInputHandlers"

describe("useDataGridRowSelectionInputHandlers contract", () => {
  it("forwards checked states to selection toggles", () => {
    const toggleSelectAllVisible = vi.fn()
    const toggleRowSelection = vi.fn()
    const handlers = useDataGridRowSelectionInputHandlers({
      toggleSelectAllVisible,
      toggleRowSelection,
    })

    handlers.onSelectAllChange({ target: { checked: true } } as unknown as Event)
    handlers.onRowSelectChange("row-1", { target: { checked: false } } as unknown as Event)

    expect(toggleSelectAllVisible).toHaveBeenCalledWith(true)
    expect(toggleRowSelection).toHaveBeenCalledWith("row-1", false)
  })
})
