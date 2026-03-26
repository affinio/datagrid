import { mount } from "@vue/test-utils"
import { h, nextTick } from "vue"
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

function createEditableAffordanceColumns(): readonly DataGridColumnSnapshot[] {
  return [
    {
      key: "stage",
      pin: "center",
      width: 120,
      column: {
        key: "stage",
        label: "Stage",
        cellType: "select",
        capabilities: { editable: true },
      },
    },
    {
      key: "createdAt",
      pin: "center",
      width: 140,
      column: {
        key: "createdAt",
        label: "Created",
        dataType: "date",
        capabilities: { editable: true },
      },
    },
  ] as unknown as readonly DataGridColumnSnapshot[]
}

function createRowSelectionColumn(): DataGridColumnSnapshot {
  return {
    key: "__datagrid_row_selection__",
    pin: "left",
    width: 108,
    column: {
      key: "__datagrid_row_selection__",
      label: "",
      cellType: "checkbox",
      capabilities: { editable: true, sortable: false, filterable: false },
      meta: { rowSelection: true },
    },
  } as unknown as DataGridColumnSnapshot
}

function createRows(count = 1, startIndex = 0): readonly DataGridTableRow<DemoRow>[] {
  return Array.from({ length: count }, (_unused, offset) => ({
    rowId: `r${startIndex + offset + 1}`,
    displayIndex: startIndex + offset,
    data: {
      left: `L${startIndex + offset + 1}`,
      centerA: `A${startIndex + offset + 1}`,
      centerB: `B${startIndex + offset + 1}`,
      right: `R${startIndex + offset + 1}`,
    },
  })) as unknown as readonly DataGridTableRow<DemoRow>[]
}

