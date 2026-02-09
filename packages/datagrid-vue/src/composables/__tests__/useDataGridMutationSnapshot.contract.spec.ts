import { describe, expect, it } from "vitest"
import { useDataGridMutationSnapshot } from "../useDataGridMutationSnapshot"

interface Row {
  rowId: string
  owner: string
}

describe("useDataGridMutationSnapshot contract", () => {
  it("captures and reapplies full mutable state", () => {
    let rows: Row[] = [{ rowId: "1", owner: "alice" }]
    let cellAnchor = { rowIndex: 1, columnIndex: 2 }
    let cellFocus = { rowIndex: 1, columnIndex: 2 }
    let activeCell = { rowIndex: 1, columnIndex: 2 }
    let copiedSelectionRange = { startRow: 1, endRow: 1, startColumn: 2, endColumn: 2 }

    const snapshots = useDataGridMutationSnapshot<Row>({
      resolveRows: () => rows,
      setRows(next) {
        rows = next
      },
      resolveCellAnchor: () => cellAnchor,
      setCellAnchor(next) {
        cellAnchor = next as typeof cellAnchor
      },
      resolveCellFocus: () => cellFocus,
      setCellFocus(next) {
        cellFocus = next as typeof cellFocus
      },
      resolveActiveCell: () => activeCell,
      setActiveCell(next) {
        activeCell = next as typeof activeCell
      },
      resolveCopiedSelectionRange: () => copiedSelectionRange,
      setCopiedSelectionRange(next) {
        copiedSelectionRange = next as typeof copiedSelectionRange
      },
      cloneRow(row) {
        return { ...row }
      },
    })

    const snapshot = snapshots.captureGridMutationSnapshot()
    rows = [{ rowId: "2", owner: "bob" }]
    cellAnchor = { rowIndex: 9, columnIndex: 9 }
    snapshots.applyGridMutationSnapshot(snapshot)

    expect(rows).toEqual([{ rowId: "1", owner: "alice" }])
    expect(cellAnchor).toEqual({ rowIndex: 1, columnIndex: 2 })
    expect(cellFocus).toEqual({ rowIndex: 1, columnIndex: 2 })
    expect(activeCell).toEqual({ rowIndex: 1, columnIndex: 2 })
    expect(copiedSelectionRange).toEqual({ startRow: 1, endRow: 1, startColumn: 2, endColumn: 2 })
  })

  it("maps selection types into transaction ranges", () => {
    const snapshots = useDataGridMutationSnapshot<Row>({
      resolveRows: () => [],
      setRows() {},
      resolveCellAnchor: () => null,
      setCellAnchor() {},
      resolveCellFocus: () => null,
      setCellFocus() {},
      resolveActiveCell: () => null,
      setActiveCell() {},
      resolveCopiedSelectionRange: () => null,
      setCopiedSelectionRange() {},
      cloneRow(row) {
        return { ...row }
      },
    })

    expect(
      snapshots.toTransactionRange({
        startRow: 1,
        endRow: 2,
        startColumn: 3,
        endColumn: 4,
      }),
    ).toEqual({ startRow: 1, endRow: 2, startColumn: 3, endColumn: 4 })
    expect(snapshots.toSingleCellRange({ rowIndex: 7, columnIndex: 8 })).toEqual({
      startRow: 7,
      endRow: 7,
      startColumn: 8,
      endColumn: 8,
    })
  })
})
