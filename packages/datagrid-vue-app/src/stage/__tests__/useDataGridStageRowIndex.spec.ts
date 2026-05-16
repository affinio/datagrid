import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { DataGridTableStageBodyColumn, DataGridTableStageBodyRow } from "../dataGridTableStageBody.types"
import type { DataGridTableStageLayoutSection, DataGridTableStageRowsSection } from "../dataGridTableStage.types"
import { useDataGridStageRowIndex } from "../useDataGridStageRowIndex"

function createColumn(key: string): DataGridTableStageBodyColumn {
  return {
    key,
    width: 120,
    pin: "center",
    column: {
      key,
      label: key,
    },
  } as unknown as DataGridTableStageBodyColumn
}

function createRow(rowId: string, pinned: "none" | "top" | "bottom" = "none"): DataGridTableStageBodyRow {
  return {
    kind: "leaf",
    rowId,
    rowKey: rowId,
    data: {},
    row: {},
    sourceIndex: 0,
    originalIndex: 0,
    displayIndex: 0,
    state: { selected: false, group: false, pinned, expanded: false },
  }
}

describe("useDataGridStageRowIndex", () => {
  it("resolves row index styling, selection, and drag interactions", () => {
    const rows = ref({
      showRowIndex: true,
      indexColumnStyle: {
        width: "88px",
        minWidth: "88px",
      },
      handleRowClick: vi.fn(),
      handleRowIndexClick: vi.fn(),
      handleRowIndexKeydown: vi.fn(),
      reorderRowsByIndex: vi.fn(),
      consumeRecentRowResizeInteraction: vi.fn(() => false),
      isRowFocused: (row: DataGridTableStageBodyRow) => row.rowId === "r2",
    } as unknown as DataGridTableStageRowsSection<Record<string, unknown>>)

    const layout = ref({
      indexColumnStyle: {
        width: "88px",
        minWidth: "88px",
      },
    } as unknown as DataGridTableStageLayoutSection)

    const visibleColumns = ref([createColumn("a"), createColumn("b")])
    const selectionRange = ref({
      startRow: 0,
      endRow: 1,
      startColumn: 0,
      endColumn: 1,
    })

    const service = useDataGridStageRowIndex({
      rows,
      layout,
      viewportRowStart: ref(0),
      selectionRange,
      visibleColumns,
      isHoveredRow: (_row, rowOffset) => rowOffset === 1,
      isStripedRow: (_row, rowOffset) => rowOffset === 1,
      resolveAbsoluteRowIndex: (_row, rowOffset) => rowOffset,
      resolveInlineRowStateFill: (_row, _rowOffset, options) => (
        options?.fullBleed === true
          ? { backgroundImage: "linear-gradient(red, red)" }
          : null
      ),
      isDataGridPlaceholderSurfaceRow: () => false,
    })

    const row0 = createRow("r1")
    const row1 = createRow("r2")
    const groupRow = createRow("g1")
    groupRow.kind = "group"
    groupRow.state.group = true
    const pinnedRow = createRow("r3", "top")

    expect(service.showRowIndex.value).toBe(true)
    expect(service.indexColumnWidthPx.value).toBe(88)
    expect(service.resolvedRowIndexColumnStyle.value).toMatchObject({
      width: "88px",
      minWidth: "88px",
      maxWidth: "88px",
    })
    expect(service.rowIndexTabIndex(row0)).toBe(-1)
    expect(service.rowIndexTabIndex(row1)).toBe(0)
    expect(service.isFullRowSelectionSafe(0)).toBe(true)
    expect(service.isFullRowSelectionSafe(1, row1)).toBe(true)
    expect(service.rowIndexCellClasses(row0, 0)).toMatchObject({
      "grid-cell--index-selected": true,
      "grid-cell--index-selected-top": true,
      "grid-cell--index-selected-bottom": false,
    })
    expect(service.rowIndexCellStyle(row1, 1)).toMatchObject({
      width: "88px",
      backgroundImage: "linear-gradient(var(--datagrid-row-band-hover-bg), var(--datagrid-row-band-hover-bg))",
    })
    expect(service.isRowIndexDraggable(row0)).toBe(true)
    expect(service.isRowIndexDraggable(groupRow)).toBe(false)
    expect(service.isRowIndexDraggable(pinnedRow)).toBe(false)

    const clickTarget = document.createElement("div")
    service.handleRowIndexClickSafe(row0, 0, {
      currentTarget: clickTarget,
      shiftKey: true,
    } as unknown as MouseEvent)
    expect(rows.value.consumeRecentRowResizeInteraction).toHaveBeenCalled()
    expect(clickTarget).toBeDefined()
    expect(rows.value.handleRowIndexClick).toHaveBeenCalledWith(row0, 0, true)

    service.handleRowIndexKeydownSafe({ key: "Enter" } as KeyboardEvent, row0, 0)
    expect(rows.value.handleRowIndexKeydown).toHaveBeenCalledWith({ key: "Enter" }, row0, 0)

    const dragTarget = document.createElement("div")
    Object.defineProperty(dragTarget, "getBoundingClientRect", {
      value: () => ({
        top: 10,
        height: 20,
        left: 0,
        width: 100,
      }),
    })
    const setData = vi.fn()
    const dragEvent = {
      currentTarget: dragTarget,
      clientY: 15,
      dataTransfer: {
        effectAllowed: "",
        dropEffect: "",
        setData,
      },
      preventDefault: vi.fn(),
    } as unknown as DragEvent

    service.handleRowIndexDragStart(dragEvent, row0, 0)
    expect(setData).toHaveBeenCalledWith("text/plain", "r1:0")

    service.handleRowIndexDragOver(dragEvent, row1, 1)
    service.handleRowIndexDrop(dragEvent, row1, 1)
    expect(rows.value.reorderRowsByIndex).toHaveBeenCalledWith({
      sourceRowId: "r1",
      targetRowId: "r2",
      placement: "before",
    })

    service.clearRowIndexDragState()
    expect(service.rowIndexCellClasses(row0, 0)).toMatchObject({
      "grid-cell--index-reorder-source": false,
      "grid-cell--index-drop-before": false,
      "grid-cell--index-drop-after": false,
    })
  })

  it("ignores touch-generated row index drag starts", () => {
    const rows = ref({
      showRowIndex: true,
      indexColumnStyle: {},
      reorderRowsByIndex: vi.fn(),
      consumeRecentRowResizeInteraction: vi.fn(() => false),
    } as unknown as DataGridTableStageRowsSection<Record<string, unknown>>)

    const service = useDataGridStageRowIndex({
      rows,
      layout: ref({ indexColumnStyle: {} } as unknown as DataGridTableStageLayoutSection),
      viewportRowStart: ref(0),
      selectionRange: ref(null),
      visibleColumns: ref([createColumn("a")]),
      isHoveredRow: () => false,
      isStripedRow: () => false,
      resolveAbsoluteRowIndex: (_row, rowOffset) => rowOffset,
      resolveInlineRowStateFill: () => null,
      isDataGridPlaceholderSurfaceRow: () => false,
    })
    const row = createRow("r1")
    const setData = vi.fn()
    const dragEvent = {
      sourceCapabilities: { firesTouchEvents: true },
      dataTransfer: {
        effectAllowed: "",
        dropEffect: "",
        setData,
      },
    } as unknown as DragEvent

    service.handleRowIndexDragStart(dragEvent, row, 0)

    expect(setData).not.toHaveBeenCalled()
    expect(service.rowIndexCellClasses(row, 0)).toMatchObject({
      "grid-cell--index-reorder-source": false,
    })
  })
})
