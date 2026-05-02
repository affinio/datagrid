import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridAppIntentHistory } from "../useDataGridAppIntentHistory"
import { useDataGridAppClipboard } from "../useDataGridAppClipboard"

type DemoRow = {
  rowId: string
  a: string
  b: string
  c: string
}

type DemoRowNode =
  | { rowId: string; kind: "leaf"; data: DemoRow }
  | { rowId: string; kind: "leaf"; data: DemoRow; __placeholder: true }

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
  rowNodes?: readonly (DemoRowNode | null)[]
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
  const lastAction = ref("")
  const applySelectionRange = vi.fn((range: { startRow: number; endRow: number; startColumn: number; endColumn: number }) => {
    selectionRange.value = range
  })
  const clearCellSelection = vi.fn()
  const rowNodes = options.rowNodes ?? rows.value.map(row => ({
    rowId: row.rowId,
    kind: "leaf" as const,
    data: row,
  }))

  const clipboard = useDataGridAppClipboard<DemoRow, DemoRow[]>({
    mode: ref("base"),
    runtime: {
      api: {
        rows: {
          get: (rowIndex: number) => {
            return rowNodes[rowIndex] ?? null
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
    setLastAction: message => {
      lastAction.value = message
    },
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
    lastAction,
    applySelectionRange,
    clearCellSelection,
  }
}

describe("useDataGridAppClipboard contract", () => {
  it("copies a fully loaded selection unchanged", async () => {
    const { clipboard, lastAction } = createClipboardHarness()

    const copied = await clipboard.copySelectedCells("keyboard")

    expect(copied).toBe(true)
    expect(lastAction.value).toBe("Copied 2x2 cells (keyboard)")
  })

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

  it("replays cut-paste as one deterministic transaction through undo and redo", async () => {
    const rows = ref<DemoRow[]>([
      { rowId: "r1", a: "S1", b: "S2", c: "S3" },
      { rowId: "r2", a: "T1", b: "T2", c: "T3" },
    ])
    const selectionRange = ref({
      startRow: 0,
      endRow: 0,
      startColumn: 0,
      endColumn: 1,
    })
    const currentCell = ref({ rowIndex: 1, columnIndex: 0 })
    const captureRowsSnapshot = () => ({
      kind: "full" as const,
      rows: rows.value.map(row => ({
        rowId: row.rowId,
        row: { ...row },
      })),
    })
    const captureRowsSnapshotForRowIds = (rowIds: readonly (string | number)[]) => ({
      kind: "partial" as const,
      rows: rows.value
        .filter(row => rowIds.includes(row.rowId))
        .map(row => ({
          rowId: row.rowId,
          row: { ...row },
        })),
    })
    const history = useDataGridAppIntentHistory<DemoRow>({
      runtime: {
        api: {
          rows: {
            getCount: () => rows.value.length,
            get: (rowIndex: number) => {
              const row = rows.value[rowIndex]
              return row ? { rowId: row.rowId, kind: "leaf", data: row } : null
            },
            applyEdits: (updates: Array<{ rowId: string | number; data: Partial<DemoRow> }>) => {
              rows.value = rows.value.map(row => {
                const update = updates.find(candidate => candidate.rowId === row.rowId)
                return update ? { ...row, ...update.data } : row
              })
            },
          },
        },
        getBodyRowAtIndex: (rowIndex: number) => {
          const row = rows.value[rowIndex]
          return row ? { rowId: row.rowId, kind: "leaf", data: row } : null
        },
        resolveBodyRowIndexById: (rowId: string | number) => rows.value.findIndex(row => row.rowId === rowId),
      } as never,
      cloneRowData: row => ({ ...row }),
      syncViewport: vi.fn(),
    })

    const clipboard = useDataGridAppClipboard<DemoRow, {
      kind: "full" | "partial"
      rows: Array<{ rowId: string | number; row: DemoRow }>
    }>({
      mode: ref("base"),
      runtime: {
        api: {
          rows: {
            getCount: () => rows.value.length,
            get: (rowIndex: number) => {
              const row = rows.value[rowIndex]
              return row ? { rowId: row.rowId, kind: "leaf", data: row } : null
            },
            applyEdits: (updates: Array<{ rowId: string | number; data: Partial<DemoRow> }>) => {
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
      captureRowsSnapshot,
      captureRowsSnapshotForRowIds,
      recordEditTransaction: (beforeSnapshot, afterSnapshotOverride, label) => {
        return history.recordIntentTransaction(
          {
            intent: "paste",
            label: label ?? "Cut paste",
          },
          beforeSnapshot,
          afterSnapshotOverride,
        )
      },
      readCell: (row, columnKey) => String((row.data as DemoRow)[columnKey as keyof DemoRow] ?? ""),
      isCellEditable: () => true,
      syncViewport: () => undefined,
    })

    await clipboard.cutSelectedCells("keyboard")
    const applied = await clipboard.pasteSelectedCells("keyboard")

    expect(applied).toBe(true)
    for (let attempt = 0; attempt < 5 && !history.canUndo.value; attempt += 1) {
      await new Promise<void>(resolve => setTimeout(resolve, 0))
    }
    expect(history.canUndo.value).toBe(true)
    expect(rows.value).toEqual([
      { rowId: "r1", a: "", b: "", c: "S3" },
      { rowId: "r2", a: "S1", b: "S2", c: "T3" },
    ])

    await history.runHistoryAction("undo")
    expect(rows.value).toEqual([
      { rowId: "r1", a: "S1", b: "S2", c: "S3" },
      { rowId: "r2", a: "T1", b: "T2", c: "T3" },
    ])

    await history.runHistoryAction("redo")
    expect(rows.value).toEqual([
      { rowId: "r1", a: "", b: "", c: "S3" },
      { rowId: "r2", a: "S1", b: "S2", c: "T3" },
    ])
  })

  it("captures history only for affected row ids during paste", async () => {
    const rows = ref<DemoRow[]>([
      { rowId: "r1", a: "A1", b: "B1", c: "C1" },
      { rowId: "r2", a: "A2", b: "B2", c: "C2" },
      { rowId: "r3", a: "A3", b: "B3", c: "C3" },
    ])
    const captureRowsSnapshot = vi.fn(() => ({
      kind: "full" as const,
      rows: rows.value.map(row => ({ rowId: row.rowId, row: { ...row } })),
    }))
    const captureRowsSnapshotForRowIds = vi.fn((rowIds: readonly (string | number)[]) => ({
      kind: "partial" as const,
      rows: rows.value
        .filter(row => rowIds.includes(row.rowId))
        .map(row => ({ rowId: row.rowId, row: { ...row } })),
    }))

    const clipboard = useDataGridAppClipboard<DemoRow, {
      kind: "full" | "partial"
      rows: Array<{ rowId: string | number; row: DemoRow }>
    }>({
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

  it("records partial fill snapshots for the edited row ids", async () => {
    const rows = ref<DemoRow[]>([
      { rowId: "r1", a: "A1", b: "B1", c: "C1" },
      { rowId: "r2", a: "A2", b: "B2", c: "C2" },
      { rowId: "r3", a: "A3", b: "B3", c: "C3" },
    ])
    const captureRowsSnapshot = vi.fn(() => ({
      kind: "full" as const,
      rows: rows.value.map(row => ({ rowId: row.rowId, row: { ...row } })),
    }))
    const captureRowsSnapshotForRowIds = vi.fn((rowIds: readonly (string | number)[]) => ({
      kind: "partial" as const,
      rows: rows.value
        .filter(row => rowIds.includes(row.rowId))
        .map(row => ({ rowId: row.rowId, row: { ...row } })),
    }))
    const recordEditTransaction = vi.fn()

    const clipboard = useDataGridAppClipboard<DemoRow, {
      kind: "full" | "partial"
      rows: Array<{ rowId: string | number; row: DemoRow }>
    }>({
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
      resolveSelectionRange: () => ({
        startRow: 0,
        endRow: 1,
        startColumn: 0,
        endColumn: 1,
      }),
      resolveCurrentCellCoord: () => ({ rowIndex: 0, columnIndex: 0 }),
      applySelectionRange: () => undefined,
      clearCellSelection: () => undefined,
      captureRowsSnapshot,
      captureRowsSnapshotForRowIds,
      recordEditTransaction,
      readCell: (row, columnKey) => String((row.data as DemoRow)[columnKey as keyof DemoRow] ?? ""),
      isCellEditable: () => true,
      syncViewport: () => undefined,
    })

    await clipboard.applyClipboardEdits(
      {
        startRow: 0,
        endRow: 1,
        startColumn: 0,
        endColumn: 1,
      },
      [
        ["A1", "B1"],
        ["A2", "B2"],
      ],
    )

    expect(recordEditTransaction).toHaveBeenCalledTimes(1)
    expect(recordEditTransaction).toHaveBeenCalledWith(
      {
        kind: "partial",
        rows: [
          { rowId: "r1", row: { rowId: "r1", a: "A1", b: "B1", c: "C1" } },
          { rowId: "r2", row: { rowId: "r2", a: "A2", b: "B2", c: "C2" } },
        ],
      },
      {
        kind: "partial",
        rows: [
          { rowId: "r1", row: { rowId: "r1", a: "A1", b: "B1", c: "C1" } },
          { rowId: "r2", row: { rowId: "r2", a: "A2", b: "B2", c: "C2" } },
        ],
      },
      undefined,
    )
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

  it("skips blocked cells when applying clipboard edits", async () => {
    const { clipboard, rows } = createClipboardHarness({
      isCellEditable: (_row, rowIndex, columnKey) => !(rowIndex === 0 && columnKey === "b"),
    })

    const applied = await clipboard.applyClipboardEdits({
      startRow: 0,
      endRow: 0,
      startColumn: 0,
      endColumn: 1,
    }, [["X", "Y"]])

    expect(applied).toBe(1)
    expect(rows.value[0]).toEqual({ rowId: "r1", a: "X", b: "B1", c: "C1" })
  })

  it("blocks copy when a selected row is missing from the loaded cache", async () => {
    const { clipboard, lastAction } = createClipboardHarness({
      rowNodes: [
        { rowId: "r1", kind: "leaf", data: { rowId: "r1", a: "A1", b: "B1", c: "C1" } },
        null,
        { rowId: "r3", kind: "leaf", data: { rowId: "r3", a: "A3", b: "B3", c: "C3" } },
      ],
    })

    const copied = await clipboard.copySelectedCells("keyboard")

    expect(copied).toBe(false)
    expect(lastAction.value).toBe("Selected range includes unloaded rows. Load rows or use server export.")
  })

  it("blocks copy when the selected range includes detectable placeholder rows", async () => {
    const { clipboard, lastAction } = createClipboardHarness({
      rowNodes: [
        { rowId: "r1", kind: "leaf", data: { rowId: "r1", a: "A1", b: "B1", c: "C1" } },
        { rowId: "__datagrid_placeholder__:1", kind: "leaf", __placeholder: true, data: { rowId: "r2", a: "", b: "", c: "" } },
        { rowId: "r3", kind: "leaf", data: { rowId: "r3", a: "A3", b: "B3", c: "C3" } },
      ],
    })

    const copied = await clipboard.copySelectedCells("keyboard")

    expect(copied).toBe(false)
    expect(lastAction.value).toBe("Selected range includes unloaded rows. Load rows or use server export.")
  })
})
