import { computed, ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type {
  DataGridColumnSnapshot,
  DataGridRowSelectionSnapshot,
  UseDataGridRuntimeResult,
} from "@affino/datagrid-vue/headless"
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
  let rowSelectionSnapshot: DataGridRowSelectionSnapshot | null = { focusedRow: null, selectedRows: [] }
  const setFocusedRow = vi.fn((rowId: string | number | null) => {
    rowSelectionSnapshot = { ...rowSelectionSnapshot!, focusedRow: rowId }
  })
  const setSelected = vi.fn()
  const setSnapshot = vi.fn((snapshot: DataGridRowSelectionSnapshot) => { rowSelectionSnapshot = snapshot })
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
        getSnapshot: () => rowSelectionSnapshot,
        isSelected: (rowId: string | number) => rowSelectionSnapshot?.selectedRows.includes(rowId) ?? false,
        setSnapshot,
        selectRows,
        deselectRows,
        setFocusedRow,
        setSelected,
        clearSelectedRows: vi.fn(),
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
  it("selects records from row headers with replace, toggle, and projection-aware Shift range", () => {
    const rows = [createRow("r1"), createRow("group:g", "group"), createRow("r2"), createRow("r3")]
    const { runtime, setSnapshot } = createRuntime(rows)
    const selection = useDataGridTableStageRowSelection<DemoRow>({
      runtime,
      rowSelectionColumn: computed(() => null),
      orderedVisibleColumns: computed(() => []),
      displayRows: ref(rows as never),
      rowSelectionSnapshot: ref(null),
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => null),
      applySelectionRange: () => undefined,
      rowHeaderAction: ref("select-records"),
      resolveProjectionIndexByRowId: rowId => rows.findIndex(row => row.rowId === rowId),
      resolveProjectionRowAtIndex: rowIndex => rows[rowIndex] as never ?? null,
      getProjectionRevision: () => 2,
    })

    selection.selectRowRange(rows[0] as never, 0, false)
    expect(setSnapshot).toHaveBeenLastCalledWith({ focusedRow: "r1", selectedRows: ["r1"] })

    selection.selectRowRange(rows[2] as never, 2, true)
    expect(setSnapshot).toHaveBeenLastCalledWith({ focusedRow: "r2", selectedRows: ["r1", "r2"] })

    selection.selectRowRange(rows[3] as never, 3, false, true)
    expect(setSnapshot).toHaveBeenLastCalledWith({ focusedRow: "r3", selectedRows: ["r1", "r2", "r3"] })
  })

  it("previews a row drag against the logical projection and commits once", () => {
    const rows = [createRow("r1"), createRow("group:g", "group"), createRow("r2"), createRow("r3")]
    const { runtime, setSnapshot } = createRuntime(rows)
    const releaseOwner = vi.fn()
    const acquireInteractionOwner = vi.fn(() => releaseOwner)
    const selection = useDataGridTableStageRowSelection<DemoRow>({
      runtime,
      rowSelectionColumn: computed(() => null),
      orderedVisibleColumns: computed(() => []),
      displayRows: ref(rows as never),
      rowSelectionSnapshot: ref(null),
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => null),
      applySelectionRange: () => undefined,
      rowHeaderAction: ref("select-records"),
      resolveProjectionIndexByRowId: rowId => rows.findIndex(row => row.rowId === rowId),
      resolveProjectionRowAtIndex: rowIndex => rows[rowIndex] as never ?? null,
      getProjectionRevision: () => 2,
      acquireInteractionOwner,
    })

    expect(selection.beginRowSelectionSession("r1", "replace")).toBe(true)
    expect(selection.updateRowSelectionSession("r3")).toBe(true)
    expect(selection.isRowCheckboxSelected(rows[0] as never)).toBe(true)
    expect(selection.isRowCheckboxSelected(rows[2] as never)).toBe(true)
    expect(selection.isRowCheckboxSelected(rows[3] as never)).toBe(true)
    expect(setSnapshot).not.toHaveBeenCalled()

    selection.commitRowSelectionSession()

    expect(setSnapshot).toHaveBeenCalledTimes(1)
    expect(setSnapshot).toHaveBeenCalledWith({ focusedRow: "r3", selectedRows: ["r1", "r2", "r3"] })
    expect(releaseOwner).toHaveBeenCalledTimes(1)
  })

  it("cancels a row drag without mutating committed selection", () => {
    const rows = [createRow("r1"), createRow("r2")]
    const { runtime, setSnapshot } = createRuntime(rows)
    const selection = useDataGridTableStageRowSelection<DemoRow>({
      runtime,
      rowSelectionColumn: computed(() => null),
      orderedVisibleColumns: computed(() => []),
      displayRows: ref(rows as never),
      rowSelectionSnapshot: ref(null),
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => null),
      applySelectionRange: () => undefined,
      rowHeaderAction: ref("select-records"),
      resolveProjectionIndexByRowId: rowId => rows.findIndex(row => row.rowId === rowId),
      resolveProjectionRowAtIndex: rowIndex => rows[rowIndex] as never ?? null,
      getProjectionRevision: () => 2,
      acquireInteractionOwner: () => () => undefined,
    })

    selection.beginRowSelectionSession("r1", "replace")
    selection.updateRowSelectionSession("r2")
    selection.cancelRowSelectionSession()

    expect(setSnapshot).not.toHaveBeenCalled()
    expect(selection.isRowCheckboxSelected(rows[0] as never)).toBe(false)
    expect(selection.isRowCheckboxSelected(rows[1] as never)).toBe(false)
  })

  it("applies the selectable-row policy to checkbox, range, and bulk selection", () => {
    const rows = [createRow("r1"), createRow("locked"), createRow("r3")]
    const { runtime, deselectRows, setSelected } = createRuntime(rows)
    const selection = useDataGridTableStageRowSelection<DemoRow>({
      runtime,
      rowSelectionColumn: computed(() => null),
      orderedVisibleColumns: computed(() => []),
      displayRows: ref(rows as never),
      rowSelectionSnapshot: ref(null),
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => null),
      applySelectionRange: () => undefined,
      rowHeaderAction: ref("select-records"),
      isRowSelectable: row => row.rowId !== "locked",
      resolveProjectionIndexByRowId: rowId => rows.findIndex(row => row.rowId === rowId),
      resolveProjectionRowAtIndex: rowIndex => rows[rowIndex] as never ?? null,
      getProjectionRevision: () => 2,
    })

    selection.toggleRowCheckboxSelected(rows[1] as never)
    selection.selectRowRange(rows[0] as never, 0, false)
    selection.selectRowRange(rows[2] as never, 2, true)
    expect(setSelected).not.toHaveBeenCalled()
    expect(runtime.api.rowSelection.setSnapshot).toHaveBeenLastCalledWith({
      focusedRow: "r3",
      selectedRows: ["r1", "r3"],
    })

    selection.toggleVisibleRowsSelected()
    expect(deselectRows).toHaveBeenCalledWith(["r1", "r3"])
  })

  it("keeps the original row-index anchor while Shift crosses back over it", () => {
    const rows = [createRow("r1"), createRow("r2"), createRow("r3"), createRow("r4")]
    const { runtime } = createRuntime(rows)
    const currentRange = ref<{ startRow: number; endRow: number; startColumn: number; endColumn: number } | null>(null)
    const selection = useDataGridTableStageRowSelection<DemoRow>({
      runtime,
      rowSelectionColumn: computed(() => null),
      orderedVisibleColumns: computed(() => [
        createRowSelectionColumn(),
        { key: "left", column: { key: "left", label: "Left" } } as unknown as DataGridColumnSnapshot,
        { key: "pinned", pin: "right", column: { key: "pinned", label: "Pinned" } } as unknown as DataGridColumnSnapshot,
      ]),
      displayRows: ref(rows as never),
      rowSelectionSnapshot: ref(null),
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => currentRange.value ? { rowIndex: currentRange.value.startRow, columnIndex: 0 } : null),
      resolveSelectionRange: () => currentRange.value,
      applySelectionRange: range => { currentRange.value = range },
    })

    selection.selectRowRange(rows[2] as never, 2, false)
    selection.selectRowRange(rows[1] as never, 1, true)
    expect(currentRange.value).toMatchObject({ startRow: 1, endRow: 2, startColumn: 1, endColumn: 2 })
    selection.selectRowRange(rows[2] as never, 2, true)
    expect(currentRange.value).toMatchObject({ startRow: 2, endRow: 2, startColumn: 1, endColumn: 2 })
    selection.selectRowRange(rows[3] as never, 3, true)
    expect(currentRange.value).toMatchObject({ startRow: 2, endRow: 3, startColumn: 1, endColumn: 2 })
    expect(runtime.api.rowSelection.getSnapshot()).toEqual({ focusedRow: null, selectedRows: [] })

    currentRange.value = { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 }
    selection.selectRowRange(rows[1] as never, 1, true)
    expect(currentRange.value).toMatchObject({ startRow: 0, endRow: 1 })
  })

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
    const { runtime, setSnapshot, getCount, get } = createRuntime(filteredRows)
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
    expect(setSnapshot).toHaveBeenCalledWith({
      focusedRow: null,
      selectedRows: [],
      mode: "all",
      excludedRows: [],
    })
    expect(getCount).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
  })

  it("excludes group rows from the header bulk-selection set", () => {
    const filteredRows = [createRow("group-1", "group"), createRow("r1"), createRow("r2")]
    const { runtime, setSnapshot } = createRuntime(filteredRows)
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

    expect(setSnapshot).toHaveBeenCalledWith({
      focusedRow: null,
      selectedRows: [],
      mode: "all",
      excludedRows: [],
    })

    rowSelectionSnapshot.value = {
      focusedRow: null,
      selectedRows: [],
      mode: "all",
      excludedRows: [],
    }

    expect(selection.isRowCheckboxSelected(filteredRows[0] as never)).toBe(false)
    expect(selection.isRowCheckboxSelected(filteredRows[1] as never)).toBe(true)
  })

  it("syncs the snapshot after deselecting all filtered rows", () => {
    const filteredRows = [createRow("r1"), createRow("r2"), createRow("r3")]
    const { runtime } = createRuntime(filteredRows)
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
    expect(runtime.api.rowSelection.clearSelectedRows).toHaveBeenCalledTimes(1)
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

  it("extends checkbox record selection independently of cell ranges", () => {
    const rows = [createRow("r1"), createRow("r2"), createRow("r3")]
    const { runtime, setSnapshot } = createRuntime(rows)
    const applySelectionRange = vi.fn()
    const selection = useDataGridTableStageRowSelection<DemoRow>({
      runtime,
      rowSelectionColumn: computed(() => createRowSelectionColumn()),
      orderedVisibleColumns: computed(() => [
        createRowSelectionColumn(),
        { key: "name", column: { key: "name", label: "Name" } } as unknown as DataGridColumnSnapshot,
      ]),
      displayRows: ref(rows as never),
      rowSelectionSnapshot: ref(null),
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => null),
      applySelectionRange,
      rowHeaderAction: ref("select-cells"),
      resolveProjectionIndexByRowId: rowId => rows.findIndex(row => row.rowId === rowId),
      resolveProjectionRowAtIndex: rowIndex => rows[rowIndex] as never ?? null,
      getProjectionRevision: () => 3,
    })

    selection.toggleRowCheckboxSelected(rows[0] as never)
    selection.selectCheckboxRowRange(rows[2] as never, 2)

    expect(setSnapshot).toHaveBeenCalledWith({ focusedRow: "r3", selectedRows: ["r1", "r2", "r3"] })
    expect(applySelectionRange).not.toHaveBeenCalled()
  })
})
