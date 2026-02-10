import { describe, expect, it } from "vitest"
import { useDataGridColumnLayoutOrchestration } from "../useDataGridColumnLayoutOrchestration"

interface Column {
  key: string
  pin?: "left" | "right" | "none"
  width: number
}

describe("useDataGridColumnLayoutOrchestration contract", () => {
  it("uses virtualWindow column range when provided", () => {
    const columns: readonly Column[] = [
      { key: "a", pin: "none", width: 100 },
      { key: "b", pin: "none", width: 100 },
      { key: "c", pin: "none", width: 100 },
      { key: "d", pin: "none", width: 100 },
    ]

    const snapshot = useDataGridColumnLayoutOrchestration({
      columns,
      resolveColumnWidth: column => column.width,
      virtualWindow: {
        colStart: 2,
        colEnd: 3,
        colTotal: 4,
      },
    })

    expect(snapshot.visibleColumnsWindow).toEqual({
      start: 3,
      end: 4,
      total: 4,
      keys: "c • d",
    })
  })
})
