import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridStageCellRendering } from "../useDataGridStageCellRendering"
import type {
  DataGridTableMode,
  DataGridTableRow,
  DataGridTableStageEditingSection,
  DataGridTableStageRowsSection,
} from "../dataGridTableStage.types"
import type { DataGridTableStageBodyColumn } from "../dataGridTableStageBody.types"

function createColumn(partial: Partial<DataGridTableStageBodyColumn>): DataGridTableStageBodyColumn {
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

describe("useDataGridStageCellRendering", () => {
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
      isEditingCellSafe: (row, columnKey) => row.kind === "data" && columnKey === "stage",
      columnIndexByKey: key => visibleColumns.value.findIndex(column => column.key === key),
    })

    const selectColumn = visibleColumns.value[0]!
    expect(renderApi.resolveCellEditorMode({ kind: "data", data: {}, rowId: 1 } as never, selectColumn)).toBe("select")
    expect(renderApi.isSelectEditorCell({ kind: "data", data: {}, rowId: 1 } as never, 0, selectColumn, 0)).toBe(true)
    expect(renderApi.isDateEditorCell({ kind: "data", data: {}, rowId: 1 } as never, 0, visibleColumns.value[1]!, 1)).toBe(false)
    expect(renderApi.resolveDateEditorInputType({ kind: "data", data: {}, rowId: 1 } as never, visibleColumns.value[2]!)).toBe("datetime-local")

    expect(renderApi.resolveSelectEditorOptions({ kind: "data", data: {}, rowId: 1 } as never, selectColumn)).toEqual([])
    renderApi.handleSelectEditorOptionsResolved({ kind: "data", data: {}, rowId: 1 } as never, selectColumn, [
      { value: "planned", label: "Planned" },
      { value: "done", label: "Done" },
    ])
    expect(renderApi.resolveSelectEditorOptions({ kind: "data", data: {}, rowId: 1 } as never, selectColumn)).toEqual([
      { value: "planned", label: "Planned" },
      { value: "done", label: "Done" },
    ])
    expect(renderApi.readResolvedDisplayCell({ kind: "data", data: {}, rowId: 1 } as never, selectColumn)).toBe("Planned")

    const dataRow = { kind: "data", data: { stage: "planned" }, rowId: 1 } as DataGridTableRow<Record<string, unknown>>
    const groupRow = {
      kind: "group",
      rowId: "g1",
      data: {},
      state: { expanded: true },
      groupMeta: { groupKey: "g1", groupField: "group", groupValue: "Group 1", childrenCount: 2 },
    } as DataGridTableRow<Record<string, unknown>>

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
  })
})
