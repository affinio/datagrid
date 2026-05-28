import { ref } from "vue"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useDataGridStageCellRendering } from "../useDataGridStageCellRendering"
import {
  DATA_GRID_PERF_STORE_KEY,
  resolveDataGridPerfStore,
} from "../../perf/dataGridPerfTrace"
import type {
  DataGridTableMode,
  DataGridTableRow,
  DataGridTableStageEditingSection,
  DataGridTableStageRowsSection,
} from "../dataGridTableStage.types"
import type { DataGridTableStageBodyColumn } from "../dataGridTableStageBody.types"

function createColumn(
  partial: Partial<Omit<DataGridTableStageBodyColumn, "column">> & {
    column?: Partial<DataGridTableStageBodyColumn["column"]>
  },
): DataGridTableStageBodyColumn {
  return {
    key: partial.key ?? "value",
    width: partial.width ?? 120,
    pin: partial.pin ?? "center",
    column: {
      key: partial.key ?? "value",
      label: partial.key ?? "Value",
      ...partial.column,
    },
  } as DataGridTableStageBodyColumn
}

function createRow(
  partial: Partial<Omit<DataGridTableRow<Record<string, unknown>>, "state">> & {
    state?: Partial<DataGridTableRow<Record<string, unknown>>["state"]>
  } = {},
): DataGridTableRow<Record<string, unknown>> {
  const displayIndex = partial.displayIndex ?? 0
  const rowId = partial.rowId ?? `r${displayIndex + 1}`
  const data = partial.data ?? {}
  return {
    kind: "leaf",
    data,
    row: data,
    rowKey: rowId,
    rowId,
    sourceIndex: displayIndex,
    originalIndex: displayIndex,
    displayIndex,
    ...partial,
    state: { selected: false, group: partial.kind === "group", pinned: "none", expanded: false, ...partial.state },
  }
}

