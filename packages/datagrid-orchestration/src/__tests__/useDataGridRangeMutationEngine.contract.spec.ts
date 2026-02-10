import { describe, expect, it } from "vitest"
import { useDataGridRangeMutationEngine } from "../useDataGridRangeMutationEngine"

interface Row {
  rowId: string
  owner: string
  status: string
}

interface DisplayRow {
  rowId: string
}

interface Range {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

describe("useDataGridRangeMutationEngine contract", () => {
  it("records move intent with before snapshot and deterministic blocked accounting", () => {
    let sourceRows: readonly Row[] = [
      { rowId: "r1", owner: "alice", status: "stable" },
      { rowId: "r2", owner: "bob", status: "stable" },
    ]
    const displayRows: readonly DisplayRow[] = [{ rowId: "r1" }, { rowId: "r2" }]
    const recorded: Array<{
      descriptor: { intent: "move" | "fill"; label: string; affectedRange: Range }
      before: readonly Row[]
    }> = []
    let lastAction = ""

    const engine = useDataGridRangeMutationEngine<Row, DisplayRow, readonly Row[], Range>({
      resolveRangeMoveBaseRange: () => ({ startRow: 0, endRow: 0, startColumn: 1, endColumn: 2 }),
      resolveRangeMovePreviewRange: () => ({ startRow: 1, endRow: 1, startColumn: 1, endColumn: 2 }),
      resolveFillBaseRange: () => null,
      resolveFillPreviewRange: () => null,
      areRangesEqual: () => false,
      captureBeforeSnapshot: () => sourceRows.map(row => ({ ...row })),
      resolveSourceRows: () => sourceRows,
      resolveSourceRowId: row => row.rowId,
      applySourceRows(rows) {
        sourceRows = rows
      },
      resolveDisplayedRows: () => displayRows,
      resolveDisplayedRowId: row => row.rowId,
      resolveColumnKeyAtIndex(index) {
        if (index === 1) return "owner"
        if (index === 2) return "status"
        return null
      },
      resolveDisplayedCellValue(row, columnKey) {
        const source = sourceRows.find(entry => entry.rowId === row.rowId)
        return source ? source[columnKey as keyof Row] : ""
      },
      resolveSourceCellValue(row, columnKey) {
        return row[columnKey as keyof Row]
      },
      normalizeClipboardValue(value) {
        return String(value ?? "")
      },
      isExcludedColumn: () => false,
      isEditableColumn: () => true,
      applyValueForMove(row, columnKey, value) {
        if (columnKey === "status") {
          return false
        }
        row[columnKey as keyof Row] = value
        return true
      },
      clearValueForMove(row, columnKey) {
        row[columnKey as keyof Row] = ""
        return true
      },
      applyEditedValue() {
        // not used in move path
      },
      shouldRecomputeDerivedForColumn: () => false,
      recomputeDerived() {
        // no-op
      },
      isCellWithinRange() {
        return false
      },
      setSelectionFromRange() {
        // no-op
      },
      recordIntent(descriptor, beforeSnapshot) {
        recorded.push({ descriptor, before: beforeSnapshot })
      },
      setLastAction(message) {
        lastAction = message
      },
    })

    const applied = engine.applyRangeMove()
    expect(applied).toBe(true)
    expect(sourceRows).toEqual([
      { rowId: "r1", owner: "", status: "" },
      { rowId: "r2", owner: "alice", status: "" },
    ])
    expect(lastAction).toBe("Moved 1 cells, blocked 1")
    expect(recorded).toHaveLength(1)
    expect(recorded[0]?.descriptor.intent).toBe("move")
    expect(recorded[0]?.descriptor.label).toBe("Move 1 cells (blocked 1)")
    expect(recorded[0]?.before).toEqual([
      { rowId: "r1", owner: "alice", status: "stable" },
      { rowId: "r2", owner: "bob", status: "stable" },
    ])
  })

  it("records fill intent with deterministic affected range and before snapshot", () => {
    let sourceRows: readonly Row[] = [
      { rowId: "r1", owner: "alpha", status: "stable" },
      { rowId: "r2", owner: "beta", status: "stable" },
      { rowId: "r3", owner: "", status: "stable" },
    ]
    const displayRows: readonly DisplayRow[] = [{ rowId: "r1" }, { rowId: "r2" }, { rowId: "r3" }]
    const recorded: Array<{
      descriptor: { intent: "move" | "fill"; label: string; affectedRange: Range }
      before: readonly Row[]
    }> = []
    let lastAction = ""

    const engine = useDataGridRangeMutationEngine<Row, DisplayRow, readonly Row[], Range>({
      resolveRangeMoveBaseRange: () => null,
      resolveRangeMovePreviewRange: () => null,
      resolveFillBaseRange: () => ({ startRow: 0, endRow: 1, startColumn: 1, endColumn: 1 }),
      resolveFillPreviewRange: () => ({ startRow: 0, endRow: 2, startColumn: 1, endColumn: 1 }),
      areRangesEqual: () => false,
      captureBeforeSnapshot: () => sourceRows.map(row => ({ ...row })),
      resolveSourceRows: () => sourceRows,
      resolveSourceRowId: row => row.rowId,
      applySourceRows(rows) {
        sourceRows = rows
      },
      resolveDisplayedRows: () => displayRows,
      resolveDisplayedRowId: row => row.rowId,
      resolveColumnKeyAtIndex(index) {
        return index === 1 ? "owner" : null
      },
      resolveDisplayedCellValue() {
        return ""
      },
      resolveSourceCellValue(row, columnKey) {
        return row[columnKey as keyof Row]
      },
      normalizeClipboardValue(value) {
        return String(value ?? "")
      },
      isExcludedColumn: () => false,
      isEditableColumn: columnKey => columnKey === "owner",
      applyValueForMove() {
        return false
      },
      clearValueForMove() {
        return false
      },
      applyEditedValue(row, columnKey, draft) {
        row[columnKey as keyof Row] = draft
      },
      shouldRecomputeDerivedForColumn: () => false,
      recomputeDerived() {
        // no-op
      },
      isCellWithinRange(rowIndex, columnIndex, range) {
        return (
          rowIndex >= range.startRow &&
          rowIndex <= range.endRow &&
          columnIndex >= range.startColumn &&
          columnIndex <= range.endColumn
        )
      },
      setSelectionFromRange() {
        // no-op
      },
      recordIntent(descriptor, beforeSnapshot) {
        recorded.push({ descriptor, before: beforeSnapshot })
      },
      setLastAction(message) {
        lastAction = message
      },
    })

    engine.applyFillPreview()
    expect(sourceRows).toEqual([
      { rowId: "r1", owner: "alpha", status: "stable" },
      { rowId: "r2", owner: "beta", status: "stable" },
      { rowId: "r3", owner: "alpha", status: "stable" },
    ])
    expect(lastAction).toBe("Fill applied (1 cells)")
    expect(recorded).toHaveLength(1)
    expect(recorded[0]?.descriptor.intent).toBe("fill")
    expect(recorded[0]?.descriptor.affectedRange).toEqual({
      startRow: 0,
      endRow: 2,
      startColumn: 1,
      endColumn: 1,
    })
    expect(recorded[0]?.before).toEqual([
      { rowId: "r1", owner: "alpha", status: "stable" },
      { rowId: "r2", owner: "beta", status: "stable" },
      { rowId: "r3", owner: "", status: "stable" },
    ])
  })
})
