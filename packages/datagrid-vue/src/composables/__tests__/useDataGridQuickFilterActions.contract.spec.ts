import { describe, expect, it, vi } from "vitest"
import { useDataGridQuickFilterActions } from "../useDataGridQuickFilterActions"

describe("useDataGridQuickFilterActions contract", () => {
  it("clears non-empty query and reports action", () => {
    let query = "error"
    const setLastAction = vi.fn()
    const actions = useDataGridQuickFilterActions({
      resolveQuery: () => query,
      setQuery(value) {
        query = value
      },
      setLastAction,
    })

    actions.clearQuickFilter()
    expect(query).toBe("")
    expect(setLastAction).toHaveBeenCalledWith("Quick filter cleared")
  })

  it("does nothing for empty query", () => {
    const setQuery = vi.fn()
    const setLastAction = vi.fn()
    const actions = useDataGridQuickFilterActions({
      resolveQuery: () => "",
      setQuery,
      setLastAction,
    })

    actions.clearQuickFilter()
    expect(setQuery).not.toHaveBeenCalled()
    expect(setLastAction).not.toHaveBeenCalled()
  })
})
