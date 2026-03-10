import { ref } from "vue"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DataGridColumnSnapshot, DataGridRowNode } from "@affino/datagrid-core"
import { useDataGridAppInteractionController } from "../useDataGridAppInteractionController"

type DemoRow = Record<string, unknown>

function createBodyViewport(): HTMLElement {
  const shell = document.createElement("div")
  shell.className = "grid-body-shell"
  shell.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 120,
    height: 120,
    right: 120,
    bottom: 120,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })

  const viewport = document.createElement("div")
  viewport.className = "grid-body-viewport"
  Object.defineProperty(viewport, "scrollTop", { configurable: true, writable: true, value: 0 })
  Object.defineProperty(viewport, "scrollLeft", { configurable: true, writable: true, value: 0 })
  Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 120 })
  Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 120 })
  viewport.focus = vi.fn()

  shell.appendChild(viewport)
  document.body.appendChild(shell)
  return viewport
}

function createCell(rowIndex: number, columnIndex: number): HTMLElement {
  const cell = document.createElement("div")
  cell.className = "grid-cell"
  cell.dataset.rowIndex = String(rowIndex)
  cell.dataset.columnIndex = String(columnIndex)
  cell.focus = vi.fn()
  return cell
}

function createMouseEvent(
  type: string,
  currentTarget: HTMLElement,
  init: MouseEventInit,
): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
  Object.defineProperty(event, "target", { configurable: true, value: currentTarget })
  Object.defineProperty(event, "currentTarget", { configurable: true, value: currentTarget })
  return event
}

