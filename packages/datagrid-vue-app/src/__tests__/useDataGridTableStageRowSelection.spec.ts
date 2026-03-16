import { computed, ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type {
  DataGridColumnSnapshot,
  DataGridRowSelectionSnapshot,
  UseDataGridRuntimeResult,
} from "@affino/datagrid-vue"
import { useDataGridTableStageRowSelection } from "../stage/useDataGridTableStageRowSelection"

type DemoRow = Record<string, unknown>

function createRow(rowId: string, kind: "leaf" | "group" = "leaf") {
  return {
    kind,
    rowId,
    data: { id: rowId },
  } as const
}

function createRuntime(rows: readonly ReturnType<typeof createRow>[]) {
  const selectRows = vi.fn()
  const deselectRows = vi.fn()
  const setFocusedRow = vi.fn()
  const setSelected = vi.fn()

  const runtime = {
    api: {
      rows: {
        getCount: () => rows.length,
        get: (rowIndex: number) => rows[rowIndex] ?? null,
      },
      rowSelection: {
        hasSupport: () => true,
        selectRows,
        deselectRows,
        setFocusedRow,
        setSelected,
      },
    },
  } as unknown as Pick<UseDataGridRuntimeResult<DemoRow>, "api">

  return {
    runtime,
    selectRows,
    deselectRows,
    setFocusedRow,
    setSelected,
  }
}

function createRowSelectionColumn(): DataGridColumnSnapshot {
  return {
    key: "__datagrid_row_selection__",
    column: {
      key: "__datagrid_row_selection__",
      label: "",
      cellType: "checkbox",
      meta: { rowSelection: true },
    },
  } as unknown as DataGridColumnSnapshot
}

describe("useDataGridTableStageRowSelection", () => {
  it("toggles all filtered rows, not just visible viewport rows", () => {
    const filteredRows = [createRow("r1"), createRow("r2"), createRow("r3")]
    const visibleRows = [filteredRows[0], filteredRows[1]]
    const { runtime, selectRows } = createRuntime(filteredRows)
    const rowSelectionSnapshot = ref<DataGridRowSelectionSnapshot | null>(null)

    const selection = useDataGridTableStageRowSelection<DemoRow>({
      runtime,
      rowSelectionColumn: computed(() => createRowSelectionColumn()),
      orderedVisibleColumns: computed(() => []),
      displayRows: ref(visibleRows as never),
      rowSelectionSnapshot,
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => null),
      applySelectionRange: () => undefined,
    })

    selection.toggleVisibleRowsSelected()

    expect(selectRows).toHaveBeenCalledWith(["r1", "r2", "r3"])
  })

  it("treats off-screen filtered rows as part of all-selected state", () => {
    const filteredRows = [createRow("r1"), createRow("r2"), createRow("r3")]
    const visibleRows = [filteredRows[0], filteredRows[1]]
    const { runtime } = createRuntime(filteredRows)
    const rowSelectionSnapshot = ref<DataGridRowSelectionSnapshot | null>({
      focusedRow: null,
      selectedRows: ["r1", "r2", "r3"],
    })

    const selection = useDataGridTableStageRowSelection<DemoRow>({
      runtime,
      rowSelectionColumn: computed(() => createRowSelectionColumn()),
      orderedVisibleColumns: computed(() => []),
      displayRows: ref(visibleRows as never),
      rowSelectionSnapshot,
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => null),
      applySelectionRange: () => undefined,
    })

    expect(selection.areAllVisibleRowsSelected.value).toBe(true)
    expect(selection.areSomeVisibleRowsSelected.value).toBe(true)
  })
})