import { describe, expect, it, vi } from "vitest"
import {
  useDataGridClipboardMutations,
  type DataGridClipboardCoord,
} from "../useDataGridClipboardMutations"
import type { DataGridClipboardRange } from "../useDataGridClipboardBridge"

interface TestRow {
  rowId: string
  owner: string
  status: string
}

describe("useDataGridClipboardMutations contract", () => {
  it("records deterministic paste transaction with before-snapshot roundtrip", async () => {
    const sourceRows = {
      value: [
        { rowId: "r1", owner: "alice", status: "stable" },
        { rowId: "r2", owner: "bob", status: "stable" },
      ] as readonly TestRow[],
    }
    let selectedRange: DataGridClipboardRange | null = null
    let lastAction = ""
    const recorded: Array<{
      descriptor: { intent: "paste" | "clear" | "cut"; label: string; affectedRange: DataGridClipboardRange }
      before: readonly TestRow[]
    }> = []

    const mutations = useDataGridClipboardMutations<
      TestRow,
      "owner" | "status",
      DataGridClipboardRange,
      DataGridClipboardCoord,
      readonly TestRow[]
    >({
      sourceRows,
      setSourceRows(rows) {
        sourceRows.value = rows
      },
      cloneRow(row) {
        return { ...row }
      },
      resolveRowId(row) {
        return row.rowId
      },
      resolveCopyRange() {
        return null
      },
      resolveCurrentCellCoord() {
        return { rowIndex: 0, columnIndex: 0 } as DataGridClipboardCoord
      },
      normalizeCellCoord(coord) {
        return coord
      },
      normalizeSelectionRange(range) {
        return range
      },
      resolveRowAtViewIndex(rowIndex) {
        return sourceRows.value[rowIndex]
      },
      resolveColumnKeyAtIndex(columnIndex) {
        if (columnIndex === 0) return "owner"
        if (columnIndex === 1) return "status"
        return null
      },
      isEditableColumn() {
        return true
      },
      canApplyPastedValue() {
        return true
      },
      applyEditedValue(row, columnKey, value) {
        row[columnKey] = value
      },
      clearValueForCut(row, columnKey) {
        if (row[columnKey] === "") {
          return false
        }
        row[columnKey] = ""
        return true
      },
      applySelectionRange(range) {
        selectedRange = { ...range }
      },
      closeContextMenu: vi.fn(),
      setLastAction(message) {
        lastAction = message
      },
      readClipboardPayload: async () => "tom\njerry",
      parseClipboardMatrix(payload) {
        return payload.split("\n").map(row => row.split("\t"))
      },
      copySelection: async () => true,
      captureBeforeSnapshot() {
        return sourceRows.value.map(row => ({ ...row }))
      },
      async recordIntentTransaction(descriptor, beforeSnapshot) {
        recorded.push({
          descriptor,
          before: beforeSnapshot,
        })
      },
    })

    await expect(mutations.pasteSelection("keyboard")).resolves.toBe(true)
    expect(sourceRows.value).toEqual([
      { rowId: "r1", owner: "tom", status: "stable" },
      { rowId: "r2", owner: "jerry", status: "stable" },
    ])
    expect(selectedRange).toEqual({
      startRow: 0,
      endRow: 1,
      startColumn: 0,
      endColumn: 0,
    })
    expect(lastAction).toBe("Pasted 2 cells (keyboard)")
    expect(recorded).toHaveLength(1)
    expect(recorded[0]?.descriptor.intent).toBe("paste")
    expect(recorded[0]?.descriptor.affectedRange).toEqual({
      startRow: 0,
      endRow: 1,
      startColumn: 0,
      endColumn: 0,
    })
    expect(recorded[0]?.before).toEqual([
      { rowId: "r1", owner: "alice", status: "stable" },
      { rowId: "r2", owner: "bob", status: "stable" },
    ])
  })

  it("keeps blocked-cell accounting deterministic for clear/cut partial apply", async () => {
    const sourceRows = {
      value: [
        { rowId: "r1", owner: "alice", status: "" },
        { rowId: "r2", owner: "bob", status: "" },
      ] as readonly TestRow[],
    }
    const selectedRange: DataGridClipboardRange = {
      startRow: 0,
      endRow: 1,
      startColumn: 0,
      endColumn: 1,
    }
    let lastAction = ""
    const intents: string[] = []
    const copyCalls: string[] = []

    const mutations = useDataGridClipboardMutations<
      TestRow,
      "owner" | "status",
      DataGridClipboardRange,
      DataGridClipboardCoord,
      readonly TestRow[]
    >({
      sourceRows,
      setSourceRows(rows) {
        sourceRows.value = rows
      },
      cloneRow(row) {
        return { ...row }
      },
      resolveRowId(row) {
        return row.rowId
      },
      resolveCopyRange() {
        return selectedRange
      },
      resolveCurrentCellCoord() {
        return { rowIndex: 0, columnIndex: 0 }
      },
      normalizeCellCoord(coord) {
        return coord
      },
      normalizeSelectionRange(range) {
        return range
      },
      resolveRowAtViewIndex(rowIndex) {
        return sourceRows.value[rowIndex]
      },
      resolveColumnKeyAtIndex(columnIndex) {
        if (columnIndex === 0) return "owner"
        if (columnIndex === 1) return "status"
        return null
      },
      isEditableColumn() {
        return true
      },
      canApplyPastedValue() {
        return true
      },
      applyEditedValue(row, columnKey, value) {
        row[columnKey] = value
      },
      clearValueForCut(row, columnKey) {
        if (row[columnKey] === "") {
          return false
        }
        row[columnKey] = ""
        return true
      },
      applySelectionRange() {
        // no-op
      },
      closeContextMenu: vi.fn(),
      setLastAction(message) {
        lastAction = message
      },
      readClipboardPayload: async () => "",
      parseClipboardMatrix() {
        return [[]]
      },
      copySelection: async trigger => {
        copyCalls.push(trigger)
        return true
      },
      captureBeforeSnapshot() {
        return sourceRows.value
      },
      async recordIntentTransaction(descriptor) {
        intents.push(descriptor.intent)
      },
    })

    await expect(mutations.clearCurrentSelection("keyboard")).resolves.toBe(true)
    expect(lastAction).toBe("Cleared 2 cells (keyboard), blocked 2")
    expect(sourceRows.value).toEqual([
      { rowId: "r1", owner: "", status: "" },
      { rowId: "r2", owner: "", status: "" },
    ])

    sourceRows.value = [
      { rowId: "r1", owner: "x", status: "" },
      { rowId: "r2", owner: "y", status: "" },
    ]
    await expect(mutations.cutSelection("context-menu")).resolves.toBe(true)
    expect(copyCalls).toEqual(["context-menu"])
    expect(lastAction).toBe("Cut 2 cells (context-menu), blocked 2")
    expect(intents).toEqual(["clear", "cut"])
  })
})
