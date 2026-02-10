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
  it("moves range values and reports action", () => {
    let rows: Row[] = [
      { rowId: "r1", owner: "alice", status: "stable" },
      { rowId: "r2", owner: "bob", status: "stable" },
    ]
    let lastAction = ""
    let selection: { range: Range | null; active: "start" | "end" | null } = { range: null, active: null }
    let moveRecorded = false

    const displayRows: DisplayRow[] = [{ rowId: "r1" }, { rowId: "r2" }]
    const engine = useDataGridRangeMutationEngine<Row, DisplayRow, { mark: string }, Range>({
      resolveRangeMoveBaseRange: () => ({ startRow: 0, endRow: 0, startColumn: 1, endColumn: 1 }),
      resolveRangeMovePreviewRange: () => ({ startRow: 1, endRow: 1, startColumn: 1, endColumn: 1 }),
      resolveFillBaseRange: () => null,
      resolveFillPreviewRange: () => null,
      areRangesEqual: () => false,
      captureBeforeSnapshot: () => ({ mark: "before" }),
      resolveSourceRows: () => rows,
      resolveSourceRowId: row => row.rowId,
      applySourceRows(next) {
        rows = [...next]
      },
      resolveDisplayedRows: () => displayRows,
      resolveDisplayedRowId: row => row.rowId,
      resolveColumnKeyAtIndex(index) {
        return index === 1 ? "owner" : "select"
      },
      resolveDisplayedCellValue(row, columnKey) {
        const source = rows.find(entry => entry.rowId === row.rowId)
        return source ? source[columnKey as keyof Row] : ""
      },
      resolveSourceCellValue(row, columnKey) {
        return row[columnKey as keyof Row]
      },
      normalizeClipboardValue(value) {
        return String(value ?? "")
      },
      isEditableColumn: columnKey => columnKey === "owner",
      applyValueForMove(row, columnKey, value) {
        if (columnKey !== "owner") return false
        row.owner = value
        return true
      },
      clearValueForMove(row, columnKey) {
        if (columnKey !== "owner") return false
        row.owner = ""
        return true
      },
      applyEditedValue(row, columnKey, draft) {
        if (columnKey === "owner") {
          row.owner = draft
        }
      },
      recomputeDerived() {},
      isCellWithinRange() {
        return false
      },
      setSelectionFromRange(range, activePosition) {
        selection = { range, active: activePosition }
      },
      recordIntent(descriptor) {
        if (descriptor.intent === "move") {
          moveRecorded = true
        }
      },
      setLastAction(message) {
        lastAction = message
      },
    })

    const applied = engine.applyRangeMove()
    expect(applied).toBe(true)
    expect(rows[0]?.owner).toBe("")
    expect(rows[1]?.owner).toBe("alice")
    expect(lastAction).toContain("Moved")
    expect(selection.active).toBe("start")
    expect(moveRecorded).toBe(true)
  })

  it("applies fill preview using repeated source pattern", () => {
    let rows: Row[] = [
      { rowId: "r1", owner: "alpha", status: "stable" },
      { rowId: "r2", owner: "beta", status: "stable" },
      { rowId: "r3", owner: "", status: "stable" },
    ]
    let lastAction = ""
    let fillRecorded = false
    const displayRows: DisplayRow[] = [{ rowId: "r1" }, { rowId: "r2" }, { rowId: "r3" }]

    const engine = useDataGridRangeMutationEngine<Row, DisplayRow, { mark: string }, Range>({
      resolveRangeMoveBaseRange: () => null,
      resolveRangeMovePreviewRange: () => null,
      resolveFillBaseRange: () => ({ startRow: 0, endRow: 1, startColumn: 1, endColumn: 1 }),
      resolveFillPreviewRange: () => ({ startRow: 0, endRow: 2, startColumn: 1, endColumn: 1 }),
      areRangesEqual: () => false,
      captureBeforeSnapshot: () => ({ mark: "before" }),
      resolveSourceRows: () => rows,
      resolveSourceRowId: row => row.rowId,
      applySourceRows(next) {
        rows = [...next]
      },
      resolveDisplayedRows: () => displayRows,
      resolveDisplayedRowId: row => row.rowId,
      resolveColumnKeyAtIndex(index) {
        return index === 1 ? "owner" : "select"
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
      isEditableColumn: columnKey => columnKey === "owner",
      applyValueForMove() {
        return false
      },
      clearValueForMove() {
        return false
      },
      applyEditedValue(row, columnKey, draft) {
        if (columnKey === "owner") {
          row.owner = draft
        }
      },
      recomputeDerived() {},
      isCellWithinRange(rowIndex, columnIndex, range) {
        return (
          rowIndex >= range.startRow &&
          rowIndex <= range.endRow &&
          columnIndex >= range.startColumn &&
          columnIndex <= range.endColumn
        )
      },
      setSelectionFromRange() {},
      recordIntent(descriptor) {
        if (descriptor.intent === "fill") {
          fillRecorded = true
        }
      },
      setLastAction(message) {
        lastAction = message
      },
    })

    engine.applyFillPreview()
    expect(rows[2]?.owner).toBe("alpha")
    expect(lastAction).toContain("Fill applied")
    expect(fillRecorded).toBe(true)
  })
})
