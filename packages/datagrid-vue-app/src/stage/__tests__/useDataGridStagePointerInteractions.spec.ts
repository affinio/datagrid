import { nextTick, ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { DataGridTableStageBodyColumn, DataGridTableStageBodyRow } from "../dataGridTableStageBody.types"
import { useDataGridStagePointerInteractions } from "../useDataGridStagePointerInteractions"

function createColumn(key: string): DataGridTableStageBodyColumn {
  return {
    key,
    width: 120,
    pin: "center",
    column: {
      key,
      label: key,
    },
  } as DataGridTableStageBodyColumn
}

describe("useDataGridStagePointerInteractions", () => {
  it("tracks range-move hover, fill-handle events, and drag cursor state", async () => {
    const row = { kind: "data", rowId: "r1", data: {}, state: { pinned: "none" } } as DataGridTableStageBodyRow
    const column = createColumn("owner")
    const focus = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(() => {})
    const cell = document.createElement("div")
    cell.className = "grid-cell"
    Object.defineProperty(cell, "getBoundingClientRect", {
      value: () => ({
        top: 0,
        left: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
      }),
    })
    const startFillHandleDrag = vi.fn()
    const startFillHandleDoubleClick = vi.fn()
    const fillActionMenuOpen = ref(true)
    const selection = ref({
      isFillDragging: false,
      rangeMoveEnabled: true,
      startFillHandleDrag,
      startFillHandleDoubleClick,
    })

    const service = useDataGridStagePointerInteractions({
      mode: ref("base"),
      selection,
      selectionRange: ref({
        startRow: 0,
        endRow: 0,
        startColumn: 0,
        endColumn: 0,
      }),
      visibleColumns: ref([column]),
      displayRows: ref([row]),
      viewportRowStart: ref(0),
      fillActionMenuOpen,
      isCellSelectedSafe: () => true,
      isCellEditableSafe: () => true,
      isCellOnSelectionEdgeSafe: () => true,
    })

    const moveEvent = {
      currentTarget: cell,
      clientX: 2,
      clientY: 2,
    } as MouseEvent

    service.handleCellMouseMove(moveEvent, 0, 0)
    expect(service.isRangeMoveHandleHoverCell(0, 0)).toBe(true)

    service.clearRangeMoveHandleHover()
    expect(service.isRangeMoveHandleHoverCell(0, 0)).toBe(false)

    const downEvent = {
      currentTarget: cell,
    } as MouseEvent
    service.handleFillHandleMouseDown(downEvent)
    expect(fillActionMenuOpen.value).toBe(false)
    expect(focus).toHaveBeenCalled()
    expect(startFillHandleDrag).toHaveBeenCalledWith(downEvent)

    service.handleFillHandleDoubleClick(downEvent)
    expect(startFillHandleDoubleClick).toHaveBeenCalledWith(downEvent)

    selection.value.isFillDragging = true
    await nextTick()
    expect(document.documentElement.classList.contains("datagrid-fill-drag-cursor")).toBe(true)
    expect(document.body.classList.contains("datagrid-fill-drag-cursor")).toBe(true)

    service.resetGlobalFillDragCursor()
    expect(document.documentElement.classList.contains("datagrid-fill-drag-cursor")).toBe(false)
    expect(document.body.classList.contains("datagrid-fill-drag-cursor")).toBe(false)
  })

  it("does not track range-move hover when hover interactions are suppressed", () => {
    const row = { kind: "data", rowId: "r1", data: {}, state: { pinned: "none" } } as DataGridTableStageBodyRow
    const column = createColumn("owner")
    const cell = document.createElement("div")
    cell.className = "grid-cell"
    Object.defineProperty(cell, "getBoundingClientRect", {
      value: () => ({
        top: 0,
        left: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
      }),
    })

    const service = useDataGridStagePointerInteractions({
      mode: ref("base"),
      selection: ref({
        isFillDragging: false,
        rangeMoveEnabled: true,
        startFillHandleDrag: vi.fn(),
        startFillHandleDoubleClick: vi.fn(),
      }),
      selectionRange: ref({
        startRow: 0,
        endRow: 0,
        startColumn: 0,
        endColumn: 0,
      }),
      visibleColumns: ref([column]),
      displayRows: ref([row]),
      viewportRowStart: ref(0),
      fillActionMenuOpen: ref(false),
      suppressHoverInteractions: ref(true),
      isCellSelectedSafe: () => true,
      isCellEditableSafe: () => true,
      isCellOnSelectionEdgeSafe: () => true,
    })

    service.handleCellMouseMove({
      currentTarget: cell,
      clientX: 2,
      clientY: 2,
    } as MouseEvent, 0, 0)

    expect(service.isRangeMoveHandleHoverCell(0, 0)).toBe(false)
  })
})
