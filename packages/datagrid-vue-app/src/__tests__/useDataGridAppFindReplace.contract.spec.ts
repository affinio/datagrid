import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { DataGridColumnSnapshot, DataGridRowNode } from "@affino/datagrid-vue"
import { useDataGridAppIntentHistory } from "@affino/datagrid-vue/app"
import { useDataGridAppFindReplace } from "../useDataGridAppFindReplace"

type DemoRow = {
  owner: string
  region: string
}

type DemoRowNode = DataGridRowNode<DemoRow>

function createColumnSnapshot(
  key: keyof DemoRow,
  label: string,
): DataGridColumnSnapshot {
  return {
    key,
    visible: true,
    pin: "center",
    width: 160,
    column: {
      key,
      label,
      field: key,
      capabilities: {
        editable: true,
      },
    },
  } as unknown as DataGridColumnSnapshot
}

function createRuntimeRows(data: readonly Array<{ rowId: string; owner: string; region: string }>): DemoRowNode[] {
  return data.map((row, index) => ({
    rowId: row.rowId,
    rowKey: row.rowId,
    sourceIndex: index,
    originalIndex: index,
    displayIndex: index,
    kind: "leaf",
    state: {
      selected: false,
      group: false,
      pinned: "none",
      expanded: false,
    },
    data: {
      owner: row.owner,
      region: row.region,
    },
    row: {
      owner: row.owner,
      region: row.region,
    },
  })) as DemoRowNode[]
}

