import { flushPromises, mount } from "@vue/test-utils"
import { nextTick, ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { DataGridColumnSnapshot } from "@affino/datagrid-vue"
import DataGridGanttStage from "../gantt/DataGridGanttStage.vue"
import { normalizeDataGridGanttOptions } from "../gantt/dataGridGantt"
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
    row: { task: `Task ${index + 1}` },
    data: { task: `Task ${index + 1}` },
  })) as any
}

function createGanttRows() {
  return [
    {
      rowId: "row-1",
      displayIndex: 0,
      row: {
        id: "task-1",
        task: "Task 1",
        start: "2026-03-01",
        end: "2026-03-03",
      },
      data: {
        id: "task-1",
        task: "Task 1",
        start: "2026-03-01",
        end: "2026-03-03",
      },
    },
    {
      rowId: "row-2",
      displayIndex: 1,
      row: {
        id: "task-2",
        task: "Task 2",
        start: "2026-03-04",
        end: "2026-03-06",
      },
      data: {
        id: "task-2",
        task: "Task 2",
        start: "2026-03-04",
        end: "2026-03-06",
      },
    },
  ] as any
}

function createTableProps(options?: {
  rowHover?: boolean
  stripedRows?: boolean
  rows?: ReturnType<typeof createRows>
  selectionRange?: { startRow: number; endRow: number; startColumn: number; endColumn: number } | null
  isRowCheckboxSelected?: (row: (ReturnType<typeof createRows>)[number]) => boolean
}): DataGridTableStageProps<DemoRow> {
  const visibleColumns = createColumns()
  const rows = options?.rows ?? createRows(2)
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
      isRowCheckboxSelected: options?.isRowCheckboxSelected as DataGridTableStageProps<DemoRow>["rows"]["isRowCheckboxSelected"],
      toggleGroupRow: () => undefined,
      rowIndexLabel: (_row, rowOffset) => String(rowOffset + 1),
      startRowResize: () => undefined,
      autosizeRow: () => undefined,
    },
    selection: {
      selectionRange: options?.selectionRange ?? null,
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

function createRuntimeWithRows(rows: ReturnType<typeof createRows>) {
  const setSelectionSnapshot = vi.fn()
  const setFocusedRow = vi.fn()
  return {
    api: {
      view: {
        getRowHeightOverride: vi.fn(() => null),
        getRowHeightVersion: vi.fn(() => 0),
      },
      selection: {
        hasSupport: vi.fn(() => true),
        getSnapshot: vi.fn(() => null),
        setSnapshot: setSelectionSnapshot,
        clear: vi.fn(() => undefined),
        summarize: vi.fn(() => null),
      },
      rowSelection: {
        hasSupport: vi.fn(() => true),
        getSnapshot: vi.fn(() => null),
        setSnapshot: vi.fn(() => undefined),
        clear: vi.fn(() => undefined),
        getFocusedRow: vi.fn(() => null),
        setFocusedRow,
        getSelectedRows: vi.fn(() => []),
        isSelected: vi.fn(() => false),
        setSelected: vi.fn(() => undefined),
        selectRows: vi.fn(() => undefined),
        deselectRows: vi.fn(() => undefined),
        clearSelectedRows: vi.fn(() => undefined),
      },
      rows: {
        getCount: vi.fn(() => rows.length),
        get: vi.fn((index: number) => rows[index] ?? null),
        applyEdits: vi.fn(() => false),
      },
    },
    setSelectionSnapshot,
    setFocusedRow,
  } as const
}

function createCanvasRecorder(operations: Array<{
  type: string
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  args: number[]
}>): CanvasRenderingContext2D {
  const recordFillRect = function(this: CanvasRenderingContext2D, ...args: number[]) {
    operations.push({
      type: "fillRect",
      fillStyle: String(this.fillStyle),
      strokeStyle: String(this.strokeStyle),
      lineWidth: this.lineWidth,
      args,
    })
  }
  const recordStroke = function(this: CanvasRenderingContext2D) {
    operations.push({
      type: "stroke",
      fillStyle: String(this.fillStyle),
      strokeStyle: String(this.strokeStyle),
      lineWidth: this.lineWidth,
      args: [],
    })
  }
  return {
    canvas: null,
    fillStyle: "#000000",
    font: "12px sans-serif",
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: "#000000",
    textAlign: "left",
    textBaseline: "alphabetic",
    arc: () => undefined,
    beginPath: () => undefined,
    clearRect: () => undefined,
    clip: () => undefined,
    closePath: () => undefined,
    fill: () => undefined,
    fillRect: recordFillRect,
    fillText: () => undefined,
    lineTo: () => undefined,
    measureText: (text: string) => ({ width: text.length * 7 } as TextMetrics),
    moveTo: () => undefined,
    quadraticCurveTo: () => undefined,
    rect: () => undefined,
    restore: () => undefined,
    save: () => undefined,
    setLineDash: () => undefined,
    setTransform: () => undefined,
    stroke: recordStroke,
  } as unknown as CanvasRenderingContext2D
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

  it("highlights selected table rows in the timeline body", async () => {
    const rows = createGanttRows()
    const table = createTableProps({
      rows,
      selectionRange: {
        startRow: 1,
        endRow: 1,
        startColumn: 0,
        endColumn: 0,
      },
    })
    const stageContext = createDataGridTableStageContext({
      mode: ref(table.mode),
      rowHeightMode: ref(table.rowHeightMode),
      layoutMode: ref("fill"),
      layout: ref(table.layout),
      viewport: ref(table.viewport),
      columns: ref(table.columns),
      rows: ref(table.rows),
      selection: ref(table.selection),
      editing: ref(table.editing),
      cells: ref(table.cells),
      interaction: ref(table.interaction),
    })

    const headerOperations: Array<{ type: string; fillStyle: string; strokeStyle: string; lineWidth: number; args: number[] }> = []
    const bodyOperations: Array<{ type: string; fillStyle: string; strokeStyle: string; lineWidth: number; args: number[] }> = []
    const headerContext = createCanvasRecorder(headerOperations)
    const bodyContext = createCanvasRecorder(bodyOperations)
    const contextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function(contextId: string) {
      if (contextId !== "2d") {
        return null
      }
      return this.className.includes("--body") ? bodyContext : headerContext
    })
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      callback(0)
      return 1
    })

    const wrapper = mount(DataGridGanttStage, {
      props: {
        stageContext,
        runtime: createRuntimeWithRows(rows) as never,
        gantt: normalizeDataGridGanttOptions({
          startKey: "start",
          endKey: "end",
          labelKey: "task",
          idKey: "id",
        }),
        baseRowHeight: 31,
        rowVersion: 0,
      },
      attachTo: document.body,
    })

    await nextTick()
    await flushPromises()

    const stageRoot = wrapper.find(".datagrid-gantt-stage").element as HTMLElement
    const headerShell = wrapper.find(".grid-header-shell").element as HTMLElement
    const tableViewport = wrapper.find(".grid-body-viewport").element as HTMLElement
    const timelineHeaderViewport = wrapper.find(".datagrid-gantt-timeline__viewport--header").element as HTMLElement
    const timelineBodyViewport = wrapper.find(".datagrid-gantt-timeline__viewport--body").element as HTMLElement

    Object.defineProperty(stageRoot, "clientWidth", { configurable: true, value: 920 })
    Object.defineProperty(headerShell, "offsetHeight", { configurable: true, value: 48 })
    Object.defineProperty(headerShell, "clientHeight", { configurable: true, value: 48 })
    Object.defineProperty(tableViewport, "clientHeight", { configurable: true, value: 120 })
    Object.defineProperty(tableViewport, "scrollTop", { configurable: true, writable: true, value: 0 })
    Object.defineProperty(timelineHeaderViewport, "clientWidth", { configurable: true, value: 360 })
    Object.defineProperty(timelineHeaderViewport, "scrollLeft", { configurable: true, writable: true, value: 0 })
    Object.defineProperty(timelineBodyViewport, "clientWidth", { configurable: true, value: 360 })
    Object.defineProperty(timelineBodyViewport, "clientHeight", { configurable: true, value: 120 })
    Object.defineProperty(timelineBodyViewport, "scrollLeft", { configurable: true, writable: true, value: 0 })

    timelineHeaderViewport.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 360,
      bottom: 48,
      width: 360,
      height: 48,
      toJSON: () => ({}),
    }) as DOMRect) as typeof timelineHeaderViewport.getBoundingClientRect
    timelineBodyViewport.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 48,
      left: 0,
      top: 48,
      right: 360,
      bottom: 168,
      width: 360,
      height: 120,
      toJSON: () => ({}),
    }) as DOMRect) as typeof timelineBodyViewport.getBoundingClientRect

    window.dispatchEvent(new Event("resize"))
    await nextTick()
    await flushPromises()
    await nextTick()

    expect(bodyOperations.some(operation => (
      operation.type === "fillRect"
      && operation.args[0] === 0
      && operation.fillStyle === "rgba(37, 99, 235, 0.16)"
      && operation.args[1] === 31
      && operation.args[2] > 0
      && operation.args[3] === 31
    ))).toBe(true)
    expect(bodyOperations.some(operation => (
      operation.type === "stroke"
      && operation.strokeStyle === "rgba(37, 99, 235, 0.68)"
      && operation.lineWidth === 2
    ))).toBe(true)
    expect(bodyOperations.some(operation => (
      operation.type === "stroke"
      && operation.strokeStyle === "rgba(15, 23, 42, 0.84)"
      && operation.lineWidth === 2
    ))).toBe(false)

    contextSpy.mockRestore()
    rafSpy.mockRestore()
    wrapper.unmount()
  })

  it("maps gantt bar clicks back to full-row table selection", async () => {
    const rows = createGanttRows()
    const table = createTableProps({ rows })
    const stageContext = createDataGridTableStageContext({
      mode: ref(table.mode),
      rowHeightMode: ref(table.rowHeightMode),
      layoutMode: ref("fill"),
      layout: ref(table.layout),
      viewport: ref(table.viewport),
      columns: ref(table.columns),
      rows: ref(table.rows),
      selection: ref(table.selection),
      editing: ref(table.editing),
      cells: ref(table.cells),
      interaction: ref(table.interaction),
    })
    const runtime = createRuntimeWithRows(rows)
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      callback(0)
      return 1
    })

    const wrapper = mount(DataGridGanttStage, {
      props: {
        stageContext,
        runtime: runtime as never,
        gantt: normalizeDataGridGanttOptions({
          startKey: "start",
          endKey: "end",
          labelKey: "task",
          idKey: "id",
          timelineStart: "2026-03-01",
          timelineEnd: "2026-03-06",
        }),
        baseRowHeight: 31,
        rowVersion: 0,
      },
      attachTo: document.body,
    })

    await nextTick()
    await flushPromises()

    const stageRoot = wrapper.find(".datagrid-gantt-stage").element as HTMLElement
    const headerShell = wrapper.find(".grid-header-shell").element as HTMLElement
    const tableViewport = wrapper.find(".grid-body-viewport").element as HTMLElement
    const timelineHeaderViewport = wrapper.find(".datagrid-gantt-timeline__viewport--header").element as HTMLElement
    const timelineBodyViewport = wrapper.find(".datagrid-gantt-timeline__viewport--body").element as HTMLElement
    const bodyCanvas = wrapper.find(".datagrid-gantt-timeline__canvas--body").element as HTMLCanvasElement

    Object.defineProperty(stageRoot, "clientWidth", { configurable: true, value: 920 })
    Object.defineProperty(headerShell, "offsetHeight", { configurable: true, value: 48 })
    Object.defineProperty(headerShell, "clientHeight", { configurable: true, value: 48 })
    Object.defineProperty(tableViewport, "clientHeight", { configurable: true, value: 120 })
    Object.defineProperty(tableViewport, "scrollTop", { configurable: true, writable: true, value: 0 })
    Object.defineProperty(timelineHeaderViewport, "clientWidth", { configurable: true, value: 360 })
    Object.defineProperty(timelineHeaderViewport, "scrollLeft", { configurable: true, writable: true, value: 0 })
    Object.defineProperty(timelineBodyViewport, "clientWidth", { configurable: true, value: 360 })
    Object.defineProperty(timelineBodyViewport, "clientHeight", { configurable: true, value: 120 })
    Object.defineProperty(timelineBodyViewport, "scrollLeft", { configurable: true, writable: true, value: 0 })

    timelineHeaderViewport.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 360,
      bottom: 48,
      width: 360,
      height: 48,
      toJSON: () => ({}),
    }) as DOMRect) as typeof timelineHeaderViewport.getBoundingClientRect
    timelineBodyViewport.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 48,
      left: 0,
      top: 48,
      right: 360,
      bottom: 168,
      width: 360,
      height: 120,
      toJSON: () => ({}),
    }) as DOMRect) as typeof timelineBodyViewport.getBoundingClientRect
    bodyCanvas.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 48,
      left: 0,
      top: 48,
      right: 360,
      bottom: 168,
      width: 360,
      height: 120,
      toJSON: () => ({}),
    }) as DOMRect) as typeof bodyCanvas.getBoundingClientRect

    window.dispatchEvent(new Event("resize"))
    await nextTick()
    await flushPromises()
    await nextTick()

    bodyCanvas.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: 5,
      clientY: 63,
      button: 0,
      pointerId: 1,
    }))
    await nextTick()

    expect(runtime.setFocusedRow).toHaveBeenCalledWith("row-1")
    expect(runtime.setSelectionSnapshot).toHaveBeenCalledWith({
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        startRowId: "row-1",
        endRowId: "row-1",
        anchor: {
          rowIndex: 0,
          colIndex: 0,
          rowId: "row-1",
        },
        focus: {
          rowIndex: 0,
          colIndex: 0,
          rowId: "row-1",
        },
      }],
      activeRangeIndex: 0,
      activeCell: {
        rowIndex: 0,
        colIndex: 0,
        rowId: "row-1",
      },
    })

    rafSpy.mockRestore()
    wrapper.unmount()
  })
})