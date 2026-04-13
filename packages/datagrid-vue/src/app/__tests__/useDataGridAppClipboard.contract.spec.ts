import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridAppClipboard } from "../useDataGridAppClipboard"

type DemoRow = {
  rowId: string
  a: string
  b: string
  c: string
}

function createClipboardHarness(options: {
  readClipboardCell?: (row: { data: DemoRow }, columnKey: string) => string
  buildPasteSpecialMatrixFromRange?: (range: {
    startRow: number
    endRow: number
    startColumn: number
    endColumn: number
  }, mode: "values") => string[][]
  isCellEditable?: (row: { data: DemoRow; rowId: string }, rowIndex: number, columnKey: string, columnIndex: number) => boolean
  resolveSelectionRanges?: () => ReadonlyArray<{
    startRow: number
    endRow: number
    startColumn: number
    endColumn: number
  }>
} = {}) {
  const rows = ref<DemoRow[]>([
    { rowId: "r1", a: "A1", b: "B1", c: "C1" },
    { rowId: "r2", a: "A2", b: "B2", c: "C2" },
    { rowId: "r3", a: "A3", b: "B3", c: "C3" },
  ])
  const selectionRange = ref({
    startRow: 0,
    endRow: 1,
    startColumn: 0,
    endColumn: 1,
  })
  const currentCell = ref({ rowIndex: 0, columnIndex: 0 })
  const applySelectionRange = vi.fn((range: { startRow: number; endRow: number; startColumn: number; endColumn: number }) => {
    selectionRange.value = range
  })
  const clearCellSelection = vi.fn()

  const clipboard = useDataGridAppClipboard<DemoRow, DemoRow[]>({
    mode: ref("base"),
    runtime: {
      api: {
        rows: {
          get: (rowIndex: number) => {
            const row = rows.value[rowIndex]
            return row ? { rowId: row.rowId, kind: "leaf", data: row } : null
          },
          applyEdits: (updates: Array<{ rowId: string; data: Partial<DemoRow> }>) => {
            rows.value = rows.value.map(row => {
              const update = updates.find(candidate => candidate.rowId === row.rowId)
              return update ? { ...row, ...update.data } : row
            })
          },
        },
      },
    } as never,
    totalRows: ref(rows.value.length),
    visibleColumns: ref([
      { key: "a" },
      { key: "b" },
      { key: "c" },
    ] as never),
    viewportRowStart: ref(0),
    resolveSelectionRange: () => selectionRange.value,
    resolveSelectionRanges: options.resolveSelectionRanges,
    resolveCurrentCellCoord: () => currentCell.value,
    applySelectionRange,
    clearCellSelection,
    captureRowsSnapshot: () => rows.value.map(row => ({ ...row })),
    recordEditTransaction: () => undefined,
    readCell: (row, columnKey) => String((row.data as DemoRow)[columnKey as keyof DemoRow] ?? ""),
    readClipboardCell: options.readClipboardCell,
    buildPasteSpecialMatrixFromRange: options.buildPasteSpecialMatrixFromRange,
    isCellEditable: (row, rowIndex, columnKey, columnIndex) => {
      return options.isCellEditable?.(
        { data: row.data as DemoRow, rowId: String(row.rowId) },
        rowIndex,
        columnKey,
        columnIndex,
      ) ?? true
    },
    syncViewport: () => undefined,
  })

  return {
    clipboard,
    rows,
    selectionRange,
    currentCell,
    applySelectionRange,
    clearCellSelection,
  }
}