describe("useDataGridAppFindReplace contract", () => {
  it("finds the next match from the active cell and maps it into the stage column space", async () => {
    let rows = createRuntimeRows([
      { rowId: "r1", owner: "Alpha", region: "eu-west" },
      { rowId: "r2", owner: "Beta", region: "us-east" },
      { rowId: "r3", owner: "Gamma", region: "eu-west" },
    ])
    const visibleColumns = ref<readonly DataGridColumnSnapshot[]>([
      createColumnSnapshot("owner", "Owner"),
      createColumnSnapshot("region", "Region"),
    ])
    const stageVisibleColumns = ref<readonly DataGridColumnSnapshot[]>([
      {
        key: "__datagrid_row_selection__",
        visible: true,
        pin: "left",
        width: 108,
        column: {
          key: "__datagrid_row_selection__",
          label: "",
          capabilities: { editable: false },
        },
      } as unknown as DataGridColumnSnapshot,
      ...visibleColumns.value,
    ])
    const appliedActiveCell = vi.fn()
    const revealCellInComfortZone = vi.fn()

    const findReplace = useDataGridAppFindReplace<DemoRow, null>({
      runtime: {
        api: {
          rows: {
            getCount: () => rows.length,
            get: (rowIndex: number) => rows[rowIndex] ?? null,
            applyEdits: vi.fn(),
          },
        },
        getBodyRowAtIndex: (rowIndex: number) => rows[rowIndex] ?? null,
        resolveBodyRowIndexById: (rowId: string | number) => rows.findIndex(row => row.rowId === rowId),
      } as never,
      visibleColumns,
      stageVisibleColumns,
      resolveCurrentCellCoord: () => ({ rowIndex: 0, columnIndex: 0 }),
      applyActiveCell: coord => {
        appliedActiveCell(coord)
      },
      revealCellInComfortZone,
      captureRowsSnapshot: () => null,
      captureRowsSnapshotForRowIds: () => null,
      recordHistoryIntentTransaction: () => undefined,
      isCellEditable: () => true,
    })

    findReplace.updateFindText("Beta")
    const found = await findReplace.findNext()

    expect(found).toBe(true)
    expect(appliedActiveCell).toHaveBeenCalledWith({
      rowIndex: 1,
      columnIndex: 1,
    })
    expect(revealCellInComfortZone).toHaveBeenCalledWith(1, 1)
    expect(findReplace.highlightedCell.value).toMatchObject({
      rowId: "r2",
      columnKey: "owner",
    })
  })

  it("records replace-all as a partial history transaction that can undo and redo", async () => {
    let rows = createRuntimeRows([
      { rowId: "r1", owner: "NOC", region: "eu-west" },
      { rowId: "r2", owner: "NOC", region: "NOC" },
      { rowId: "r3", owner: "Payments", region: "us-east" },
    ])
    const visibleColumns = ref<readonly DataGridColumnSnapshot[]>([
      createColumnSnapshot("owner", "Owner"),
      createColumnSnapshot("region", "Region"),
    ])
    const stageVisibleColumns = ref<readonly DataGridColumnSnapshot[]>([...visibleColumns.value])
    const syncViewport = vi.fn()
    const pendingTransactions: Array<Promise<string | null>> = []

    const runtime = {
      api: {
        rows: {
          getCount: () => rows.length,
          get: (rowIndex: number) => rows[rowIndex] ?? null,
          setData: vi.fn((nextRows: Array<{ rowId: string | number; row: DemoRow }>) => {
            rows = nextRows.map((entry, index) => ({
              rowId: String(entry.rowId),
              rowKey: String(entry.rowId),
              sourceIndex: index,
              originalIndex: index,
              displayIndex: index,
              kind: "leaf",
              state: {
                selected: false,
                group: false,
                pinned: "none",
                expanded: false,
              },
              data: { ...entry.row },
              row: { ...entry.row },
            })) as DemoRowNode[]
          }),
          applyEdits: vi.fn((updates: Array<{ rowId: string | number; data: Partial<DemoRow> }>) => {
            rows = rows.map(row => {
              const update = updates.find(candidate => candidate.rowId === row.rowId)
              if (!update) {
                return row
              }
              return {
                ...row,
                data: {
                  ...row.data,
                  ...update.data,
                },
                row: {
                  ...row.row,
                  ...update.data,
                },
              }
            })
          }),
        },
      },
      getBodyRowAtIndex: (rowIndex: number) => rows[rowIndex] ?? null,
      resolveBodyRowIndexById: (rowId: string | number) => rows.findIndex(row => row.rowId === rowId),
    }

    const history = useDataGridAppIntentHistory<DemoRow>({
      runtime: runtime as never,
      cloneRowData: row => ({ ...row }),
      syncViewport,
    })

    const findReplace = useDataGridAppFindReplace<DemoRow, ReturnType<typeof history.captureRowsSnapshot>>({
      runtime: runtime as never,
      visibleColumns,
      stageVisibleColumns,
      resolveCurrentCellCoord: () => null,
      applyActiveCell: () => undefined,
      revealCellInComfortZone: () => Promise.resolve(),
      captureRowsSnapshot: history.captureRowsSnapshot,
      captureRowsSnapshotForRowIds: history.captureRowsSnapshotByIds,
      recordHistoryIntentTransaction: (descriptor, beforeSnapshot) => {
        pendingTransactions.push(history.recordIntentTransaction(descriptor, beforeSnapshot))
      },
      isCellEditable: () => true,
    })

    findReplace.updateFindText("NOC")
    findReplace.updateReplaceText("SRE")

    const replacedCount = await findReplace.replaceAll()
    await Promise.all(pendingTransactions)

    expect(replacedCount).toBe(3)
    expect(rows.map(row => row.data)).toEqual([
      { owner: "SRE", region: "eu-west" },
      { owner: "SRE", region: "SRE" },
      { owner: "Payments", region: "us-east" },
    ])

    await history.runHistoryAction("undo")

    expect(rows.map(row => row.data)).toEqual([
      { owner: "NOC", region: "eu-west" },
      { owner: "NOC", region: "NOC" },
      { owner: "Payments", region: "us-east" },
    ])

    await history.runHistoryAction("redo")

    expect(rows.map(row => row.data)).toEqual([
      { owner: "SRE", region: "eu-west" },
      { owner: "SRE", region: "SRE" },
      { owner: "Payments", region: "us-east" },
    ])
  })
})
