import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridAppClipboard } from "../useDataGridAppClipboard"

type DemoRow = {
  rowId: string
  a: string
  b: string
  c: string
}

describe("useDataGridAppClipboard contract", () => {
  it("keeps the pasted target range selected after paste", async () => {
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
      resolveCurrentCellCoord: () => currentCell.value,
      applySelectionRange,
      clearCellSelection,
      captureRowsSnapshot: () => rows.value.map(row => ({ ...row })),
      recordEditTransaction: () => undefined,
      readCell: (row, columnKey) => String((row.data as DemoRow)[columnKey as keyof DemoRow] ?? ""),
      syncViewport: () => undefined,
    })

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
})