describe("useDataGridAppClipboard contract", () => {
  it("keeps the pasted target range selected after paste", async () => {
    const { clipboard, currentCell, applySelectionRange, clearCellSelection } = createClipboardHarness()

    await clipboard.copySelectedCells("keyboard")

    currentCell.value = { rowIndex: 1, columnIndex: 1 }
    const applied = await clipboard.pasteSelectedCells("keyboard")

    expect(applied).toBe(true)
    expect(applySelectionRange).toHaveBeenLastCalledWith({
      startRow: 1,
      endRow: 2,
      startColumn: 1,
      endColumn: 2,
    })
    expect(clearCellSelection).not.toHaveBeenCalled()
  })

  it("records a single edit transaction for cut-paste", async () => {
    const rows = ref<DemoRow[]>([
      { rowId: "r1", a: "A1", b: "B1", c: "C1" },
      { rowId: "r2", a: "A2", b: "B2", c: "C2" },
    ])
    const selectionRange = ref({
      startRow: 0,
      endRow: 0,
      startColumn: 0,
      endColumn: 0,
    })
    const currentCell = ref({ rowIndex: 1, columnIndex: 1 })
    const recordEditTransaction = vi.fn()

    const clipboard = useDataGridAppClipboard<DemoRow, DemoRow[]>({
      mode: ref("base"),
      runtime: {
        api: {
          rows: {
            get: (rowIndex: number) => {
              const row = rows.value[rowIndex]
              return row ? { rowId: row.rowId, kind: "leaf", data: row } : null
            },
            applyEdits: (updates: Array<{ rowId: string; data: Partial<DemoRow> }>) => {
              rows.value = rows.value.map(row => {
                const update = updates.find(candidate => candidate.rowId === row.rowId)
                return update ? { ...row, ...update.data } : row
              })
            },
          },
        },
      } as never,
      totalRows: ref(rows.value.length),
      visibleColumns: ref([
        { key: "a" },
        { key: "b" },
        { key: "c" },
      ] as never),
      viewportRowStart: ref(0),
      resolveSelectionRange: () => selectionRange.value,
      resolveCurrentCellCoord: () => currentCell.value,
      applySelectionRange: range => {
        selectionRange.value = range
      },
      clearCellSelection: () => undefined,
      captureRowsSnapshot: () => rows.value.map(row => ({ ...row })),
      recordEditTransaction,
      readCell: (row, columnKey) => String((row.data as DemoRow)[columnKey as keyof DemoRow] ?? ""),
      isCellEditable: () => true,
      syncViewport: () => undefined,
    })

    await clipboard.cutSelectedCells("keyboard")
    await clipboard.pasteSelectedCells("keyboard")

    expect(recordEditTransaction).toHaveBeenCalledTimes(1)
    expect(rows.value).toEqual([
      { rowId: "r1", a: "", b: "B1", c: "C1" },
      { rowId: "r2", a: "A2", b: "A1", c: "C2" },
    ])
  })

  it("captures history only for affected row ids during paste", async () => {
    const rows = ref<DemoRow[]>([
      { rowId: "r1", a: "A1", b: "B1", c: "C1" },
      { rowId: "r2", a: "A2", b: "B2", c: "C2" },
      { rowId: "r3", a: "A3", b: "B3", c: "C3" },
    ])
    const captureRowsSnapshot = vi.fn(() => rows.value.map(row => ({ ...row })))
    const captureRowsSnapshotForRowIds = vi.fn((rowIds: readonly (string | number)[]) => {
      return rows.value
        .filter(row => rowIds.includes(row.rowId))
        .map(row => ({ ...row }))
    })

    const clipboard = useDataGridAppClipboard<DemoRow, DemoRow[]>({
      mode: ref("base"),
      runtime: {
        api: {
          rows: {
            get: (rowIndex: number) => {
              const row = rows.value[rowIndex]
              return row ? { rowId: row.rowId, kind: "leaf", data: row } : null
            },
            applyEdits: (updates: Array<{ rowId: string; data: Partial<DemoRow> }>) => {
              rows.value = rows.value.map(row => {
                const update = updates.find(candidate => candidate.rowId === row.rowId)
                return update ? { ...row, ...update.data } : row
              })
            },
          },
        },
      } as never,
      totalRows: ref(rows.value.length),
      visibleColumns: ref([
        { key: "a" },
        { key: "b" },
        { key: "c" },
      ] as never),
      viewportRowStart: ref(0),
      resolveSelectionRange: () => null,
      resolveCurrentCellCoord: () => ({ rowIndex: 1, columnIndex: 0 }),
      applySelectionRange: () => undefined,
      clearCellSelection: () => undefined,
      captureRowsSnapshot,
      captureRowsSnapshotForRowIds,
      recordEditTransaction: () => undefined,
      readCell: (row, columnKey) => String((row.data as DemoRow)[columnKey as keyof DemoRow] ?? ""),
      isCellEditable: () => true,
      syncViewport: () => undefined,
    })

    const originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn<(_: string) => Promise<void>>().mockResolvedValue(undefined),
        readText: vi.fn<() => Promise<string>>().mockResolvedValue("X\tY"),
      },
    })

    try {
      const applied = await clipboard.pasteSelectedCells("keyboard")

      expect(applied).toBe(true)
      expect(captureRowsSnapshotForRowIds).toHaveBeenCalledWith(["r2"])
      expect(captureRowsSnapshot).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      })
    }
  })

  it("tracks pending clipboard visuals for each committed selection range", async () => {
    const { clipboard } = createClipboardHarness({
      resolveSelectionRanges: () => [
        { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
        { startRow: 1, endRow: 1, startColumn: 2, endColumn: 2 },
      ],
    })

    await clipboard.copySelectedCells("keyboard")

    expect(clipboard.isCellInPendingClipboardRange(0, 0)).toBe(true)
    expect(clipboard.isCellInPendingClipboardRange(1, 2)).toBe(true)
    expect(clipboard.isCellInPendingClipboardRange(0, 1)).toBe(false)
  })

  it("writes to and reads from the system clipboard when available", async () => {
    const { clipboard, currentCell, rows } = createClipboardHarness()
    const writeText = vi.fn<(_: string) => Promise<void>>().mockResolvedValue(undefined)
    const readText = vi.fn<() => Promise<string>>().mockResolvedValue("X\tY")
    const clipboardApi = {
      writeText,
      readText,
    }
    const originalClipboard = navigator.clipboard

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: clipboardApi,
    })

    try {
      await clipboard.copySelectedCells("keyboard")

      expect(writeText).toHaveBeenCalledWith("A1\tB1\nA2\tB2")

      currentCell.value = { rowIndex: 2, columnIndex: 0 }
      const applied = await clipboard.pasteSelectedCells("keyboard")

      expect(applied).toBe(true)
      expect(readText).toHaveBeenCalledTimes(1)
      expect(rows.value[2]).toMatchObject({ a: "X", b: "Y" })
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      })
    }
  })

  it("uses the clipboard-specific cell serializer when provided", async () => {
    const { clipboard } = createClipboardHarness({
      readClipboardCell: (_row, columnKey) => {
        if (columnKey === "a") {
          return "=[price]@row"
        }
        if (columnKey === "b") {
          return "=SUM([qty]@row, [price]@row)"
        }
        return ""
      },
    })
    const writeText = vi.fn<(_: string) => Promise<void>>().mockResolvedValue(undefined)
    const originalClipboard = navigator.clipboard

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
        readText: vi.fn<() => Promise<string>>().mockResolvedValue(""),
      },
    })

    try {
      await clipboard.copySelectedCells("keyboard")

      expect(writeText).toHaveBeenCalledWith(
        "=[price]@row\t=SUM([qty]@row, [price]@row)\n=[price]@row\t=SUM([qty]@row, [price]@row)",
      )
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      })
    }
  })

  it("uses the internal paste-special matrix when pasting values from a copied range", async () => {
    const { clipboard, currentCell, rows } = createClipboardHarness({
      readClipboardCell: (_row, columnKey) => columnKey === "a" ? "=A()" : "=B()",
      buildPasteSpecialMatrixFromRange: (_range, mode) => {
        expect(mode).toBe("values")
        return [["11", "22"], ["33", "44"]]
      },
    })
    const writeText = vi.fn<(_: string) => Promise<void>>().mockResolvedValue(undefined)
    const readText = vi.fn<() => Promise<string>>().mockResolvedValue("=A()\t=B()")
    const originalClipboard = navigator.clipboard

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
        readText,
      },
    })

    try {
      await clipboard.copySelectedCells("keyboard")

      currentCell.value = { rowIndex: 1, columnIndex: 1 }
      const applied = await clipboard.pasteSelectedCells("keyboard", { mode: "values" })

      expect(applied).toBe(true)
      expect(readText).not.toHaveBeenCalled()
      expect(rows.value[1]).toMatchObject({ b: "11", c: "22" })
      expect(rows.value[2]).toMatchObject({ b: "33", c: "44" })
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      })
    }
  })

  it("skips blocked cells when applying clipboard edits", () => {
    const { clipboard, rows } = createClipboardHarness({
      isCellEditable: (_row, rowIndex, columnKey) => !(rowIndex === 0 && columnKey === "b"),
    })

    const applied = clipboard.applyClipboardEdits({
      startRow: 0,
      endRow: 0,
      startColumn: 0,
      endColumn: 1,
    }, [["X", "Y"]])

    expect(applied).toBe(1)
    expect(rows.value[0]).toEqual({ rowId: "r1", a: "X", b: "B1", c: "C1" })
  })
})
