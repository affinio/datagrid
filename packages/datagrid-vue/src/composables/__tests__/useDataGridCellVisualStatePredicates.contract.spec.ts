import { describe, expect, it } from "vitest"
import { useDataGridCellVisualStatePredicates } from "../useDataGridCellVisualStatePredicates"

interface Row {
  rowId: string
}

interface Coord {
  rowIndex: number
  columnIndex: number
}

interface Range {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

const row = { rowId: "r2" }
const rowNode = { data: row } as never

describe("useDataGridCellVisualStatePredicates contract", () => {
  it("resolves selection/copy/anchor/active/range-end predicates", () => {
    const api = useDataGridCellVisualStatePredicates<Row, Coord, Range>({
      resolveRowIndex() {
        return 2
      },
      resolveColumnIndex(columnKey) {
        if (columnKey === "service") return 3
        return -1
      },
      isCellWithinRange(rowIndex, columnIndex, range) {
        return (
          rowIndex >= range.startRow &&
          rowIndex <= range.endRow &&
          columnIndex >= range.startColumn &&
          columnIndex <= range.endColumn
        )
      },
      resolveSelectionRange: () => ({ startRow: 1, endRow: 2, startColumn: 1, endColumn: 3 }),
      resolveCopiedRange: () => ({ startRow: 2, endRow: 4, startColumn: 2, endColumn: 5 }),
      resolveAnchorCoord: () => ({ rowIndex: 2, columnIndex: 3 }),
      resolveActiveCoord: () => ({ rowIndex: 2, columnIndex: 3 }),
      isFillDragging: () => false,
      isRangeMoving: () => false,
      resolveFillPreviewRange: () => null,
      resolveFillBaseRange: () => null,
      resolveMovePreviewRange: () => null,
      resolveMoveBaseRange: () => null,
    })

    expect(api.isCellInSelection(rowNode, "service")).toBe(true)
    expect(api.isCellInCopiedRange(rowNode, "service")).toBe(true)
    expect(api.isAnchorCell(rowNode, "service")).toBe(true)
    expect(api.isActiveCell(rowNode, "service")).toBe(true)
    expect(api.isRangeEndCell(rowNode, "service")).toBe(true)
  })

  it("resolves fill/move preview and excludes base overlap", () => {
    const api = useDataGridCellVisualStatePredicates<Row, Coord, Range>({
      resolveRowIndex() {
        return 4
      },
      resolveColumnIndex() {
        return 4
      },
      isCellWithinRange(rowIndex, columnIndex, range) {
        return (
          rowIndex >= range.startRow &&
          rowIndex <= range.endRow &&
          columnIndex >= range.startColumn &&
          columnIndex <= range.endColumn
        )
      },
      resolveSelectionRange: () => ({ startRow: 4, endRow: 4, startColumn: 4, endColumn: 4 }),
      resolveCopiedRange: () => null,
      resolveAnchorCoord: () => null,
      resolveActiveCoord: () => null,
      isFillDragging: () => true,
      isRangeMoving: () => true,
      resolveFillPreviewRange: () => ({ startRow: 4, endRow: 6, startColumn: 4, endColumn: 4 }),
      resolveFillBaseRange: () => ({ startRow: 4, endRow: 4, startColumn: 4, endColumn: 4 }),
      resolveMovePreviewRange: () => ({ startRow: 4, endRow: 6, startColumn: 4, endColumn: 4 }),
      resolveMoveBaseRange: () => ({ startRow: 4, endRow: 4, startColumn: 4, endColumn: 4 }),
      isInlineEditorOpen: () => false,
    })

    expect(api.isCellInFillPreview(rowNode, "service")).toBe(false)
    expect(api.isCellInMovePreview(rowNode, "service")).toBe(false)

    const externalRow = { data: { rowId: "r5" } } as never
    expect(api.isCellInFillPreview(externalRow, "service")).toBe(false)
    expect(api.isCellInMovePreview(externalRow, "service")).toBe(false)
  })

  it("hides fill handle while dragging or inline editor is open", () => {
    const api = useDataGridCellVisualStatePredicates<Row, Coord, Range>({
      resolveRowIndex() {
        return 3
      },
      resolveColumnIndex() {
        return 2
      },
      isCellWithinRange() {
        return true
      },
      resolveSelectionRange: () => ({ startRow: 3, endRow: 3, startColumn: 2, endColumn: 2 }),
      resolveCopiedRange: () => null,
      resolveAnchorCoord: () => null,
      resolveActiveCoord: () => null,
      isFillDragging: () => true,
      isRangeMoving: () => false,
      resolveFillPreviewRange: () => null,
      resolveFillBaseRange: () => null,
      resolveMovePreviewRange: () => null,
      resolveMoveBaseRange: () => null,
      isInlineEditorOpen: () => true,
    })

    expect(api.shouldShowFillHandle(rowNode, "service")).toBe(false)
  })
})