function createStageProps(
  isCellSelected: (rowOffset: number, columnIndex: number) => boolean,
  options?: {
    selectionRange?: DataGridOverlayRange | null
    selectionAnchorCell?: { rowIndex: number; columnIndex: number } | null
    fillPreviewRange?: DataGridOverlayRange | null
    rangeMovePreviewRange?: DataGridOverlayRange | null
    fillHandleEnabled?: boolean
    rangeMoveEnabled?: boolean
    isFillDragging?: boolean
    isRangeMoving?: boolean
    rowHover?: boolean
    stripedRows?: boolean
    rowCount?: number
    pinnedBottomRowCount?: number
    isCellOnSelectionEdge?: (rowOffset: number, columnIndex: number, edge: "top" | "right" | "bottom" | "left") => boolean
    isCellInFillPreview?: (rowOffset: number, columnIndex: number) => boolean
    isFillHandleCell?: (rowOffset: number, columnIndex: number) => boolean
    startFillHandleDrag?: () => void
    startFillHandleDoubleClick?: () => void
    fillActionAnchorCell?: { rowIndex: number; columnIndex: number } | null
    fillActionBehavior?: "copy" | "series" | null
    applyFillActionBehavior?: (behavior: "copy" | "series") => void
    isCellEditable?: (
      row: DataGridTableRow<DemoRow>,
      rowOffset: number,
      column: DataGridColumnSnapshot,
      columnIndex: number,
    ) => boolean
    handleCellClick?: (
      row: DataGridTableRow<DemoRow>,
      rowOffset: number,
      column: DataGridColumnSnapshot,
      columnIndex: number,
    ) => void
    isEditingCell?: (row: DataGridTableRow<DemoRow>, columnKey: string) => boolean
    startInlineEdit?: (
      row: DataGridTableRow<DemoRow>,
      columnKey: string,
      options?: { draftValue?: string; openOnMount?: boolean },
    ) => void
    cancelInlineEdit?: () => void
    showRowIndex?: boolean
    visibleColumns?: readonly DataGridColumnSnapshot[]
    firstRowKind?: "data" | "group"
    firstRowExpanded?: boolean
    firstRowGroupKey?: string
    toggleGroupRow?: (row: DataGridTableRow<DemoRow>) => void
  },
): DataGridTableStageProps<DemoRow> {
  const visibleColumns = options?.visibleColumns ?? createColumns()
  const renderedColumns = visibleColumns.filter(column => column.pin !== "left" && column.pin !== "right")
  const rows = createRows(options?.rowCount ?? 1).map((row, rowIndex) => {
    if (rowIndex === 0 && options?.firstRowKind === "group") {
      return {
        rowId: options.firstRowGroupKey ?? "group-1",
        kind: "group",
        data: {},
        state: { expanded: options.firstRowExpanded === true },
        groupMeta: {
          groupKey: options.firstRowGroupKey ?? "group-1",
          groupField: "name",
          groupValue: "Group 1",
          level: 0,
          childrenCount: 1,
        },
      } as unknown as DataGridTableRow<DemoRow>
    }
    return row
  })
  const pinnedBottomRows = createRows(options?.pinnedBottomRowCount ?? 0, rows.length)

  return {
    mode: "base",
    rowHeightMode: "fixed",
    layoutMode: "fill",
    layout: {
      gridContentStyle: { width: "250px", minWidth: "250px" },
      mainTrackStyle: { width: "250px", minWidth: "250px" },
      indexColumnStyle: { width: "72px", minWidth: "72px", maxWidth: "72px", left: "0px" },
      stageStyle: {},
      bodyShellStyle: {},
      columnStyle: key => {
        const column = visibleColumns.find(candidate => candidate.key === key)
        const width = `${column?.width ?? 140}px`
        return { width, minWidth: width, maxWidth: width }
      },
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
      renderedColumns,
      columnFilterTextByKey: {},
      toggleSortForColumn: () => undefined,
      sortIndicator: () => "",
      setColumnFilterText: () => undefined,
      startResize: () => undefined,
      handleResizeDoubleClick: () => undefined,
    },
    rows: {
      displayRows: rows,
      pinnedBottomRows,
      showRowIndex: options?.showRowIndex ?? true,
      rowHover: options?.rowHover ?? false,
      stripedRows: options?.stripedRows ?? false,
      rowClass: () => "",
      isRowAutosizeProbe: () => false,
      rowStyle: () => ({ height: "31px", minHeight: "31px" }),
      toggleGroupRow: options?.toggleGroupRow ?? (() => undefined),
      rowIndexLabel: () => "1",
      startRowResize: () => undefined,
      autosizeRow: () => undefined,
    },
    selection: {
      selectionRange: options?.selectionRange ?? { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
      selectionAnchorCell: options?.selectionAnchorCell ?? { rowIndex: 0, columnIndex: 0 },
      fillPreviewRange: options?.fillPreviewRange ?? null,
      rangeMovePreviewRange: options?.rangeMovePreviewRange ?? null,
      fillHandleEnabled: options?.fillHandleEnabled ?? false,
      rangeMoveEnabled: options?.rangeMoveEnabled ?? true,
      isFillDragging: options?.isFillDragging ?? false,
      isRangeMoving: options?.isRangeMoving ?? false,
      fillActionAnchorCell: options?.fillActionAnchorCell ?? null,
      fillActionBehavior: options?.fillActionBehavior ?? null,
      applyFillActionBehavior: options?.applyFillActionBehavior ?? (() => undefined),
      isFillHandleCell: options?.isFillHandleCell ?? (() => false),
      startFillHandleDrag: options?.startFillHandleDrag ?? (() => undefined),
      startFillHandleDoubleClick: options?.startFillHandleDoubleClick ?? (() => undefined),
    },
    editing: {
      editingCellValue: "",
      editingCellInitialFilter: "",
      editingCellOpenOnMount: false,
      isEditingCell: options?.isEditingCell ?? (() => false),
      startInlineEdit: options?.startInlineEdit ?? (() => undefined),
      updateEditingCellValue: () => undefined,
      handleEditorKeydown: () => undefined,
      commitInlineEdit: () => undefined,
      cancelInlineEdit: options?.cancelInlineEdit ?? (() => undefined),
    },
    cells: {
      isCellSelected,
      isSelectionAnchorCell: (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
      shouldHighlightSelectedCell: (rowOffset, columnIndex) => isCellSelected(rowOffset, columnIndex) && !(rowOffset === 0 && columnIndex === 0),
      isCellOnSelectionEdge: options?.isCellOnSelectionEdge ?? (() => false),
      isCellInFillPreview: options?.isCellInFillPreview ?? (() => false),
      isCellInPendingClipboardRange: () => false,
      isCellOnPendingClipboardEdge: () => false,
      isCellEditable: options?.isCellEditable ?? (() => true),
      readCell: (row, columnKey) => String((row.data as Record<string, unknown>)[columnKey] ?? ""),
      readDisplayCell: (row, columnKey) => String((row.data as Record<string, unknown>)[columnKey] ?? ""),
    },
    interaction: {
      handleCellMouseDown: () => undefined,
      handleCellClick: options?.handleCellClick ?? (() => undefined),
      handleCellKeydown: () => undefined,
    },
  }
}

async function applyViewportLayoutMetrics(
  wrapper: ReturnType<typeof mount<typeof DataGridTableStage>>,
  options: {
    viewportTop: number
    viewportHeight: number
    rowBottomsByIndex?: Record<number, number>
    rowRectsByIndex?: Record<number, { top: number; height: number; left?: number; width?: number }>
    cellRectsByCoord?: Record<string, { left: number; top: number; width: number; height: number }>
  },
): Promise<void> {
  const shell = wrapper.find(".grid-body-shell").element as HTMLElement
  const viewport = wrapper.find(".grid-body-viewport").element as HTMLElement

  Object.defineProperty(viewport, "clientHeight", {
    configurable: true,
    value: options.viewportHeight,
  })
  Object.defineProperty(viewport, "clientWidth", {
    configurable: true,
    value: 250,
  })

  shell.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 420,
    bottom: 220,
    width: 420,
    height: 220,
    toJSON: () => ({}),
  }) as DOMRect

  viewport.getBoundingClientRect = () => ({
    x: 72,
    y: options.viewportTop,
    left: 72,
    top: options.viewportTop,
    right: 322,
    bottom: options.viewportTop + options.viewportHeight,
    width: 250,
    height: options.viewportHeight,
    toJSON: () => ({}),
  }) as DOMRect

  for (const [rowIndexText, rowBottom] of Object.entries(options.rowBottomsByIndex ?? {})) {
    const rowCell = wrapper.find(`.grid-cell[data-row-index="${rowIndexText}"]`).element as HTMLElement | undefined
    if (!rowCell) {
      continue
    }
    rowCell.getBoundingClientRect = () => ({
      x: 72,
      y: rowBottom - 31,
      left: 72,
      top: rowBottom - 31,
      right: 192,
      bottom: rowBottom,
      width: 120,
      height: 31,
      toJSON: () => ({}),
    }) as DOMRect
  }

  for (const [rowIndexText, rect] of Object.entries(options.rowRectsByIndex ?? {})) {
    const rowElement = wrapper.find(`.grid-body-viewport .grid-row[data-row-index="${rowIndexText}"]`).element as HTMLElement | undefined
    if (!rowElement) {
      continue
    }
    rowElement.getBoundingClientRect = () => ({
      x: rect.left ?? 72,
      y: rect.top,
      left: rect.left ?? 72,
      top: rect.top,
      right: (rect.left ?? 72) + (rect.width ?? 250),
      bottom: rect.top + rect.height,
      width: rect.width ?? 250,
      height: rect.height,
      toJSON: () => ({}),
    }) as DOMRect
  }

  for (const [coord, rect] of Object.entries(options.cellRectsByCoord ?? {})) {
    const [rowIndexText, columnIndexText] = coord.split(":")
    const cell = wrapper.find(`.grid-cell[data-row-index="${rowIndexText}"][data-column-index="${columnIndexText}"]`).element as HTMLElement | undefined
    if (!cell) {
      continue
    }
    cell.getBoundingClientRect = () => ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      width: rect.width,
      height: rect.height,
      toJSON: () => ({}),
    }) as DOMRect
  }

  window.dispatchEvent(new Event("resize"))
  await nextTick()
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("DataGridTableStage contract", () => {
  it("renders custom Vue cell content when a column cellRenderer is provided", async () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(() => false, {
        visibleColumns: [
          {
            key: "centerA",
            pin: "center",
            width: 140,
            column: {
              key: "centerA",
              label: "Status",
              cellRenderer: ({ displayValue }) => h("span", {
                class: "test-status-pill",
              }, `Status: ${displayValue}`),
            },
          },
        ] as unknown as readonly DataGridColumnSnapshot[],
      }),
    })

    await nextTick()

    expect(wrapper.find(".test-status-pill").text()).toBe("Status: A1")

    wrapper.unmount()
  })

  it("applies cellInteraction aria semantics to the cell wrapper", async () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(() => false, {
        visibleColumns: [{
          key: "centerA",
          pin: "center",
          width: 140,
          column: {
            key: "centerA",
            label: "Status",
            cellInteraction: {
              click: true,
              role: "button",
              label: "Open status details",
              pressed: true,
              onInvoke: vi.fn(),
            },
          },
        }] as unknown as readonly DataGridColumnSnapshot[],
      }),
    })

    await nextTick()

    const cell = wrapper.find('.grid-body-viewport .grid-cell[data-column-key="centerA"]')

    expect(cell.attributes("role")).toBe("button")
    expect(cell.attributes("aria-label")).toBe("Open status details")
    expect(cell.attributes("aria-pressed")).toBe("true")

    wrapper.unmount()
  })

  it("exposes interactive.activate to custom cell renderers", async () => {
    const onInvoke = vi.fn()
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(() => false, {
        visibleColumns: [{
          key: "centerA",
          pin: "center",
          width: 140,
          column: {
            key: "centerA",
            label: "Status",
            cellInteraction: {
              click: true,
              role: "button",
              onInvoke,
            },
            cellRenderer: ({ interactive }) => h("button", {
              class: "test-interactive-renderer",
              onClick: (event: MouseEvent) => {
                event.stopPropagation()
                interactive?.activate("click")
              },
            }, interactive?.role ?? "none"),
          },
        }] as unknown as readonly DataGridColumnSnapshot[],
      }),
    })

    await nextTick()
    await wrapper.find(".test-interactive-renderer").trigger("click")

    expect(onInvoke).toHaveBeenCalledWith(expect.objectContaining({
      trigger: "click",
    }))

    wrapper.unmount()
  })

  it("renders pinned bottom rows in a dedicated bottom shell", async () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(() => false, {
        rowCount: 2,
        pinnedBottomRowCount: 2,
      }),
    })

    await nextTick()

    expect(wrapper.findAll(".grid-body-shell:not(.grid-body-shell--pinned-bottom) .grid-body-viewport .grid-row")).toHaveLength(2)
    expect(wrapper.findAll(".grid-body-shell--pinned-bottom .grid-body-viewport--pinned-bottom .grid-row")).toHaveLength(2)
    expect(wrapper.find(".grid-body-shell--pinned-bottom .grid-body-viewport--pinned-bottom").exists()).toBe(true)

    wrapper.unmount()
  })

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

  it("applies the fill-dragging class when active", () => {
    const wrapper = mount(DataGridTableStage, {
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
        {
          isFillDragging: true,
        },
      ),
    })

    expect(wrapper.classes()).toContain("grid-stage--fill-dragging")

    wrapper.unmount()
  })

  it("forces the global cursor to crosshair while fill dragging", async () => {
    const wrapper = mount(DataGridTableStage, {
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
        {
          isFillDragging: true,
        },
      ),
    })

    expect(document.body.style.cursor).toBe("crosshair")
    expect(document.documentElement.style.cursor).toBe("crosshair")
    expect(document.body.classList.contains("datagrid-fill-drag-cursor")).toBe(true)
    expect(document.documentElement.classList.contains("datagrid-fill-drag-cursor")).toBe(true)

    await wrapper.setProps({
      selection: {
        ...wrapper.props().selection,
        isFillDragging: false,
      },
    })

    expect(document.body.style.cursor).toBe("")
    expect(document.documentElement.style.cursor).toBe("")
    expect(document.body.classList.contains("datagrid-fill-drag-cursor")).toBe(false)
    expect(document.documentElement.classList.contains("datagrid-fill-drag-cursor")).toBe(false)

    wrapper.unmount()
  })

  it("does not activate range-move hover while fill dragging", async () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
        {
          isFillDragging: true,
          isCellOnSelectionEdge: () => true,
        },
      ),
    })

    const cell = wrapper.find('[data-row-index="0"][data-column-index="0"]')

    await cell.trigger("mousemove", {
      clientX: 1,
      clientY: 1,
    })

    expect(cell.classes()).not.toContain("grid-cell--range-move-handle-hover")

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

    const selectedCell = wrapper.find('[data-row-index="0"][data-column-index="1"]')

    expect(wrapper.find(".grid-body-viewport .grid-selection-overlay__segment").exists()).toBe(false)
    expect(selectedCell.classes()).not.toContain("grid-cell--selection-edge")
    expect(selectedCell.classes().filter(name => name.startsWith("grid-cell--selection-edge-"))).toHaveLength(0)

    wrapper.unmount()
  })

  it("updates the center overlay when selection changes after mount", async () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        () => false,
        {
          selectionRange: null,
        },
      ),
    })

    expect(wrapper.find(".grid-body-viewport .grid-selection-overlay__segment").exists()).toBe(false)

    await wrapper.setProps(createStageProps(
      (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 1,
      {
        selectionRange: { startRow: 0, endRow: 0, startColumn: 1, endColumn: 1 },
      },
    ))
    await nextTick()

    expect(wrapper.find(".grid-body-viewport .grid-selection-overlay__segment").exists()).toBe(false)

    wrapper.unmount()
  })

  it("keeps the anchor cell unfilled even if upstream selection highlighting includes it", () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: {
        ...createStageProps(
          (rowOffset, columnIndex) => rowOffset === 0 && columnIndex >= 0 && columnIndex <= 1,
          {
            selectionRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 1 },
          },
        ),
        shouldHighlightSelectedCell: (rowOffset, columnIndex) => rowOffset === 0 && columnIndex >= 0 && columnIndex <= 1,
      },
    })

    const anchorCell = wrapper.find('[data-row-index="0"][data-column-index="0"]')
    const siblingCell = wrapper.find('[data-row-index="0"][data-column-index="1"]')

    expect(anchorCell.classes()).toContain("grid-cell--selection-anchor")
    expect(anchorCell.classes()).not.toContain("grid-cell--selected")
    expect(siblingCell.classes()).toContain("grid-cell--selected")

    wrapper.unmount()
  })

  it("dispatches body cell clicks through the stage handler", async () => {
    const handleCellClick = vi.fn()
    const wrapper = mount(DataGridTableStage, {
      props: createStageProps(() => false, {
        handleCellClick,
      }),
    })

    await nextTick()

    await wrapper.find('.grid-cell[data-row-index="0"][data-column-index="0"]').trigger("click")

    expect(handleCellClick).toHaveBeenCalledTimes(1)
    expect(handleCellClick).toHaveBeenCalledWith(
      expect.objectContaining({ rowId: "r1" }),
      0,
      expect.objectContaining({ key: "left" }),
      0,
    )
  })

  it("uses the explicit anchor cell for visual highlighting instead of range start", () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex >= 0 && columnIndex <= 1,
        {
          selectionRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 1 },
          selectionAnchorCell: { rowIndex: 0, columnIndex: 1 },
        },
      ),
    })

    const startCell = wrapper.find('[data-row-index="0"][data-column-index="0"]')
    const anchorCell = wrapper.find('[data-row-index="0"][data-column-index="1"]')

    expect(startCell.classes()).toContain("grid-cell--selected")
    expect(anchorCell.classes()).toContain("grid-cell--selection-anchor")
    expect(anchorCell.classes()).not.toContain("grid-cell--selected")

    wrapper.unmount()
  })

  it("uses the selected cell as the visual anchor for single-cell selections", () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 1,
        {
          selectionRange: { startRow: 0, endRow: 0, startColumn: 1, endColumn: 1 },
          selectionAnchorCell: { rowIndex: 0, columnIndex: 2 },
        },
      ),
    })

    const selectedCell = wrapper.find('[data-row-index="0"][data-column-index="1"]')
    const staleAnchorCell = wrapper.find('[data-row-index="0"][data-column-index="2"]')

    expect(wrapper.find(".grid-stage").classes()).toContain("grid-stage--single-cell-selection")
    expect(selectedCell.classes()).toContain("grid-cell--selection-anchor")
    expect(staleAnchorCell.classes()).not.toContain("grid-cell--selection-anchor")

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

    await wrapper.setProps({
      selection: {
        ...wrapper.props().selection,
        fillPreviewRange: null,
      },
    })
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

  it("routes fill-handle double click to fill-down behavior", async () => {
    const startFillHandleDoubleClick = vi.fn()
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
        {
          selectionRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
          isFillHandleCell: (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
          startFillHandleDoubleClick,
        },
      ),
    })

    await wrapper.find(".cell-fill-handle").trigger("dblclick", {
      button: 0,
      clientX: 10,
      clientY: 10,
    })

    expect(startFillHandleDoubleClick).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it("does not render the fill handle for a non-editable anchor cell", () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
        {
          selectionRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
          isFillHandleCell: (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
          isCellEditable: () => false,
        },
      ),
    })

    expect(wrapper.find(".cell-fill-handle").exists()).toBe(false)

    wrapper.unmount()
  })

  it("does not show the range-move hover affordance for a non-editable selected cell", async () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
        {
          selectionRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
          isCellOnSelectionEdge: () => true,
          isCellEditable: () => false,
        },
      ),
    })

    const selectedCell = wrapper.find('[data-row-index="0"][data-column-index="0"]')
    expect(selectedCell.exists()).toBe(true)

    Object.defineProperty(selectedCell.element, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        width: 120,
        height: 32,
        right: 120,
        bottom: 32,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })

    await selectedCell.trigger("mousemove", {
      clientX: 2,
      clientY: 2,
    })

    expect(selectedCell.classes()).not.toContain("grid-cell--range-move-handle-hover")

    wrapper.unmount()
  })

  it("does not show the range-move hover affordance when range move is disabled", async () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
        {
          selectionRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
          rangeMoveEnabled: false,
          isCellOnSelectionEdge: () => true,
        },
      ),
    })

    const selectedCell = wrapper.find('[data-row-index="0"][data-column-index="0"]')
    expect(selectedCell.exists()).toBe(true)

    Object.defineProperty(selectedCell.element, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        width: 120,
        height: 32,
        right: 120,
        bottom: 32,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })

    await selectedCell.trigger("mousemove", {
      clientX: 2,
      clientY: 2,
    })

    expect(selectedCell.classes()).not.toContain("grid-cell--range-move-handle-hover")

    wrapper.unmount()
  })

  it("toggles a collapsed tree group row from the keyboard on Space", async () => {
    const toggleGroupRow = vi.fn()
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: {
        ...createStageProps(() => false, {
          firstRowKind: "group",
          firstRowExpanded: false,
          firstRowGroupKey: "tree:path:workspace",
          toggleGroupRow,
        }),
        mode: "tree",
      },
    })

    const groupCell = wrapper.find('[data-row-index="0"][data-column-index="1"]')
    expect(groupCell.exists()).toBe(true)

    await groupCell.trigger("keydown", { key: " " })

    expect(toggleGroupRow).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it("toggles an expanded tree group row from the keyboard on Space", async () => {
    const toggleGroupRow = vi.fn()
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: {
        ...createStageProps(() => false, {
          firstRowKind: "group",
          firstRowExpanded: true,
          firstRowGroupKey: "tree:path:workspace",
          toggleGroupRow,
        }),
        mode: "tree",
      },
    })

    const groupCell = wrapper.find('[data-row-index="0"][data-column-index="1"]')
    expect(groupCell.exists()).toBe(true)

    await groupCell.trigger("keydown", { key: " " })

    expect(toggleGroupRow).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it("does not mark readonly select and date cells as affordance cells, including pinned bottom rows", () => {
    const wrapper = mount(DataGridTableStage, {
      props: createStageProps(() => false, {
        visibleColumns: createEditableAffordanceColumns(),
        pinnedBottomRowCount: 1,
        isCellEditable: () => false,
      }),
      attachTo: document.body,
    })

    const bodySelectCell = wrapper.find('.grid-body-viewport .grid-cell[data-row-index="0"][data-column-index="0"]')
    const bodyDateCell = wrapper.find('.grid-body-viewport .grid-cell[data-row-index="0"][data-column-index="1"]')
    const pinnedSelectCell = wrapper.find('.grid-body-viewport--pinned-bottom .grid-cell[data-row-index="1"][data-column-index="0"]')
    const pinnedDateCell = wrapper.find('.grid-body-viewport--pinned-bottom .grid-cell[data-row-index="1"][data-column-index="1"]')

    expect(bodySelectCell.classes()).not.toContain("grid-cell--select")
    expect(bodyDateCell.classes()).not.toContain("grid-cell--date")
    expect(pinnedSelectCell.classes()).not.toContain("grid-cell--select")
    expect(pinnedDateCell.classes()).not.toContain("grid-cell--date")

    wrapper.unmount()
  })

  it("applies layout mode classes and auto-height body shell sizing", () => {
    const baseProps = createStageProps(() => false, {
      rowCount: 2,
    })
    const wrapper = mount(DataGridTableStage, {
      props: {
        ...baseProps,
        layoutMode: "auto-height",
        layout: {
          ...baseProps.layout,
          stageStyle: { height: "auto" },
          bodyShellStyle: { height: "62px", maxHeight: "62px" },
        },
      },
    })

    expect(wrapper.classes()).toContain("grid-stage--layout-auto-height")
    expect(wrapper.attributes("style")).toContain("height: auto")
    expect(wrapper.find(".grid-body-shell").attributes("style")).toContain("height: 62px")
    expect(wrapper.find(".grid-body-viewport").classes()).toContain("grid-body-viewport--layout-auto-height")

    wrapper.unmount()
  })

  it("does not resync shell metrics when auto-height row metrics shift during body scroll", async () => {
    let rafHandle = 0
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      callback(0)
      rafHandle += 1
      return rafHandle
    })

    const baseProps = createStageProps(() => false, {
      rowCount: 3,
      selectionRange: null,
      selectionAnchorCell: null,
    })
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: {
        ...baseProps,
        rowHeightMode: "auto",
      },
    })

    await applyViewportLayoutMetrics(wrapper, {
      viewportTop: 12,
      viewportHeight: 96,
      rowRectsByIndex: {
        0: { top: 12, height: 31 },
        1: { top: 43, height: 31 },
        2: { top: 74, height: 31 },
      },
    })

    const shell = wrapper.find(".grid-body-shell").element as HTMLElement
    const headerShell = wrapper.find(".grid-header-shell").element as HTMLElement
    const viewport = wrapper.find(".grid-body-viewport").element as HTMLElement
    const rowElements = wrapper.findAll(".grid-body-viewport .grid-row")

    const shellRectSpy = vi.fn(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 420,
      bottom: 220,
      width: 420,
      height: 220,
      toJSON: () => ({}),
    }) as DOMRect)
    const headerShellRectSpy = vi.fn(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 420,
      bottom: 48,
      width: 420,
      height: 48,
      toJSON: () => ({}),
    }) as DOMRect)
    const viewportRectSpy = vi.fn(() => ({
      x: 72,
      y: 12,
      left: 72,
      top: 12,
      right: 322,
      bottom: 108,
      width: 250,
      height: 96,
      toJSON: () => ({}),
    }) as DOMRect)
    const rowRectSpies = rowElements.map((rowElement, index) => {
      const rectTop = 12 + (index * 31)
      const spy = vi.fn(() => ({
        x: 72,
        y: rectTop,
        left: 72,
        top: rectTop,
        right: 322,
        bottom: rectTop + 31,
        width: 250,
        height: 31,
        toJSON: () => ({}),
      }) as DOMRect)
      ;(rowElement.element as HTMLElement).getBoundingClientRect = spy as typeof rowElement.element.getBoundingClientRect
      return spy
    })

    shell.getBoundingClientRect = shellRectSpy as typeof shell.getBoundingClientRect
    headerShell.getBoundingClientRect = headerShellRectSpy as typeof headerShell.getBoundingClientRect
    viewport.getBoundingClientRect = viewportRectSpy as typeof viewport.getBoundingClientRect

    shellRectSpy.mockClear()
    headerShellRectSpy.mockClear()
    viewportRectSpy.mockClear()
    rowRectSpies.forEach(spy => spy.mockClear())

    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      writable: true,
      value: 31,
    })
    viewport.dispatchEvent(new Event("scroll"))
    await nextTick()

    expect(viewportRectSpy).toHaveBeenCalled()
    expect(rowRectSpies.some(spy => spy.mock.calls.length > 0)).toBe(true)
    expect(shellRectSpy).not.toHaveBeenCalled()
    expect(headerShellRectSpy).not.toHaveBeenCalled()

    rafSpy.mockRestore()
    wrapper.unmount()
  })

  it("shows fill action menu and reapplies the selected behavior", async () => {
    const applyFillActionBehavior = vi.fn()
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
        {
          selectionRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
          fillActionAnchorCell: { rowIndex: 0, columnIndex: 0 },
          fillActionBehavior: "series",
          applyFillActionBehavior,
        },
      ),
    })

    expect(wrapper.find(".grid-fill-action__menu").exists()).toBe(false)

    await wrapper.find(".grid-fill-action__trigger").trigger("click")
    expect(wrapper.find(".grid-fill-action__menu").exists()).toBe(true)

    await wrapper.findAll(".grid-fill-action__item")[1]?.trigger("click")
    expect(applyFillActionBehavior).toHaveBeenCalledWith("copy")
    expect(wrapper.find(".grid-fill-action__menu").exists()).toBe(false)

    wrapper.unmount()
  })

  it("keeps the fill action trigger visible when the filled anchor row is outside the viewport", async () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
        {
          rowCount: 3,
          selectionRange: { startRow: 0, endRow: 999, startColumn: 0, endColumn: 0 },
          fillActionAnchorCell: { rowIndex: 999, columnIndex: 1 },
          fillActionBehavior: "series",
        },
      ),
    })

    await applyViewportLayoutMetrics(wrapper, {
      viewportTop: 12,
      viewportHeight: 100,
    })

    expect(wrapper.find(".grid-fill-action__trigger").exists()).toBe(true)
    expect(wrapper.find(".grid-fill-action--floating").attributes("style")).toContain("top: 80px;")

    wrapper.unmount()
  })

  it("positions the fill action next to the last visible selected row when the end cell is in view", async () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(
        (rowOffset, columnIndex) => rowOffset >= 0 && rowOffset <= 2 && columnIndex === 1,
        {
          rowCount: 3,
          selectionRange: { startRow: 0, endRow: 2, startColumn: 1, endColumn: 1 },
          fillActionAnchorCell: { rowIndex: 2, columnIndex: 1 },
          fillActionBehavior: "series",
        },
      ),
    })

    await applyViewportLayoutMetrics(wrapper, {
      viewportTop: 12,
      viewportHeight: 100,
      rowBottomsByIndex: {
        2: 84,
      },
      cellRectsByCoord: {
        "2:1": { left: 150, top: 53, width: 120, height: 31 },
      },
    })

    expect(wrapper.find(".grid-fill-action--floating").attributes("style")).toContain("top: 60px;")
    expect(wrapper.find(".grid-fill-action--floating").attributes("style")).toContain("left: 256px;")

    wrapper.unmount()
  })

  it("positions the fill action next to the last visible selected column when the end column is out of view", async () => {
    const baseProps = createStageProps(
      (rowOffset, columnIndex) => rowOffset === 0 && columnIndex >= 1 && columnIndex <= 2,
      {
        selectionRange: { startRow: 0, endRow: 0, startColumn: 1, endColumn: 2 },
        fillActionAnchorCell: { rowIndex: 0, columnIndex: 2 },
        fillActionBehavior: "series",
      },
    )

    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: {
        ...baseProps,
        columns: {
          ...baseProps.columns,
          renderedColumns: baseProps.columns.renderedColumns.filter(column => column.key === "centerA"),
        },
        viewport: {
          ...baseProps.viewport,
          rightColumnSpacerWidth: 130,
        },
      },
    })

    await applyViewportLayoutMetrics(wrapper, {
      viewportTop: 12,
      viewportHeight: 100,
      rowBottomsByIndex: {
        0: 43,
      },
      cellRectsByCoord: {
        "0:1": { left: 160, top: 12, width: 120, height: 31 },
      },
    })

    expect(wrapper.find(".grid-fill-action--floating").attributes("style")).toContain("left: 266px;")

    wrapper.unmount()
  })

  it("renders header menu triggers when menu callbacks are present even without the explicit flag", () => {
    const baseProps = createStageProps(
      (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
      {
        selectionRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
      },
    )
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: {
        ...baseProps,
        columns: {
          ...baseProps.columns,
          columnMenuEnabled: false,
          applyColumnMenuSort: () => undefined,
          applyColumnMenuPin: () => undefined,
          applyColumnMenuFilter: () => undefined,
          clearColumnMenuFilter: () => undefined,
        },
        rows: {
          ...baseProps.rows,
          sourceRows: [{ left: "L1", centerA: "A1", centerB: "B1", right: "R1" }],
        },
      },
    })

    expect(wrapper.find('[data-datagrid-column-menu-button="true"]').exists()).toBe(true)
    expect(wrapper.find('.col-menu-bar-trigger').exists()).toBe(false)
    expect(wrapper.find('.col-filter-input').exists()).toBe(false)

    wrapper.unmount()
  })

  it("mirrors row hover across pinned and center panes when rowHover is enabled", async () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(() => false, {
        rowHover: true,
      }),
    })

    await wrapper.find(".grid-body-viewport .grid-row").trigger("mouseenter")

    expect(wrapper.find(".grid-body-pane--left .grid-row").classes()).toContain("grid-row--hovered")
    expect(wrapper.find(".grid-body-viewport .grid-row").classes()).toContain("grid-row--hovered")
    expect(wrapper.find(".grid-body-pane--right .grid-row").classes()).toContain("grid-row--hovered")

    await wrapper.find(".grid-body-shell").trigger("mouseleave")

    expect(wrapper.find(".grid-body-pane--left .grid-row").classes()).not.toContain("grid-row--hovered")

    wrapper.unmount()
  })

  it("marks alternating visible rows as striped when stripedRows is enabled", () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(() => false, {
        stripedRows: true,
        rowCount: 2,
        selectionRange: null,
        selectionAnchorCell: null,
      }),
    })

    expect(wrapper.findAll(".grid-body-pane--left .grid-row")[0]?.classes()).not.toContain("grid-row--striped")
    expect(wrapper.findAll(".grid-body-pane--left .grid-row")[1]?.classes()).toContain("grid-row--striped")
    expect(wrapper.findAll(".grid-body-viewport .grid-row")[1]?.classes()).toContain("grid-row--striped")
    expect(wrapper.findAll(".grid-body-pane--right .grid-row")[1]?.classes()).toContain("grid-row--striped")

    wrapper.unmount()
  })

  it("collapses the index lane when row numbers are disabled", () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(() => false, {
        showRowIndex: false,
        selectionRange: null,
        selectionAnchorCell: null,
      }),
    })

    expect(wrapper.find(".grid-cell--index-number").exists()).toBe(false)
    expect((wrapper.find(".grid-body-pane--left").element as HTMLElement).style.width).toBe("80px")

    wrapper.unmount()
  })

  it("does not render a phantom header index lane when the first left-pinned column is a data column", () => {
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: createStageProps(() => false, {
        showRowIndex: false,
        selectionRange: null,
        selectionAnchorCell: null,
      }),
    })

    expect(wrapper.find(".grid-header-pane--left .grid-cell--index-header").exists()).toBe(false)
    expect(wrapper.find(".grid-header-pane--left .grid-cell--pinned-left").attributes("data-column-key")).toBe("left")
    expect((wrapper.find(".grid-header-pane--left").element as HTMLElement).style.width).toBe("80px")

    wrapper.unmount()
  })

  it("separates row checkbox column from the row-number cell and routes number clicks to full-row selection", async () => {
    const handleRowIndexClick = vi.fn()
    const visibleColumns = [createRowSelectionColumn(), ...createColumns()] as const
    const baseProps = createStageProps(() => false, {
      selectionRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 4 },
      visibleColumns,
    })
    const wrapper = mount(DataGridTableStage, {
      attachTo: document.body,
      props: {
        ...baseProps,
        layout: {
          ...baseProps.layout,
          indexColumnStyle: { width: "108px", minWidth: "108px", maxWidth: "108px", left: "0px" },
        },
        rows: {
          ...baseProps.rows,
          handleRowIndexClick,
          handleToggleAllVisibleRows: () => undefined,
          isRowCheckboxSelected: row => row.rowId === "r1",
        },
        cells: {
          ...baseProps.cells,
          readCell: (row, columnKey) => {
            if (columnKey === "__datagrid_row_selection__") {
              return row.rowId === "r1" ? "false" : "true"
            }
            return columnKey
          },
        },
      },
    })

    expect(wrapper.find(".grid-header-pane--left .grid-cell--row-selection").exists()).toBe(true)
    expect(wrapper.find(".grid-body-pane--left .grid-cell--row-selection[role='checkbox']").exists()).toBe(true)

    const indexCell = wrapper.find(".grid-body-pane--left .grid-cell--index-number")
    expect(indexCell.classes()).toContain("grid-cell--index-selected")

    await indexCell.trigger("click", { shiftKey: true })

    expect(handleRowIndexClick).toHaveBeenCalledWith(expect.objectContaining({ rowId: "r1" }), 0, true)

    wrapper.unmount()
  })
})
