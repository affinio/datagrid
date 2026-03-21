import { flushPromises, mount } from "@vue/test-utils"
import { nextTick, ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { DataGridColumnSnapshot } from "@affino/datagrid-vue"
import DataGridGanttStage from "../gantt/DataGridGanttStage.vue"
import type { DataGridTableStageProps } from "../stage/dataGridTableStage.types"
import { createDataGridTableStageContext } from "../stage/dataGridTableStageContext"

type DemoRow = Record<string, unknown>

function createColumns(): readonly DataGridColumnSnapshot[] {
  return [
    { key: "task", pin: "center", width: 180, column: { key: "task", label: "Task" } },
  ] as unknown as readonly DataGridColumnSnapshot[]
}

function createRows(count = 2) {
  return Array.from({ length: count }, (_unused, index) => ({
    rowId: `row-${index + 1}`,
    displayIndex: index,
    data: { task: `Task ${index + 1}` },
  })) as any
}

function createTableProps(options?: { rowHover?: boolean; stripedRows?: boolean }): DataGridTableStageProps<DemoRow> {
  const visibleColumns = createColumns()
  const rows = createRows(2)
  return {
    mode: "base",
    rowHeightMode: "fixed",
    layout: {
      gridContentStyle: { width: "180px", minWidth: "180px" },
      mainTrackStyle: { width: "180px", minWidth: "180px" },
      indexColumnStyle: { width: "72px", minWidth: "72px", maxWidth: "72px" },
      columnStyle: () => ({ width: "180px", minWidth: "180px", maxWidth: "180px" }),
    },
    viewport: {
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
      viewportRowStart: 0,
      columnWindowStart: 0,
      leftColumnSpacerWidth: 0,
      rightColumnSpacerWidth: 0,
      headerViewportRef: () => undefined,
      bodyViewportRef: () => undefined,
      handleHeaderWheel: () => undefined,
      handleHeaderScroll: () => undefined,
      handleViewportScroll: () => undefined,
      handleViewportKeydown: () => undefined,
    },
    columns: {
      visibleColumns,
      renderedColumns: visibleColumns,
      columnFilterTextByKey: {},
      toggleSortForColumn: () => undefined,
      sortIndicator: () => "",
      setColumnFilterText: () => undefined,
      startResize: () => undefined,
      handleResizeDoubleClick: () => undefined,
    },
    rows: {
      displayRows: rows,
      pinnedBottomRows: [],
      showRowIndex: true,
      rowHover: options?.rowHover ?? false,
      stripedRows: options?.stripedRows ?? false,
      rowClass: () => "",
      isRowAutosizeProbe: () => false,
      rowStyle: () => ({ height: "31px", minHeight: "31px" }),
      toggleGroupRow: () => undefined,
      rowIndexLabel: (_row, rowOffset) => String(rowOffset + 1),
      startRowResize: () => undefined,
      autosizeRow: () => undefined,
    },
    selection: {
      selectionRange: null,
      selectionAnchorCell: null,
      fillPreviewRange: null,
      rangeMovePreviewRange: null,
      isFillDragging: false,
      isRangeMoving: false,
      fillActionAnchorCell: null,
      fillActionBehavior: null,
      applyFillActionBehavior: () => undefined,
      isFillHandleCell: () => false,
      startFillHandleDrag: () => undefined,
      startFillHandleDoubleClick: () => undefined,
    },
    editing: {
      editingCellValue: "",
      editingCellInitialFilter: "",
      editingCellOpenOnMount: false,
      isEditingCell: () => false,
      startInlineEdit: () => undefined,
      updateEditingCellValue: () => undefined,
      handleEditorKeydown: () => undefined,
      commitInlineEdit: () => undefined,
      cancelInlineEdit: () => undefined,
    },
    cells: {
      isCellSelected: () => false,
      isSelectionAnchorCell: () => false,
      shouldHighlightSelectedCell: () => false,
      isCellOnSelectionEdge: () => false,
      isCellInFillPreview: () => false,
      isCellInPendingClipboardRange: () => false,
      isCellOnPendingClipboardEdge: () => false,
      isCellEditable: () => true,
      readCell: (row, columnKey) => String((row.data as Record<string, unknown>)[columnKey] ?? ""),
      readDisplayCell: (row, columnKey) => String((row.data as Record<string, unknown>)[columnKey] ?? ""),
    },
    interaction: {
      handleCellMouseDown: () => undefined,
      handleCellClick: () => undefined,
      handleCellKeydown: () => undefined,
    },
  }
}

function createRuntime() {
  return {
    api: {
      view: {
        getRowHeightOverride: vi.fn(() => null),
        getRowHeightVersion: vi.fn(() => 0),
      },
      rows: {
        getCount: vi.fn(() => 0),
        get: vi.fn(() => null),
        applyEdits: vi.fn(() => false),
      },
    },
  } as const
}

describe("DataGridGanttStage contract", () => {
  it("renders the embedded table stage from the required stageContext", async () => {
    const table = createTableProps({ rowHover: false, stripedRows: false })
    const stageContext = createDataGridTableStageContext({
      mode: ref(table.mode),
      rowHeightMode: ref(table.rowHeightMode),
      layoutMode: ref("fill"),
      layout: ref(table.layout),
      viewport: ref(table.viewport),
      columns: ref(table.columns),
      rows: ref({
        ...table.rows,
        rowHover: true,
        stripedRows: true,
      }),
      selection: ref(table.selection),
      editing: ref(table.editing),
      cells: ref(table.cells),
      interaction: ref(table.interaction),
    })

    const wrapper = mount(DataGridGanttStage, {
      props: {
        stageContext,
        runtime: createRuntime() as never,
        gantt: null,
        baseRowHeight: 31,
        rowVersion: 0,
      },
      attachTo: document.body,
    })

    await nextTick()
    await flushPromises()
    await nextTick()

    const rows = wrapper.findAll(".grid-row")
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]?.classes()).toContain("grid-row--hoverable")
    expect(rows[1]?.classes()).toContain("grid-row--striped")

    wrapper.unmount()
  })
})