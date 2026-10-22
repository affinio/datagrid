import { describe, expect, it } from "vitest"
import { useDataGridAppColumnSelection } from "../useDataGridAppColumnSelection"

describe("useDataGridAppColumnSelection", () => {
  it("provides persistent key-based state through the Core selection service", () => {
    const { snapshot, selectionService } = useDataGridAppColumnSelection()

    expect(selectionService.getColumnSelectionSnapshot?.()).toBeNull()
    selectionService.setColumnSelectionSnapshot?.({ selectedColumnKeys: ["status", "status"] })
    expect(snapshot.value).toEqual({ selectedColumnKeys: ["status"] })

    selectionService.setColumnSelectionSnapshot?.({ selectedColumnKeys: ["status"] })
    expect(snapshot.value?.selectedColumnKeys).toEqual(["status"])

    selectionService.clearColumnSelection?.()
    expect(selectionService.getColumnSelectionSnapshot?.()).toBeNull()
  })
})
