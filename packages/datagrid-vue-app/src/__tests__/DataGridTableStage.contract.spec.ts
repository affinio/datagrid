import { mount } from "@vue/test-utils"
import { nextTick } from "vue"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DataGridColumnSnapshot, DataGridOverlayRange } from "@affino/datagrid-vue"
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
  options?: {
    selectionRange?: DataGridOverlayRange | null
    fillPreviewRange?: DataGridOverlayRange | null
    rangeMovePreviewRange?: DataGridOverlayRange | null
    isRangeMoving?: boolean
    isCellInFillPreview?: (rowOffset: number, columnIndex: number) => boolean
    isFillHandleCell?: (rowOffset: number, columnIndex: number) => boolean
    startFillHandleDrag?: () => void
  },
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
    selectionRange: options?.selectionRange ?? { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
    fillPreviewRange: options?.fillPreviewRange ?? null,
    rangeMovePreviewRange: options?.rangeMovePreviewRange ?? null,
    isRangeMoving: options?.isRangeMoving ?? false,
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
    isCellInFillPreview: options?.isCellInFillPreview ?? (() => false),
    isCellInPendingClipboardRange: () => false,
    isCellOnPendingClipboardEdge: () => false,
    isEditingCell: () => false,
    handleCellMouseDown: () => undefined,
    handleCellKeydown: () => undefined,
    startInlineEdit: () => undefined,
    isFillHandleCell: options?.isFillHandleCell ?? (() => false),
    startFillHandleDrag: options?.startFillHandleDrag ?? (() => undefined),
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
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex >= 0 && columnIndex <= 3,
        {
          selectionRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 3 },
        },
      ),
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
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex >= 2 && columnIndex <= 3,
        {
          selectionRange: { startRow: 0, endRow: 0, startColumn: 2, endColumn: 3 },
        },
      ),
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

  it("renders a continuous move-preview overlay from center into pinned-right", () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex >= 1 && columnIndex <= 2,
        {
          selectionRange: { startRow: 0, endRow: 0, startColumn: 1, endColumn: 2 },
          rangeMovePreviewRange: { startRow: 0, endRow: 0, startColumn: 2, endColumn: 3 },
          isRangeMoving: true,
        },
      ),
    })

    expect(wrapper.classes()).toContain("grid-stage--range-moving")

    const centerSegment = wrapper.find(".grid-body-viewport .grid-selection-overlay__segment--move-preview")
    const rightSegment = wrapper.find(".grid-body-pane--right .grid-selection-overlay__segment--move-preview")

    expect(centerSegment.exists()).toBe(true)
    expect(rightSegment.exists()).toBe(true)
    expect(centerSegment.attributes("style")).toContain("border-right-width: 0px;")
    expect(rightSegment.attributes("style")).toContain("border-left-width: 0px;")

    wrapper.unmount()
  })

  it("renders a single fill-preview rectangle across the selected range and preview cells", () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex >= 1 && columnIndex <= 2,
        {
          selectionRange: { startRow: 0, endRow: 0, startColumn: 1, endColumn: 2 },
          isCellInFillPreview: (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 3,
        },
      ),
    })

    const allCenterSegments = wrapper.findAll(".grid-body-viewport .grid-selection-overlay__segment")
    const allRightSegments = wrapper.findAll(".grid-body-pane--right .grid-selection-overlay__segment")
    const centerFillSegment = wrapper.find(".grid-body-viewport .grid-selection-overlay__segment--fill-preview")
    const rightSegment = wrapper.find(".grid-body-pane--right .grid-selection-overlay__segment--fill-preview")

    expect(allCenterSegments).toHaveLength(1)
    expect(allRightSegments).toHaveLength(1)
    expect(centerFillSegment.exists()).toBe(true)
    expect(rightSegment.exists()).toBe(true)
    expect(centerFillSegment.attributes("style")).toContain("border-right-width: 0px;")
    expect(rightSegment.attributes("style")).toContain("border-left-width: 0px;")

    wrapper.unmount()
  })

  it("renders overlay borders from selected cells without cell-edge fallback classes", () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 1,
        {
          selectionRange: null,
        },
      ),
    })

    const overlaySegment = wrapper.find(".grid-body-viewport .grid-selection-overlay__segment")
    const selectedCell = wrapper.find('[data-row-index="0"][data-column-index="1"]')

    expect(overlaySegment.exists()).toBe(true)
    expect(selectedCell.classes()).not.toContain("grid-cell--selection-edge")
    expect(selectedCell.classes().filter(name => name.startsWith("grid-cell--selection-edge-"))).toHaveLength(0)

    wrapper.unmount()
  })

  it("restores focus to the anchor cell when fill preview ends", async () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      callback(0)
      return 1
    })

    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
        {
          selectionRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
          fillPreviewRange: { startRow: 0, endRow: 1, startColumn: 0, endColumn: 0 },
          isCellInFillPreview: (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
        },
      ),
    })

    const viewport = wrapper.find(".grid-body-viewport").element as HTMLElement
    viewport.focus()

    await wrapper.setProps({ fillPreviewRange: null })
    await nextTick()

    const anchorCell = wrapper.find('[data-row-index="0"][data-column-index="0"]').element as HTMLElement
    expect(document.activeElement).toBe(anchorCell)

    rafSpy.mockRestore()
    wrapper.unmount()
  })

  it("keeps the anchor cell focused when pressing the fill handle", async () => {
    const startFillHandleDrag = vi.fn()
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
        {
          selectionRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
          isFillHandleCell: (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
          startFillHandleDrag,
        },
      ),
    })

    const anchorCell = wrapper.find('[data-row-index="0"][data-column-index="0"]')
    const fillHandle = wrapper.find(".cell-fill-handle")

    expect(anchorCell.attributes("tabindex")).toBe("0")

    await fillHandle.trigger("mousedown", {
      button: 0,
      clientX: 10,
      clientY: 10,
    })

    expect(document.activeElement).toBe(anchorCell.element)
    expect(startFillHandleDrag).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})
