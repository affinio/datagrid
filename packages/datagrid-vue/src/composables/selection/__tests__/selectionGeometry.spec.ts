import { describe, expect, it } from "vitest"
import {
  buildSelectionOverlaySignature,
  createSelectionCellKey,
  detectFullColumnSelectionIndex,
} from "../selectionGeometry"

function range(input: {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
  anchorRow: number
  anchorCol: number
  focusRow: number
  focusCol: number
}) {
  return {
    startRow: input.startRow,
    endRow: input.endRow,
    startCol: input.startCol,
    endCol: input.endCol,
    anchor: { rowIndex: input.anchorRow, colIndex: input.anchorCol, rowId: null },
    focus: { rowIndex: input.focusRow, colIndex: input.focusCol, rowId: null },
  }
}

describe("selectionGeometry", () => {
  it("builds deterministic overlay signatures and excludes active range from static signature", () => {
    const ranges = [
      range({ startRow: 0, endRow: 0, startCol: 0, endCol: 0, anchorRow: 0, anchorCol: 0, focusRow: 0, focusCol: 0 }),
      range({ startRow: 1, endRow: 2, startCol: 1, endCol: 2, anchorRow: 1, anchorCol: 1, focusRow: 2, focusCol: 2 }),
    ]

    const signature = buildSelectionOverlaySignature({
      ranges,
      activeRangeIndex: 1,
      fillPreview: { startRow: 3, endRow: 4, startCol: 2, endCol: 2 },
      cutPreviewAreas: [{ startRow: 5, endRow: 5, startCol: 1, endCol: 3 }],
    })

    expect(signature.active).toContain("1:2:1:2")
    expect(signature.ranges).toContain("0:0:0:0")
    expect(signature.ranges).not.toContain("1:2:1:2")
    expect(signature.fill).toBe("3:4:2:2")
    expect(signature.cut).toBe("5:5:1:3")
  })

  it("detects canonical full-column selection only for exact full-height single range", () => {
    const full = detectFullColumnSelectionIndex(
      [range({ startRow: 0, endRow: 9, startCol: 3, endCol: 3, anchorRow: 2, anchorCol: 3, focusRow: 7, focusCol: 3 })],
      { rowCount: 10, colCount: 8 },
    )
    const partial = detectFullColumnSelectionIndex(
      [range({ startRow: 1, endRow: 9, startCol: 3, endCol: 3, anchorRow: 1, anchorCol: 3, focusRow: 9, focusCol: 3 })],
      { rowCount: 10, colCount: 8 },
    )

    expect(full).toBe(3)
    expect(partial).toBeNull()
  })

  it("builds stable imperative cell keys", () => {
    expect(createSelectionCellKey(12, 4)).toBe("12:4")
  })
})
