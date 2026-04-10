import { computed, ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type {
  DataGridRowNode,
  DataGridRuntimeVirtualWindowSnapshot,
} from "@affino/datagrid-vue"
import { useDataGridTableStagePlaceholderRows } from "../useDataGridTableStagePlaceholderRows"

interface DemoRow {
  rowId: string
  owner: string
}

function buildRow(rowId: string, displayIndex: number): DataGridRowNode<DemoRow> {
  return {
    kind: "leaf",
    rowId,
    rowKey: rowId,
    sourceIndex: displayIndex,
    originalIndex: displayIndex,
    displayIndex,
    state: {
      selected: false,
      group: false,
      pinned: "none",
      expanded: false,
    },
    data: {
      rowId,
      owner: rowId.toUpperCase(),
    },
    row: {
      rowId,
      owner: rowId.toUpperCase(),
    },
  }
}

describe("useDataGridTableStagePlaceholderRows", () => {
  it("keeps a placeholder-aware virtual window when the viewport enters the visual tail", () => {
    const materializedRows = ref<readonly DemoRow[]>([
      { rowId: "r1", owner: "R1" },
      { rowId: "r2", owner: "R2" },
    ])
    const totalBodyRows = ref(2)
    const runtimeVirtualWindow = ref<DataGridRuntimeVirtualWindowSnapshot | null>({
      rowStart: 0,
      rowEnd: 1,
      rowTotal: 2,
      colStart: 0,
      colEnd: 0,
      colTotal: 1,
      overscan: { top: 0, bottom: 0, left: 0, right: 0 },
    })
    const setViewportRange = vi.fn((range: { start: number; end: number }) => {
      runtimeVirtualWindow.value = runtimeVirtualWindow.value == null
        ? null
        : {
          ...runtimeVirtualWindow.value,
          rowStart: range.start,
          rowEnd: range.end,
          rowTotal: totalBodyRows.value,
        }
    })
    const setVirtualWindowRange = vi.fn((range: { start: number; end: number }) => {
      runtimeVirtualWindow.value = runtimeVirtualWindow.value == null
        ? null
        : {
          ...runtimeVirtualWindow.value,
          rowStart: range.start,
          rowEnd: range.end,
          rowTotal: totalBodyRows.value,
        }
    })

    const service = useDataGridTableStagePlaceholderRows<DemoRow>({
      runtime: {
        api: {
          rows: {
            insertDataAt: vi.fn(),
          },
        },
        syncBodyRowsInRange: vi.fn(),
        setViewportRange,
        setVirtualWindowRange,
        rowPartition: computed(() => ({
          bodyRowCount: totalBodyRows.value,
          pinnedTopRows: [],
          pinnedBottomRows: [],
        })),
        virtualWindow: runtimeVirtualWindow,
        columnSnapshot: ref({ visibleColumns: [] }),
        getBodyRowAtIndex: rowIndex => {
          if (rowIndex < 0 || rowIndex >= totalBodyRows.value) {
            return null
          }
          const row = materializedRows.value[rowIndex]
          return row ? buildRow(row.rowId, rowIndex) : null
        },
        resolveBodyRowIndexById: rowId => materializedRows.value.findIndex(row => row.rowId === rowId),
      } as never,
      sourceRows: materializedRows,
      totalBodyRows: computed(() => totalBodyRows.value),
      placeholderRows: ref({
        enabled: true,
        policy: "fixed-tail",
        count: 2,
        materializeOn: ["edit", "paste", "toggle"],
        createRowAt: ({ visualRowIndex }) => ({
          rowId: `ph-${visualRowIndex}`,
          owner: "",
        }),
      }),
      cloneRowData: row => ({ ...row }),
    })

    service.visualRuntime.setVirtualWindowRange?.({ start: 2, end: 3 })

    expect(setVirtualWindowRange).toHaveBeenCalledWith({ start: 1, end: 1 })
    expect(service.visualRuntime.virtualWindow.value).toMatchObject({
      rowStart: 2,
      rowEnd: 3,
      rowTotal: 4,
    })

    const visibleRows = service.visualRuntime.syncBodyRowsInRange({ start: 2, end: 3 })

    expect(visibleRows.map(row => String(row.rowId))).toEqual([
      "__datagrid_placeholder__:2",
      "__datagrid_placeholder__:3",
    ])
    expect(service.visualRuntime.virtualWindow.value).toMatchObject({
      rowStart: 2,
      rowEnd: 3,
      rowTotal: 4,
    })
  })
})