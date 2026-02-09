import { describe, expect, it } from "vitest"
import { useDataGridNavigationPrimitives } from "../useDataGridNavigationPrimitives"

describe("useDataGridNavigationPrimitives contract", () => {
  it("resolves column/row indexes and navigable neighbors", () => {
    const primitives = useDataGridNavigationPrimitives({
      resolveColumns: () => [{ key: "select" }, { key: "service" }, { key: "owner" }],
      resolveRowsLength: () => 10,
      resolveNavigableColumnIndexes: () => [1, 2],
      normalizeCellCoord: coord => coord,
      resolveCellAnchor: () => null,
      resolveCellFocus: () => null,
      resolveActiveCell: () => null,
      setCellAnchor() {},
      setCellFocus() {},
      setActiveCell() {},
      ensureCellVisible() {},
      coordsEqual: (left, right) =>
        left?.rowIndex === right?.rowIndex && left?.columnIndex === right?.columnIndex,
    })

    expect(primitives.resolveColumnIndex("owner")).toBe(2)
    expect(primitives.resolveColumnIndex("missing")).toBe(-1)
    expect(primitives.clampRowIndex(99)).toBe(9)
    expect(primitives.resolveNearestNavigableColumnIndex(0, 1)).toBe(1)
    expect(primitives.getAdjacentNavigableColumnIndex(1, 1)).toBe(2)
    expect(primitives.positiveModulo(-1, 3)).toBe(2)
  })

  it("applies cell selection with extend mode", () => {
    let anchor: { rowIndex: number; columnIndex: number } | null = null
    let focus: { rowIndex: number; columnIndex: number } | null = null
    let active: { rowIndex: number; columnIndex: number } | null = null
    let ensureVisibleCalls = 0

    const primitives = useDataGridNavigationPrimitives({
      resolveColumns: () => [],
      resolveRowsLength: () => 1,
      resolveNavigableColumnIndexes: () => [],
      normalizeCellCoord: coord => coord,
      resolveCellAnchor: () => anchor,
      resolveCellFocus: () => focus,
      resolveActiveCell: () => active,
      setCellAnchor(next) {
        anchor = next
      },
      setCellFocus(next) {
        focus = next
      },
      setActiveCell(next) {
        active = next
      },
      ensureCellVisible() {
        ensureVisibleCalls += 1
      },
      coordsEqual: (left, right) =>
        left?.rowIndex === right?.rowIndex && left?.columnIndex === right?.columnIndex,
    })

    primitives.applyCellSelection({ rowIndex: 1, columnIndex: 1 }, false)
    primitives.applyCellSelection({ rowIndex: 1, columnIndex: 2 }, true)

    expect(anchor).toEqual({ rowIndex: 1, columnIndex: 1 })
    expect(focus).toEqual({ rowIndex: 1, columnIndex: 2 })
    expect(active).toEqual({ rowIndex: 1, columnIndex: 2 })
    expect(ensureVisibleCalls).toBe(2)
    expect(
      primitives.isCoordInsideRange(
        { rowIndex: 1, columnIndex: 2 },
        { startRow: 0, endRow: 1, startColumn: 1, endColumn: 2 },
      ),
    ).toBe(true)
  })
})
