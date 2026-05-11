import { nextTick, ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { DataGridTableStageBodyColumn, DataGridTableStageBodyRow } from "../dataGridTableStageBody.types"
import { useDataGridStageFillAction } from "../useDataGridStageFillAction"

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

function createRect(right: number, bottom: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right,
    bottom,
    width: right,
    height: bottom,
    toJSON: () => ({}),
  } as DOMRect
}

describe("useDataGridStageFillAction", () => {
  it("resolves floating menu position and closes on anchor changes", async () => {
    const column = createColumn("owner")
    const row = { kind: "data", rowId: "r1", data: {}, state: { pinned: "none" } } as DataGridTableStageBodyRow
    const cell = document.createElement("div")
    const focus = vi.fn()
    Object.defineProperty(cell, "focus", {
      value: focus,
    })

    const selection = ref({
      fillActionAnchorCell: { rowIndex: 0, columnIndex: 0 },
      fillPreviewRange: {
        startRow: 0,
        endRow: 0,
        startColumn: 0,
        endColumn: 0,
      },
      isFillDragging: false,
    })

    const restoreAnchorCellFocus = vi.fn()
    const service = useDataGridStageFillAction({
      selection,
      selectionRange: ref({
        startRow: 0,
        endRow: 0,
        startColumn: 0,
        endColumn: 0,
      }),
      visibleColumns: ref([column]),
      renderedColumns: ref([column]),
      displayRows: ref([row]),
      bodyViewportEl: ref(cell),
      bodyShellRef: ref(null),
      bodyViewportClientHeight: ref(200),
      bodyViewportTopOffset: ref(20),
      bodyViewportScrollLeft: ref(0),
      leftPaneWidth: ref(72),
      rightPaneWidth: ref(0),
      effectiveBodyViewportWidth: ref(300),
      indexColumnWidthPx: ref(72),
      pinnedLeftColumns: ref([]),
      pinnedRightColumns: ref([]),
      resolveColumnWidth: () => 120,
      resolveViewportRowStart: () => 0,
      resolveVisibleCellElement: () => cell,
      resolveVisibleRowElement: () => null,
      resolveRelativeCellRect: () => createRect(150, 60),
      isVisibleCellEditableByAbsoluteCoord: () => true,
      restoreAnchorCellFocus,
    })

    expect(service.floatingFillActionStyle.value).toEqual({
      left: "136px",
      top: "36px",
    })

    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent

    service.toggleFloatingFillActionMenu(event)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalled()
    expect(focus).toHaveBeenCalled()
    expect(service.fillActionMenuOpen.value).toBe(true)

    service.handleFillActionSelection()
    expect(service.fillActionMenuOpen.value).toBe(false)

    selection.value.fillActionAnchorCell = { rowIndex: 1, columnIndex: 0 }
    await nextTick()
    expect(service.fillActionMenuOpen.value).toBe(false)

    selection.value.fillPreviewRange = null
    await nextTick()
    expect(restoreAnchorCellFocus).toHaveBeenCalled()
    expect(service.fillActionMenuOpen.value).toBe(false)
  })
})