function createControllerHarness(options: { rowCount?: number; columnCount?: number } = {}) {
  const rowCount = options.rowCount ?? 1
  const columnCount = options.columnCount ?? 2
  const bodyViewport = createBodyViewport()
  const selectionSnapshot = ref(null)
  const applyCellSelectionByCoord = vi.fn()
  const applySelectionRange = vi.fn()
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => ({
    rowId: `r${rowIndex + 1}`,
    kind: "data",
    data: {},
  })) as unknown as DataGridRowNode<DemoRow>[]
  const row = rows[0]!

  const controller = useDataGridAppInteractionController<DemoRow, readonly DemoRow[]>({
    mode: ref("base"),
    runtime: {
      api: {
        rows: {
          get: (rowIndex: number) => rows[rowIndex] ?? null,
          getCount: () => rowCount,
        },
        selection: {
          hasSupport: () => true,
        },
      },
    } as never,
    totalRows: ref(rowCount),
    visibleColumns: ref(
      Array.from({ length: columnCount }, (_, columnIndex) => ({
        key: String.fromCharCode(97 + columnIndex),
        width: 2,
        pin: "center",
        column: {
          key: String.fromCharCode(97 + columnIndex),
          label: String.fromCharCode(65 + columnIndex),
        },
      })) as unknown as readonly DataGridColumnSnapshot[],
    ),
    viewportRowStart: ref(0),
    selectionSnapshot,
    bodyViewportRef: ref(bodyViewport),
    resolveColumnWidth: column => column.width ?? 2,
    resolveRowHeight: () => 24,
    resolveRowIndexAtOffset: () => 0,
    normalizeRowId: value => (typeof value === "string" || typeof value === "number" ? value : null),
    normalizeCellCoord: coord => coord,
    resolveSelectionRange: () => null,
    applySelectionRange,
    applyCellSelectionByCoord,
    setCellSelection: vi.fn(),
    clearCellSelection: vi.fn(),
    readCell: vi.fn(() => ""),
    cloneRowData: rowData => ({ ...rowData }),
    resolveRowIndexById: () => 0,
    captureRowsSnapshot: vi.fn(() => []),
    recordIntentTransaction: vi.fn(),
    clearPendingClipboardOperation: vi.fn(() => false),
    copySelectedCells: vi.fn(async () => false),
    pasteSelectedCells: vi.fn(async () => false),
    cutSelectedCells: vi.fn(async () => false),
    normalizeClipboardRange: range => range,
    applyClipboardEdits: vi.fn(() => 0),
    rangesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    buildFillMatrixFromRange: vi.fn(() => [[""]]),
    syncViewport: vi.fn(),
    editingCell: ref(null),
    startInlineEdit: vi.fn(),
    commitInlineEdit: vi.fn(),
    canUndo: () => false,
    canRedo: () => false,
    runHistoryAction: vi.fn(),
    ensureKeyboardActiveCellVisible: vi.fn(),
  })

  return {
    bodyViewport,
    row,
    controller,
    selectionSnapshot,
    applyCellSelectionByCoord,
    applySelectionRange,
  }
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("useDataGridAppInteractionController contract", () => {
  it("does not promote a simple click into drag selection below the pointer threshold", () => {
    const { controller, row, applyCellSelectionByCoord } = createControllerHarness()
    const cell = createCell(0, 0)
    const pointerDown = createMouseEvent("mousedown", cell, {
      button: 0,
      clientX: 1,
      clientY: 10,
    })

    controller.handleCellMouseDown(pointerDown, row, 0, 0)

    expect(controller.isPointerSelectingCells.value).toBe(false)
    expect(applyCellSelectionByCoord).toHaveBeenCalledTimes(1)

    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 3,
      clientY: 10,
    }))

    expect(controller.isPointerSelectingCells.value).toBe(false)
    expect(applyCellSelectionByCoord).toHaveBeenCalledTimes(1)
  })

  it("starts drag selection only after the pointer crosses the drag threshold", () => {
    const { controller, row, applyCellSelectionByCoord } = createControllerHarness()
    const cell = createCell(0, 0)
    const pointerDown = createMouseEvent("mousedown", cell, {
      button: 0,
      clientX: 1,
      clientY: 10,
    })

    controller.handleCellMouseDown(pointerDown, row, 0, 0)
    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 6,
      clientY: 10,
    }))

    expect(controller.isPointerSelectingCells.value).toBe(true)
    expect(applyCellSelectionByCoord).toHaveBeenCalledTimes(2)
    expect(applyCellSelectionByCoord).toHaveBeenLastCalledWith(
      expect.objectContaining({ rowIndex: 0, columnIndex: 1 }),
      true,
      undefined,
    )
  })

  it("maps ctrl+a to select all filtered rows and visible columns", () => {
    const { controller, row, applySelectionRange } = createControllerHarness({
      rowCount: 3,
      columnCount: 4,
    })
    const keydown = new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      cancelable: true,
    })

    controller.handleCellKeydown(keydown, row, 0, 0)

    expect(keydown.defaultPrevented).toBe(true)
    expect(applySelectionRange).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 2,
      startColumn: 0,
      endColumn: 3,
    })
  })

  it("collapses an existing range to a single cell on click without starting range move", () => {
    const { controller, row, selectionSnapshot, applyCellSelectionByCoord } = createControllerHarness({
      rowCount: 3,
      columnCount: 4,
    })
    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 2, colIndex: 3, rowId: "r3" },
      ranges: [{
        startRow: 0,
        endRow: 2,
        startCol: 0,
        endCol: 3,
        startRowId: "r1",
        endRowId: "r3",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 2, colIndex: 3, rowId: "r3" },
      }],
    }

    const cell = createCell(0, 1)
    const pointerDown = createMouseEvent("mousedown", cell, {
      button: 0,
      clientX: 10,
      clientY: 10,
    })

    controller.handleCellMouseDown(pointerDown, row, 0, 1)
    expect(applyCellSelectionByCoord).toHaveBeenCalledTimes(0)

    controller.handleWindowMouseUp()

    expect(applyCellSelectionByCoord).toHaveBeenCalledTimes(1)
    expect(applyCellSelectionByCoord).toHaveBeenCalledWith(
      expect.objectContaining({ rowIndex: 0, columnIndex: 1 }),
      false,
    )
  })
})
