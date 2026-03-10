import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it } from "vitest"
import type { DataGridColumnSnapshot } from "@affino/datagrid-vue"
import type { DataGridTableRow, DataGridTableStageProps } from "../dataGridTableStage.types"
import DataGridTableStage from "../DataGridTableStage.vue"

type DemoRow = Record<string, unknown>

function createColumns(): readonly DataGridColumnSnapshot[] {
  return [
    { key: "left", pin: "left", width: 80, column: { key: "left", label: "Left" } },
    { key: "centerA", pin: "center", width: 120, column: { key: "centerA", label: "Center A" } },
    { key: "centerB", pin: "center", width: 130, column: { key: "centerB", label: "Center B" } },
    { key: "right", pin: "right", width: 90, column: { key: "right", label: "Right" } },
  ] as unknown as readonly DataGridColumnSnapshot[]
}

function createRows(): readonly DataGridTableRow<DemoRow>[] {
  return [
    {
      rowId: "r1",
      data: {
        left: "L1",
        centerA: "A1",
        centerB: "B1",
        right: "R1",
      },
    },
  ] as unknown as readonly DataGridTableRow<DemoRow>[]
}

function createStageProps(
  isCellSelected: (rowOffset: number, columnIndex: number) => boolean,
): DataGridTableStageProps<DemoRow> {
  const visibleColumns = createColumns()
  const renderedColumns = visibleColumns.filter(column => column.pin !== "left" && column.pin !== "right")
  const rows = createRows()

  return {
    mode: "base",
    rowHeightMode: "fixed",
    visibleColumns,
    renderedColumns,
    displayRows: rows,
    columnFilterTextByKey: {},
    gridContentStyle: { width: "250px", minWidth: "250px" },
    mainTrackStyle: { width: "250px", minWidth: "250px" },
    indexColumnStyle: { width: "72px", minWidth: "72px", maxWidth: "72px", left: "0px" },
    topSpacerHeight: 0,
    bottomSpacerHeight: 0,
    viewportRowStart: 0,
    columnWindowStart: 0,
    leftColumnSpacerWidth: 0,
    rightColumnSpacerWidth: 0,
    editingCellValue: "",
    headerViewportRef: () => undefined,
    bodyViewportRef: () => undefined,
    columnStyle: key => {
      const column = visibleColumns.find(candidate => candidate.key === key)
      const width = `${column?.width ?? 140}px`
      return { width, minWidth: width, maxWidth: width }
    },
    toggleSortForColumn: () => undefined,
    sortIndicator: () => "",
    setColumnFilterText: () => undefined,
    handleHeaderWheel: () => undefined,
    handleHeaderScroll: () => undefined,
    handleViewportScroll: () => undefined,
    handleViewportKeydown: () => undefined,
    rowClass: () => "",
    isRowAutosizeProbe: () => false,
    rowStyle: () => ({ height: "31px", minHeight: "31px" }),
    toggleGroupRow: () => undefined,
    rowIndexLabel: () => "1",
    startResize: () => undefined,
    handleResizeDoubleClick: () => undefined,
    startRowResize: () => undefined,
    autosizeRow: () => undefined,
    isCellSelected,
    isSelectionAnchorCell: (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
    shouldHighlightSelectedCell: (rowOffset, columnIndex) => isCellSelected(rowOffset, columnIndex) && !(rowOffset === 0 && columnIndex === 0),
    isCellOnSelectionEdge: () => false,
    isCellInFillPreview: () => false,
    isCellInPendingClipboardRange: () => false,
    isCellOnPendingClipboardEdge: () => false,
    isEditingCell: () => false,
    handleCellMouseDown: () => undefined,
    handleCellKeydown: () => undefined,
    startInlineEdit: () => undefined,
    isFillHandleCell: () => false,
    startFillHandleDrag: () => undefined,
    updateEditingCellValue: () => undefined,
    handleEditorKeydown: () => undefined,
    commitInlineEdit: () => undefined,
    readCell: (row, columnKey) => String((row.data as Record<string, unknown>)[columnKey] ?? ""),
  }
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("DataGridTableStage contract", () => {
  it("keeps overlay borders visually continuous across left, center and right panes", () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps((rowOffset, columnIndex) => rowOffset === 0 && columnIndex >= 0 && columnIndex <= 3),
    })

    const leftSegment = wrapper.find(".grid-body-pane--left .grid-selection-overlay__segment")
    const centerSegment = wrapper.find(".grid-body-viewport .grid-selection-overlay__segment")
    const rightSegment = wrapper.find(".grid-body-pane--right .grid-selection-overlay__segment")

    expect(leftSegment.exists()).toBe(true)
    expect(centerSegment.exists()).toBe(true)
    expect(rightSegment.exists()).toBe(true)
    expect(leftSegment.attributes("style")).toContain("border-right-width: 0px;")
    expect(centerSegment.attributes("style")).toContain("border-left-width: 0px;")
    expect(centerSegment.attributes("style")).toContain("border-right-width: 0px;")
    expect(rightSegment.attributes("style")).toContain("border-left-width: 0px;")

    wrapper.unmount()
  })

  it("keeps center-to-right selection continuous without creating a fake left segment", () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps((rowOffset, columnIndex) => rowOffset === 0 && columnIndex >= 2 && columnIndex <= 3),
    })

    expect(wrapper.find(".grid-body-pane--left .grid-selection-overlay__segment").exists()).toBe(false)

    const centerSegment = wrapper.find(".grid-body-viewport .grid-selection-overlay__segment")
    const rightSegment = wrapper.find(".grid-body-pane--right .grid-selection-overlay__segment")

    expect(centerSegment.exists()).toBe(true)
    expect(rightSegment.exists()).toBe(true)
    expect(centerSegment.attributes("style")).toContain("border-right-width: 0px;")
    expect(rightSegment.attributes("style")).toContain("border-left-width: 0px;")

    wrapper.unmount()
  })
})
