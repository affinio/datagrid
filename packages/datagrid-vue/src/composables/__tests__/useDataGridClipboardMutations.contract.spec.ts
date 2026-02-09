import { describe, expect, it, vi } from "vitest"
import { ref } from "vue"
import {
  useDataGridClipboardMutations,
  type DataGridClipboardCoord,
} from "../useDataGridClipboardMutations"
import type { DataGridClipboardRange } from "../useDataGridClipboardBridge"

interface TestRow {
  rowId: string
  a: string
  b: string
}

describe("useDataGridClipboardMutations contract", () => {
  it("applies paste matrix and records transaction with deterministic range", async () => {
    const rows = ref<readonly TestRow[]>([
      { rowId: "r1", a: "1", b: "2" },
      { rowId: "r2", a: "3", b: "4" },
    ])
    const copyRange = ref<DataGridClipboardRange | null>(null)
    const activeCoord = ref<DataGridClipboardCoord | null>({ rowIndex: 0, columnIndex: 0 })
    const lastAction = ref("")
    const selectedRange = ref<DataGridClipboardRange | null>(null)
    const recorded: Array<{ intent: string; label: string }> = []
    const closeContextMenu = vi.fn()

    const mutations = useDataGridClipboardMutations<TestRow, "a" | "b">({
      sourceRows: rows,
      setSourceRows(nextRows) {
        rows.value = nextRows
      },
      cloneRow(row) {
        return { ...row }
      },
      resolveRowId(row) {
        return row.rowId
      },
      resolveCopyRange() {
        return copyRange.value
      },
      resolveCurrentCellCoord() {
        return activeCoord.value
      },
      normalizeCellCoord(coord) {
        if (coord.rowIndex < 0 || coord.columnIndex < 0) {
          return null
        }
        return coord
      },
      normalizeSelectionRange(range) {
        return {
          startRow: Math.max(0, range.startRow),
          endRow: Math.max(0, range.endRow),
          startColumn: Math.max(0, range.startColumn),
          endColumn: Math.max(0, range.endColumn),
        }
      },
      resolveRowAtViewIndex(rowIndex) {
        return rows.value[rowIndex]
      },
      resolveColumnKeyAtIndex(columnIndex) {
        if (columnIndex === 0) return "a"
        if (columnIndex === 1) return "b"
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
        selectedRange.value = { ...range }
      },
      closeContextMenu,
      setLastAction(message) {
        lastAction.value = message
      },
      readClipboardPayload: async () => "A\tB\nC\tD",
      parseClipboardMatrix(payload) {
        return payload.split("\n").map(row => row.split("\t"))
      },
      copySelection: async () => true,
      captureBeforeSnapshot() {
        return rows.value.map(row => ({ ...row }))
      },
      async recordIntentTransaction(descriptor) {
        recorded.push({ intent: descriptor.intent, label: descriptor.label })
      },
    })

    const applied = await mutations.pasteSelection("keyboard")
    expect(applied).toBe(true)
    expect(rows.value).toEqual([
      { rowId: "r1", a: "A", b: "B" },
      { rowId: "r2", a: "C", b: "D" },
    ])
    expect(selectedRange.value).toEqual({
      startRow: 0,
      endRow: 1,
      startColumn: 0,
      endColumn: 1,
    })
    expect(lastAction.value).toBe("Pasted 4 cells (keyboard)")
    expect(recorded).toEqual([{ intent: "paste", label: "Paste 4 cells" }])
    expect(closeContextMenu).toHaveBeenCalled()
  })

  it("clears and cuts selection with blocked accounting", async () => {
    const rows = ref<readonly TestRow[]>([
      { rowId: "r1", a: "A", b: "" },
      { rowId: "r2", a: "C", b: "" },
    ])
    const copyRange = ref<DataGridClipboardRange | null>({
      startRow: 0,
      endRow: 1,
      startColumn: 0,
      endColumn: 1,
    })
    const lastAction = ref("")
    const copyCalls: Array<string> = []
    const intents: Array<string> = []

    const mutations = useDataGridClipboardMutations<TestRow, "a" | "b">({
      sourceRows: rows,
      setSourceRows(nextRows) {
        rows.value = nextRows
      },
      cloneRow(row) {
        return { ...row }
      },
      resolveRowId(row) {
        return row.rowId
      },
      resolveCopyRange() {
        return copyRange.value
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
        return rows.value[rowIndex]
      },
      resolveColumnKeyAtIndex(columnIndex) {
        return columnIndex === 0 ? "a" : columnIndex === 1 ? "b" : null
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
        lastAction.value = message
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
        return rows.value.map(row => ({ ...row }))
      },
      async recordIntentTransaction(descriptor) {
        intents.push(descriptor.intent)
      },
    })

    const cleared = await mutations.clearCurrentSelection("keyboard")
    expect(cleared).toBe(true)
    expect(lastAction.value).toBe("Cleared 2 cells (keyboard), blocked 2")
    expect(rows.value).toEqual([
      { rowId: "r1", a: "", b: "" },
      { rowId: "r2", a: "", b: "" },
    ])

    rows.value = [
      { rowId: "r1", a: "X", b: "" },
      { rowId: "r2", a: "Y", b: "" },
    ]
    const cut = await mutations.cutSelection("context-menu")
    expect(cut).toBe(true)
    expect(copyCalls).toEqual(["context-menu"])
    expect(lastAction.value).toBe("Cut 2 cells (context-menu), blocked 2")
    expect(intents).toEqual(["clear", "cut"])
  })
})
