import { describe, expect, it, vi } from "vitest"
import { ref } from "vue"
import {
  useDataGridClipboardBridge,
  type DataGridClipboardRange,
} from "../useDataGridClipboardBridge"

interface TestRow {
  rowId: string
  service: string
  owner: string
}

describe("useDataGridClipboardBridge contract", () => {
  it("copies selection payload deterministically and updates flash state", async () => {
    const copiedSelectionRange = ref<DataGridClipboardRange | null>(null)
    const lastCopiedPayload = ref("")
    const lastAction = ref("")
    const copiedPayloads: string[] = []

    const rows: TestRow[] = [
      { rowId: "r-1", service: "api", owner: "alice" },
      { rowId: "r-2", service: "worker", owner: "bob" },
    ]
    const columnKeys = ["select", "service", "owner"]

    const clipboard = useDataGridClipboardBridge<TestRow>({
      copiedSelectionRange,
      lastCopiedPayload,
      resolveCopyRange() {
        return {
          startRow: 0,
          endRow: 1,
          startColumn: 0,
          endColumn: 2,
        }
      },
      getRowAtIndex(rowIndex) {
        return rows[rowIndex]
      },
      getColumnKeyAtIndex(columnIndex) {
        return columnKeys[columnIndex] ?? null
      },
      getCellValue(row, columnKey) {
        return row[columnKey as keyof TestRow]
      },
      setLastAction(message) {
        lastAction.value = message
      },
      closeContextMenu: vi.fn(),
      copiedSelectionFlashMs: 0,
      writeClipboardText: async payload => {
        copiedPayloads.push(payload)
      },
    })

    const copied = await clipboard.copySelection("keyboard")
    expect(copied).toBe(true)
    expect(copiedPayloads[0]).toBe("api\talice\nworker\tbob")
    expect(lastCopiedPayload.value).toBe("api\talice\nworker\tbob")
    expect(copiedSelectionRange.value).toEqual({
      startRow: 0,
      endRow: 1,
      startColumn: 0,
      endColumn: 2,
    })
    expect(lastAction.value).toBe("Copied 2x3 cells (keyboard)")
  })

  it("falls back to in-memory payload and parses matrix", async () => {
    const copiedSelectionRange = ref<DataGridClipboardRange | null>(null)
    const lastCopiedPayload = ref("alpha\tbeta\ngamma\tdelta")

    const clipboard = useDataGridClipboardBridge<TestRow>({
      copiedSelectionRange,
      lastCopiedPayload,
      resolveCopyRange() {
        return null
      },
      getRowAtIndex() {
        return undefined
      },
      getColumnKeyAtIndex() {
        return null
      },
      getCellValue() {
        return ""
      },
      setLastAction: vi.fn(),
      closeContextMenu: vi.fn(),
      readClipboardText: async () => {
        throw new Error("blocked")
      },
    })

    const payload = await clipboard.readClipboardPayload()
    expect(payload).toBe("alpha\tbeta\ngamma\tdelta")
    expect(clipboard.parseClipboardMatrix(payload)).toEqual([
      ["alpha", "beta"],
      ["gamma", "delta"],
    ])
  })
})
