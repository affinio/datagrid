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

function createRuntime(rows: readonly ReturnType<typeof createRow>[], kind: "client" | "server" = "client") {
  const selectRows = vi.fn()
  const deselectRows = vi.fn()
  const setFocusedRow = vi.fn()
  const setSelected = vi.fn()
  const setSnapshot = vi.fn()
  const getCount = vi.fn(() => rows.length)
  const get = vi.fn((rowIndex: number) => rows[rowIndex] ?? null)

  const runtime = {
    api: {
      rows: {
        getSnapshot: () => ({
          kind,
          rowCount: rows.length,
          loading: false,
          revision: 1,
        }),
        getCount,
        get,
      },
      rowSelection: {
        hasSupport: () => true,
        setSnapshot,
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
    setSnapshot,
    getCount,
    get,
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
  it("syncs the snapshot after toggling a row checkbox", () => {
    const filteredRows = [createRow("r1"), createRow("r2")]
    const { runtime, setSelected } = createRuntime(filteredRows)
    const rowSelectionSnapshot = ref<DataGridRowSelectionSnapshot | null>(null)
    const applyRowSelectionMutation = vi.fn((mutator: (api: typeof runtime.api.rowSelection) => void) => {
      mutator(runtime.api.rowSelection)
    })

    const selection = useDataGridTableStageRowSelection<DemoRow>({
      runtime,
      rowSelectionColumn: computed(() => createRowSelectionColumn()),
      orderedVisibleColumns: computed(() => []),
      displayRows: ref(filteredRows as never),
      rowSelectionSnapshot,
      applyRowSelectionMutation,
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => null),
      applySelectionRange: () => undefined,
    })

    selection.toggleRowCheckboxSelected(filteredRows[0] as never)

    expect(applyRowSelectionMutation).toHaveBeenCalledTimes(1)
    expect(setSelected).toHaveBeenCalledWith("r1", true)
  })

  it("toggles all filtered rows, not just visible viewport rows", () => {
    const filteredRows = [createRow("r1"), createRow("r2"), createRow("r3")]
    const visibleRows = [filteredRows[0], filteredRows[1]]
    const { runtime, selectRows } = createRuntime(filteredRows)
    const rowSelectionSnapshot = ref<DataGridRowSelectionSnapshot | null>(null)
    const applyRowSelectionMutation = vi.fn((mutator: (api: typeof runtime.api.rowSelection) => void) => {
      mutator(runtime.api.rowSelection)
    })

    const selection = useDataGridTableStageRowSelection<DemoRow>({
      runtime,
      rowSelectionColumn: computed(() => createRowSelectionColumn()),
      orderedVisibleColumns: computed(() => []),
      displayRows: ref(visibleRows as never),
      rowSelectionSnapshot,
      applyRowSelectionMutation,
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => null),
      applySelectionRange: () => undefined,
    })

    selection.toggleVisibleRowsSelected()

    expect(applyRowSelectionMutation).toHaveBeenCalledTimes(1)
    expect(selectRows).toHaveBeenCalledWith(["r1", "r2", "r3"])
  })

  it("excludes group rows from the header bulk-selection set", () => {
    const filteredRows = [createRow("group-1", "group"), createRow("r1"), createRow("r2")]
    const { runtime, selectRows } = createRuntime(filteredRows)
    const rowSelectionSnapshot = ref<DataGridRowSelectionSnapshot | null>(null)

    const selection = useDataGridTableStageRowSelection<DemoRow>({
      runtime,
      rowSelectionColumn: computed(() => createRowSelectionColumn()),
      orderedVisibleColumns: computed(() => []),
      displayRows: ref(filteredRows as never),
      rowSelectionSnapshot,
      applyRowSelectionMutation: mutator => {
        mutator(runtime.api.rowSelection)
      },
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => null),
      applySelectionRange: () => undefined,
    })

    selection.toggleVisibleRowsSelected()

    expect(selectRows).toHaveBeenCalledWith(["r1", "r2"])
  })

  it("syncs the snapshot after deselecting all filtered rows", () => {
    const filteredRows = [createRow("r1"), createRow("r2"), createRow("r3")]
    const { runtime, deselectRows } = createRuntime(filteredRows)
    const rowSelectionSnapshot = ref<DataGridRowSelectionSnapshot | null>({
      focusedRow: null,
      selectedRows: ["r1", "r2", "r3"],
    })
    const applyRowSelectionMutation = vi.fn((mutator: (api: typeof runtime.api.rowSelection) => void) => {
      mutator(runtime.api.rowSelection)
    })

    const selection = useDataGridTableStageRowSelection<DemoRow>({
      runtime,
      rowSelectionColumn: computed(() => createRowSelectionColumn()),
      orderedVisibleColumns: computed(() => []),
      displayRows: ref(filteredRows as never),
      rowSelectionSnapshot,
      applyRowSelectionMutation,
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => null),
      applySelectionRange: () => undefined,
    })

    selection.toggleVisibleRowsSelected()

    expect(applyRowSelectionMutation).toHaveBeenCalledTimes(1)
    expect(deselectRows).toHaveBeenCalledWith(["r1", "r2", "r3"])
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
      applyRowSelectionMutation: mutator => {
        mutator(runtime.api.rowSelection)
      },
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => null),
      applySelectionRange: () => undefined,
    })

    expect(selection.areAllVisibleRowsSelected.value).toBe(true)
    expect(selection.areSomeVisibleRowsSelected.value).toBe(true)
  })

  it("selects all server rows without enumerating the unloaded row model", () => {
    const cachedRows = [createRow("r1"), createRow("r2")]
    const { runtime, setSnapshot, getCount, get } = createRuntime(cachedRows, "server")
    const rowSelectionSnapshot = ref<DataGridRowSelectionSnapshot | null>(null)

    const selection = useDataGridTableStageRowSelection<DemoRow>({
      runtime,
      rowSelectionColumn: computed(() => createRowSelectionColumn()),
      orderedVisibleColumns: computed(() => []),
      displayRows: ref(cachedRows as never),
      rowSelectionSnapshot,
      applyRowSelectionMutation: mutator => {
        mutator(runtime.api.rowSelection)
      },
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => null),
      applySelectionRange: () => undefined,
    })

    selection.toggleVisibleRowsSelected()

    expect(setSnapshot).toHaveBeenCalledWith({
      focusedRow: null,
      selectedRows: [],
      mode: "all",
      excludedRows: [],
    })
    expect(getCount).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
  })

  it("uses excluded rows when rendering server all-row selection", () => {
    const cachedRows = [createRow("r1"), createRow("r2")]
    const { runtime, setSelected } = createRuntime(cachedRows, "server")
    const rowSelectionSnapshot = ref<DataGridRowSelectionSnapshot | null>({
      focusedRow: null,
      selectedRows: [],
      mode: "all",
      excludedRows: ["r2"],
    })

    const selection = useDataGridTableStageRowSelection<DemoRow>({
      runtime,
      rowSelectionColumn: computed(() => createRowSelectionColumn()),
      orderedVisibleColumns: computed(() => []),
      displayRows: ref(cachedRows as never),
      rowSelectionSnapshot,
      applyRowSelectionMutation: mutator => {
        mutator(runtime.api.rowSelection)
      },
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => null),
      applySelectionRange: () => undefined,
    })

    expect(selection.isRowCheckboxSelected(cachedRows[0] as never)).toBe(true)
    expect(selection.isRowCheckboxSelected(cachedRows[1] as never)).toBe(false)
    expect(selection.areAllVisibleRowsSelected.value).toBe(false)
    expect(selection.areSomeVisibleRowsSelected.value).toBe(true)

    selection.toggleRowCheckboxSelected(cachedRows[1] as never)

    expect(setSelected).toHaveBeenCalledWith("r2", true)
  })
})
