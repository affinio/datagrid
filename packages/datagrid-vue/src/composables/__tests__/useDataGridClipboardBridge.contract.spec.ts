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
    const lastAction = ref("")

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
      setLastAction(message) {
        lastAction.value = message
      },
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
    expect(lastAction.value).toBe("Paste using in-memory clipboard: system clipboard unavailable")
  })

  it("reports clipboard write denial while preserving the in-memory copied payload", async () => {
    const copiedSelectionRange = ref<DataGridClipboardRange | null>(null)
    const lastCopiedPayload = ref("")
    const lastAction = ref("")

    const rows: TestRow[] = [
      { rowId: "r-1", service: "api", owner: "alice" },
    ]
    const columnKeys = ["service", "owner"]

    const clipboard = useDataGridClipboardBridge<TestRow>({
      copiedSelectionRange,
      lastCopiedPayload,
      resolveCopyRange() {
        return {
          startRow: 0,
          endRow: 0,
          startColumn: 0,
          endColumn: 1,
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
      writeClipboardText: async () => {
        throw new Error("denied")
      },
    })

    await expect(clipboard.copySelection("context-menu")).resolves.toBe(true)

    expect(lastCopiedPayload.value).toBe("api\talice")
    expect(lastAction.value).toBe(
      "Copied 1x2 cells (context-menu); system clipboard unavailable, using in-memory clipboard",
    )
  })

  it("reports clipboard read denial when no fallback payload exists", async () => {
    const copiedSelectionRange = ref<DataGridClipboardRange | null>(null)
    const lastCopiedPayload = ref("")
    const lastAction = ref("")

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
      setLastAction(message) {
        lastAction.value = message
      },
      closeContextMenu: vi.fn(),
      readClipboardText: async () => {
        throw new Error("blocked")
      },
    })

    await expect(clipboard.readClipboardPayload()).resolves.toBe("")
    expect(lastAction.value).toBe("Paste skipped: system clipboard unavailable and no in-memory clipboard payload")
  })

  it("escapes spreadsheet tsv fields that contain tabs, newlines, and quotes", async () => {
    const copiedSelectionRange = ref<DataGridClipboardRange | null>(null)
    const lastCopiedPayload = ref("")
    const copiedPayloads: string[] = []

    const rows: TestRow[] = [
      { rowId: "r-1", service: "api\tgateway", owner: "alice" },
      { rowId: "r-2", service: "worker\nqueue", owner: "bob \"ops\"" },
    ]
    const columnKeys = ["service", "owner"]

    const clipboard = useDataGridClipboardBridge<TestRow>({
      copiedSelectionRange,
      lastCopiedPayload,
      resolveCopyRange() {
        return {
          startRow: 0,
          endRow: 1,
          startColumn: 0,
          endColumn: 1,
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
      setLastAction: vi.fn(),
      closeContextMenu: vi.fn(),
      copiedSelectionFlashMs: 0,
      writeClipboardText: async payload => {
        copiedPayloads.push(payload)
      },
    })

    await clipboard.copySelection("keyboard")

    expect(copiedPayloads[0]).toBe("\"api\tgateway\"\talice\n\"worker\nqueue\"\t\"bob \"\"ops\"\"\"")
    expect(lastCopiedPayload.value).toBe(copiedPayloads[0])
  })

  it("parses quoted spreadsheet tsv fields and preserves explicit blank rows", async () => {
    const copiedSelectionRange = ref<DataGridClipboardRange | null>(null)
    const lastCopiedPayload = ref("")

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
    })

    expect(clipboard.parseClipboardMatrix("\"api\tgateway\"\t\"alice \"\"ops\"\"\"\n\n\"worker\nqueue\"\tbob\n")).toEqual([
      ["api\tgateway", "alice \"ops\""],
      [""],
      ["worker\nqueue", "bob"],
    ])
  })
})