describe("useDataGridStageCellRendering", () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>)[DATA_GRID_PERF_STORE_KEY]
  })

  it("resolves editor modes, cached select options, and renderer output", async () => {
    const mode = ref<DataGridTableMode>("base")
    const visibleColumns = ref<readonly DataGridTableStageBodyColumn[]>([
      createColumn({
        key: "stage",
        column: {
          cellType: "select",
          capabilities: { editable: true },
          presentation: {
            options: async () => [
              { value: "planned", label: "Planned" },
              { value: "done", label: "Done" },
            ],
          },
        },
      }),
      createColumn({
        key: "createdAt",
        column: {
          cellType: "date",
          capabilities: { editable: true },
        },
      }),
      createColumn({
        key: "updatedAt",
        column: {
          cellType: "datetime",
          capabilities: { editable: true },
        },
      }),
    ])
    const rows = ref<Readonly<DataGridTableStageRowsSection<Record<string, unknown>>>>({
      displayRows: [],
      pinnedBottomRows: [],
      rowClass: () => "",
      rowStyle: () => ({}),
      toggleGroupRow: vi.fn(),
    } as unknown as DataGridTableStageRowsSection<Record<string, unknown>>)
    const editing = ref({
      startInlineEdit: vi.fn(),
      updateEditingCellValue: vi.fn(),
      commitInlineEdit: vi.fn(),
      cancelInlineEdit: vi.fn(),
      handleEditorKeydown: vi.fn(),
      handleEditorBlur: vi.fn(),
    } as unknown as DataGridTableStageEditingSection<Record<string, unknown>>)
    const cellRenderer = vi.fn(({ displayValue }) => `cell:${displayValue}`)
    const groupRenderer = vi.fn(({ displayValue }) => `group:${displayValue}`)
    const cells = ref({
      readCell: (_row: DataGridTableRow<Record<string, unknown>>, columnKey: string) => (
        columnKey === "stage" ? "planned" : "2026-03-22"
      ),
      readDisplayCell: (_row: DataGridTableRow<Record<string, unknown>>, columnKey: string) => (
        columnKey === "stage" ? "Planned" : "2026-03-22"
      ),
    })

    const renderApi = useDataGridStageCellRendering({
      mode,
      visibleColumns,
      rows,
      cells,
      editing,
      isCellEditableSafe: () => true,
      isEditingCellSafe: (row, columnKey) => row.kind === "leaf" && columnKey === "stage",
      columnIndexByKey: key => visibleColumns.value.findIndex(column => column.key === key),
    })

    const selectColumn = visibleColumns.value[0]!
    const row = createRow({ rowId: 1 })
    expect(renderApi.resolveCellEditorMode(row, selectColumn)).toBe("select")
    expect(renderApi.isSelectEditorCell(row, 0, selectColumn, 0)).toBe(true)
    expect(renderApi.isDateEditorCell(row, 0, visibleColumns.value[1]!, 1)).toBe(false)
    expect(renderApi.resolveDateEditorInputType(row, visibleColumns.value[2]!)).toBe("datetime-local")

    expect(renderApi.resolveSelectEditorOptions(row, selectColumn)).toEqual([])
    renderApi.handleSelectEditorOptionsResolved(row, selectColumn, [
      { value: "planned", label: "Planned" },
      { value: "done", label: "Done" },
    ])
    expect(renderApi.resolveSelectEditorOptions(row, selectColumn)).toEqual([
      { value: "planned", label: "Planned" },
      { value: "done", label: "Done" },
    ])
    expect(renderApi.readResolvedDisplayCell(row, selectColumn)).toBe("Planned")

    const dataRow = createRow({ data: { stage: "planned" }, row: { stage: "planned" }, rowId: 1 })
    const groupRow = createRow({
      kind: "group",
      rowId: "g1",
      data: {},
      row: {},
      state: { expanded: true },
      groupMeta: { groupKey: "g1", groupField: "group", groupValue: "Group 1", level: 0, childrenCount: 2 },
    })

    const renderedCell = renderApi.renderResolvedCellContent(dataRow, 0, {
      ...selectColumn,
      column: {
        ...selectColumn.column,
        cellRenderer,
        groupCellRenderer: groupRenderer,
      },
    }, 0)
    expect(String(renderedCell)).toBe("cell:Planned")
    expect(cellRenderer).toHaveBeenCalled()

    const renderedGroupCell = renderApi.renderResolvedCellContent(groupRow, 0, {
      ...selectColumn,
      column: {
        ...selectColumn.column,
        cellRenderer,
        groupCellRenderer: groupRenderer,
      },
    }, 0)
    expect(String(renderedGroupCell)).toBe("group:Planned")
    expect(groupRenderer).toHaveBeenCalled()

    const inlineEditEvent = new MouseEvent("dblclick", { cancelable: true })
    renderApi.startInlineEditIfAllowed(dataRow, selectColumn, 0, inlineEditEvent)
    expect(inlineEditEvent.defaultPrevented).toBe(true)
    expect(editing.value.startInlineEdit).toHaveBeenCalledWith(
      dataRow,
      "stage",
      { openOnMount: true },
    )

    const touchInlineEditEvent = new MouseEvent("dblclick", { cancelable: true })
    Object.defineProperty(touchInlineEditEvent, "sourceCapabilities", {
      configurable: true,
      value: { firesTouchEvents: true },
    })
    renderApi.startInlineEditIfAllowed(dataRow, selectColumn, 0, touchInlineEditEvent)
    expect(touchInlineEditEvent.defaultPrevented).toBe(true)
    expect(editing.value.startInlineEdit).toHaveBeenLastCalledWith(
      dataRow,
      "stage",
      { openOnMount: true },
    )

    const scrollingRenderApi = useDataGridStageCellRendering({
      mode,
      visibleColumns,
      rows,
      cells,
      editing,
      isCellEditableSafe: () => true,
      isEditingCellSafe: () => false,
      columnIndexByKey: key => visibleColumns.value.findIndex(column => column.key === key),
      suppressInlineEditStart: ref(true),
    })
    vi.mocked(editing.value.startInlineEdit).mockClear()

    const suppressedInlineEditEvent = new MouseEvent("dblclick", { cancelable: true })
    scrollingRenderApi.startInlineEditIfAllowed(dataRow, selectColumn, 0, suppressedInlineEditEvent)

    expect(suppressedInlineEditEvent.defaultPrevented).toBe(false)
    expect(editing.value.startInlineEdit).not.toHaveBeenCalled()
    expect(resolveDataGridPerfStore()?.latest("cellRenderer")).toBeNull()
  })

  it("records custom renderer telemetry only when perf tracing is enabled", () => {
    const mode = ref<DataGridTableMode>("base")
    const visibleColumns = ref<readonly DataGridTableStageBodyColumn[]>([
      createColumn({ key: "stage" }),
    ])
    const rows = ref<Readonly<DataGridTableStageRowsSection<Record<string, unknown>>>>({
      displayRows: [],
      pinnedBottomRows: [],
      rowClass: () => "",
      rowStyle: () => ({}),
      toggleGroupRow: vi.fn(),
    } as unknown as DataGridTableStageRowsSection<Record<string, unknown>>)
    const editing = ref({
      startInlineEdit: vi.fn(),
      updateEditingCellValue: vi.fn(),
      commitInlineEdit: vi.fn(),
      cancelInlineEdit: vi.fn(),
      handleEditorKeydown: vi.fn(),
      handleEditorBlur: vi.fn(),
    } as unknown as DataGridTableStageEditingSection<Record<string, unknown>>)
    const cells = ref({
      readCell: () => "planned",
      readDisplayCell: () => "Planned",
    })
    const cellRenderer = vi.fn(({ displayValue }) => `cell:${displayValue}`)
    const groupRenderer = vi.fn(({ displayValue }) => `group:${displayValue}`)
    const renderApi = useDataGridStageCellRendering({
      mode,
      visibleColumns,
      rows,
      cells,
      editing,
      isCellEditableSafe: () => true,
      isEditingCellSafe: () => false,
      columnIndexByKey: key => visibleColumns.value.findIndex(column => column.key === key),
      perfTraceEnabled: true,
    })

    const column = {
      ...visibleColumns.value[0]!,
      column: {
        ...visibleColumns.value[0]!.column,
        cellRenderer,
        groupCellRenderer: groupRenderer,
      },
    }
    const dataRow = createRow({ data: { stage: "planned" }, row: { stage: "planned" }, rowId: "r1" })
    const groupRow = createRow({
      kind: "group",
      rowId: "g1",
      data: {},
      row: {},
      state: { expanded: false },
      groupMeta: { groupKey: "g1", groupField: "group", groupValue: "Group 1", level: 0, childrenCount: 2 },
    })

    expect(String(renderApi.renderResolvedCellContent(dataRow, 0, column, 0))).toBe("cell:Planned")
    expect(String(renderApi.renderResolvedCellContent(groupRow, 1, column, 0))).toBe("group:Planned")

    expect(resolveDataGridPerfStore()?.latest("cellRenderer")).toMatchObject({
      scope: "cellRenderer",
      rowOffset: 0,
      columnIndex: 0,
      surfaceKind: "real",
      rowKind: "leaf",
      columnKey: "stage",
    })
    expect(resolveDataGridPerfStore()?.latest("groupCellRenderer")).toMatchObject({
      scope: "groupCellRenderer",
      rowOffset: 1,
      columnIndex: 0,
      surfaceKind: "real",
      rowKind: "group",
      columnKey: "stage",
    })
  })

  it("keeps custom renderers active without disabling editor or placeholder contracts", () => {
    const mode = ref<DataGridTableMode>("base")
    const visibleColumns = ref<readonly DataGridTableStageBodyColumn[]>([
      createColumn({
        key: "stage",
        column: {
          cellType: "select",
          capabilities: { editable: true },
        },
      }),
    ])
    const rows = ref<Readonly<DataGridTableStageRowsSection<Record<string, unknown>>>>({
      displayRows: [],
      pinnedBottomRows: [],
      rowClass: () => "",
      rowStyle: () => ({}),
      toggleGroupRow: vi.fn(),
    } as unknown as DataGridTableStageRowsSection<Record<string, unknown>>)
    const editing = ref({
      startInlineEdit: vi.fn(),
      updateEditingCellValue: vi.fn(),
      commitInlineEdit: vi.fn(),
      cancelInlineEdit: vi.fn(),
      handleEditorKeydown: vi.fn(),
      handleEditorBlur: vi.fn(),
    } as unknown as DataGridTableStageEditingSection<Record<string, unknown>>)
    const cells = ref({
      readCell: () => "planned",
      readDisplayCell: () => "Planned",
    })
    const cellRenderer = vi.fn(({ displayValue }) => `cell:${displayValue}`)
    const groupRenderer = vi.fn(({ displayValue }) => `group:${displayValue}`)
    const renderApi = useDataGridStageCellRendering({
      mode,
      visibleColumns,
      rows,
      cells,
      editing,
      isCellEditableSafe: () => true,
      isEditingCellSafe: (row, columnKey) => row.kind === "leaf" && columnKey === "stage",
      columnIndexByKey: key => visibleColumns.value.findIndex(column => column.key === key),
    })

    const column = {
      ...visibleColumns.value[0]!,
      column: {
        ...visibleColumns.value[0]!.column,
        cellRenderer,
        groupCellRenderer: groupRenderer,
      },
    }
    const dataRow = createRow({ data: { stage: "planned" }, row: { stage: "planned" }, rowId: "r1" })
    const groupRow = createRow({
      kind: "group",
      rowId: "g1",
      data: {},
      row: {},
      state: { expanded: false },
      groupMeta: { groupKey: "g1", groupField: "group", groupValue: "Group 1", level: 0, childrenCount: 2 },
    })
    const placeholderRow = createRow({
      rowId: "__datagrid_placeholder__:2",
      data: {},
      row: {},
      displayIndex: 2,
    }) as DataGridTableRow<Record<string, unknown>> & { __placeholder: true }
    placeholderRow.__placeholder = true

    expect(renderApi.isSelectEditorCell(dataRow, 0, column, 0)).toBe(true)
    expect(String(renderApi.renderResolvedCellContent(dataRow, 0, column, 0))).toBe("cell:Planned")
    expect(String(renderApi.renderResolvedCellContent(groupRow, 1, column, 0))).toBe("group:Planned")
    expect(String(renderApi.renderResolvedCellContent(placeholderRow, 2, column, 0))).toBe("cell:Planned")
    expect(cellRenderer).toHaveBeenCalledTimes(2)
    expect(groupRenderer).toHaveBeenCalledTimes(1)
  })

  it("resolves editor mode without reading row values", () => {
    const mode = ref<DataGridTableMode>("base")
    const accessor = vi.fn(() => "planned")
    const visibleColumns = ref<readonly DataGridTableStageBodyColumn[]>([
      createColumn({
        key: "stage",
        column: {
          cellType: "select",
          accessor,
        },
      }),
    ])
    const rows = ref<Readonly<DataGridTableStageRowsSection<Record<string, unknown>>>>({
      displayRows: [],
      pinnedBottomRows: [],
      rowClass: () => "",
      rowStyle: () => ({}),
      toggleGroupRow: vi.fn(),
    } as unknown as DataGridTableStageRowsSection<Record<string, unknown>>)
    const editing = ref({
      startInlineEdit: vi.fn(),
      updateEditingCellValue: vi.fn(),
      commitInlineEdit: vi.fn(),
      cancelInlineEdit: vi.fn(),
      handleEditorKeydown: vi.fn(),
      handleEditorBlur: vi.fn(),
    } as unknown as DataGridTableStageEditingSection<Record<string, unknown>>)
    const cells = ref({
      readCell: () => "planned",
      readDisplayCell: () => "Planned",
    })
    const renderApi = useDataGridStageCellRendering({
      mode,
      visibleColumns,
      rows,
      cells,
      editing,
      isCellEditableSafe: () => true,
      isEditingCellSafe: () => false,
      columnIndexByKey: key => visibleColumns.value.findIndex(column => column.key === key),
    })

    expect(renderApi.resolveCellEditorMode(createRow({ data: { stage: "planned" } }), visibleColumns.value[0]!)).toBe("select")
    expect(accessor).not.toHaveBeenCalled()
  })

  it("skips editability work for inactive editors and non-interactive renderers", () => {
    const mode = ref<DataGridTableMode>("base")
    const cellRenderer = vi.fn(({ interactive }) => `cell:${interactive ? "interactive" : "plain"}`)
    const visibleColumns = ref<readonly DataGridTableStageBodyColumn[]>([
      createColumn({ key: "plain" }),
      createColumn({
        key: "rendered",
        column: {
          cellRenderer,
        },
      }),
    ])
    const rows = ref<Readonly<DataGridTableStageRowsSection<Record<string, unknown>>>>({
      displayRows: [],
      pinnedBottomRows: [],
      rowClass: () => "",
      rowStyle: () => ({}),
      toggleGroupRow: vi.fn(),
    } as unknown as DataGridTableStageRowsSection<Record<string, unknown>>)
    const editing = ref({
      startInlineEdit: vi.fn(),
      updateEditingCellValue: vi.fn(),
      commitInlineEdit: vi.fn(),
      cancelInlineEdit: vi.fn(),
      handleEditorKeydown: vi.fn(),
      handleEditorBlur: vi.fn(),
    } as unknown as DataGridTableStageEditingSection<Record<string, unknown>>)
    const cells = ref({
      readCell: (_row: DataGridTableRow<Record<string, unknown>>, columnKey: string) => columnKey,
      readDisplayCell: (_row: DataGridTableRow<Record<string, unknown>>, columnKey: string) => (
        columnKey === "plain" ? "Plain" : "Rendered"
      ),
    })
    const isCellEditableSafe = vi.fn(() => true)
    const renderApi = useDataGridStageCellRendering({
      mode,
      visibleColumns,
      rows,
      cells,
      editing,
      isCellEditableSafe,
      isEditingCellSafe: () => false,
      columnIndexByKey: key => visibleColumns.value.findIndex(column => column.key === key),
    })
    const row = createRow({ data: { plain: "Plain", rendered: "Rendered" } })
    const plainColumn = visibleColumns.value[0]!
    const renderedColumn = visibleColumns.value[1]!

    expect(renderApi.isSelectEditorCell(row, 0, plainColumn, 0)).toBe(false)
    expect(renderApi.isDateEditorCell(row, 0, plainColumn, 0)).toBe(false)
    expect(renderApi.isTextEditorCell(row, 0, plainColumn, 0)).toBe(false)
    expect(renderApi.renderResolvedCellContent(row, 0, plainColumn, 0)).toBe("Plain")
    expect(String(renderApi.renderResolvedCellContent(row, 0, renderedColumn, 1))).toBe("cell:plain")
    expect(isCellEditableSafe).not.toHaveBeenCalled()
  })

  it("falls back to display values when custom renderers throw", () => {
    const mode = ref<DataGridTableMode>("base")
    const visibleColumns = ref<readonly DataGridTableStageBodyColumn[]>([
      createColumn({ key: "stage" }),
    ])
    const rows = ref<Readonly<DataGridTableStageRowsSection<Record<string, unknown>>>>({
      displayRows: [],
      pinnedBottomRows: [],
      rowClass: () => "",
      rowStyle: () => ({}),
      toggleGroupRow: vi.fn(),
    } as unknown as DataGridTableStageRowsSection<Record<string, unknown>>)
    const editing = ref({
      startInlineEdit: vi.fn(),
      updateEditingCellValue: vi.fn(),
      commitInlineEdit: vi.fn(),
      cancelInlineEdit: vi.fn(),
      handleEditorKeydown: vi.fn(),
      handleEditorBlur: vi.fn(),
    } as unknown as DataGridTableStageEditingSection<Record<string, unknown>>)
    const cells = ref({
      readCell: () => "planned",
      readDisplayCell: () => "Planned",
    })
    const surfaceKinds: string[] = []
    const throwingCellRenderer = vi.fn(({ surface }) => {
      surfaceKinds.push(surface.kind)
      throw new Error("cell renderer failed")
    })
    const throwingGroupRenderer = vi.fn(({ group, surface }) => {
      surfaceKinds.push(surface.kind)
      expect(group.isLabelColumn).toBe(true)
      throw new Error("group renderer failed")
    })
    const renderApi = useDataGridStageCellRendering({
      mode,
      visibleColumns,
      rows,
      cells,
      editing,
      isCellEditableSafe: () => true,
      isEditingCellSafe: () => false,
      columnIndexByKey: key => visibleColumns.value.findIndex(column => column.key === key),
    })

    const column = {
      ...visibleColumns.value[0]!,
      column: {
        ...visibleColumns.value[0]!.column,
        cellRenderer: throwingCellRenderer,
        groupCellRenderer: throwingGroupRenderer,
      },
    }
    const dataRow = createRow({ data: { stage: "planned" }, row: { stage: "planned" }, rowId: "r1" })
    const groupRow = createRow({
      kind: "group",
      rowId: "g1",
      data: {},
      row: {},
      state: { expanded: false },
      groupMeta: { groupKey: "g1", groupField: "group", groupValue: "Group 1", level: 0, childrenCount: 2 },
    })
    const placeholderRow = createRow({
      rowId: "__datagrid_placeholder__:2",
      data: {},
      row: {},
      displayIndex: 2,
    }) as DataGridTableRow<Record<string, unknown>> & { __placeholder: true }
    placeholderRow.__placeholder = true

    expect(String(renderApi.renderResolvedCellContent(dataRow, 0, column, 0))).toBe("Planned")
    expect(String(renderApi.renderResolvedCellContent(groupRow, 1, column, 0))).toBe("Planned")
    expect(String(renderApi.renderResolvedCellContent(placeholderRow, 2, column, 0))).toBe("Planned")
    expect(surfaceKinds).toEqual(["real", "real", "placeholder"])

    const tracedRenderApi = useDataGridStageCellRendering({
      mode,
      visibleColumns,
      rows,
      cells,
      editing,
      isCellEditableSafe: () => true,
      isEditingCellSafe: () => false,
      columnIndexByKey: key => visibleColumns.value.findIndex(column => column.key === key),
      perfTraceEnabled: true,
    })
    expect(String(tracedRenderApi.renderResolvedCellContent(dataRow, 0, column, 0))).toBe("Planned")
    expect(resolveDataGridPerfStore()?.latest("cellRenderer")).toMatchObject({
      scope: "cellRenderer",
      rowKind: "leaf",
      rendererError: 1,
    })
  })
})
