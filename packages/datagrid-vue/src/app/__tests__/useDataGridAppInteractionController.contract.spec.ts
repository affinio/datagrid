import { nextTick, ref } from "vue"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DataGridColumnSnapshot, DataGridRowId, DataGridRowNode, DataGridSelectionSnapshot } from "@affino/datagrid-core"
import { useDataGridAppInteractionController } from "../useDataGridAppInteractionController"

type DemoRow = Record<string, unknown>

function normalizeRowId(value: unknown): DataGridRowId | null {
  return typeof value === "string" || typeof value === "number" ? value : null
}

function createBodyViewport(options: { shellWidth?: number; shellHeight?: number } = {}): HTMLElement {
  const shellWidth = options.shellWidth ?? 120
  const shellHeight = options.shellHeight ?? 120
  const shell = document.createElement("div")
  shell.className = "grid-body-shell"
  shell.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: shellWidth,
    height: shellHeight,
    right: shellWidth,
    bottom: shellHeight,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })

  const viewport = document.createElement("div")
  viewport.className = "grid-body-viewport"
  Object.defineProperty(viewport, "scrollTop", { configurable: true, writable: true, value: 0 })
  Object.defineProperty(viewport, "scrollLeft", { configurable: true, writable: true, value: 0 })
  Object.defineProperty(viewport, "clientWidth", { configurable: true, value: shellWidth })
  Object.defineProperty(viewport, "clientHeight", { configurable: true, value: shellHeight })
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

function createControllerHarness(options: {
  rowCount?: number
  columnCount?: number
  rowData?: readonly DemoRow[]
  visibleColumns?: readonly DataGridColumnSnapshot[]
  columnWidths?: readonly number[]
  shellWidth?: number
  shellHeight?: number
  indexColumnWidth?: number
  resolveRowIndexAtOffset?: (offset: number) => number
  mode?: "base" | "tree" | "pivot" | "worker"
  isCellEditable?: (rowIndex: number, columnIndex: number) => boolean
  enableFillHandle?: boolean
  enableRangeMove?: boolean
  firstRowKind?: "data" | "group"
  firstRowExpanded?: boolean
  firstRowGroupKey?: string
} = {}) {
  const rowCount = options.rowCount ?? 1
  const columnWidths = options.columnWidths ?? Array.from({ length: options.columnCount ?? 2 }, () => 2)
  const columnCount = options.columnCount ?? columnWidths.length
  const visibleColumns = options.visibleColumns ?? (
    Array.from({ length: columnCount }, (_, columnIndex) => ({
      key: String.fromCharCode(97 + columnIndex),
      width: columnWidths[columnIndex] ?? 2,
      pin: "center",
      column: {
        key: String.fromCharCode(97 + columnIndex),
        label: String.fromCharCode(65 + columnIndex),
      },
    })) as unknown as readonly DataGridColumnSnapshot[]
  )
  const mode = options.mode ?? "base"
  const bodyViewport = createBodyViewport({
    shellWidth: options.shellWidth,
    shellHeight: options.shellHeight,
  })
  const selectionSnapshot = ref<DataGridSelectionSnapshot | null>(null)
  let selectionAnchor: { rowIndex: number; columnIndex: number; rowId: string | number | null } | null = null
  let rows = Array.from({ length: rowCount }, (_, rowIndex) => {
    if (rowIndex === 0 && options.firstRowKind === "group") {
      return {
        rowId: `g${rowIndex + 1}`,
        kind: "group",
        data: options.rowData?.[rowIndex] ?? {},
        state: {
          expanded: options.firstRowExpanded === true,
        },
        groupMeta: {
          groupKey: options.firstRowGroupKey ?? "group-1",
          groupField: "name",
          groupValue: "Group 1",
          level: 0,
          childrenCount: Math.max(0, rowCount - 1),
        },
      }
    }
    return {
      rowId: `r${rowIndex + 1}`,
      kind: "data",
      data: options.rowData?.[rowIndex] ?? {},
    }
  }) as unknown as DataGridRowNode<DemoRow>[]
  const row = rows[0]!
  const buildRangeSnapshot = (options: {
    anchor: { rowIndex: number; columnIndex: number; rowId: string | number | null }
    focus: { rowIndex: number; columnIndex: number; rowId: string | number | null }
    activeCell?: { rowIndex: number; columnIndex: number; rowId: string | number | null }
  }): DataGridSelectionSnapshot => {
    const startRow = Math.min(options.anchor.rowIndex, options.focus.rowIndex)
    const endRow = Math.max(options.anchor.rowIndex, options.focus.rowIndex)
    const startCol = Math.min(options.anchor.columnIndex, options.focus.columnIndex)
    const endCol = Math.max(options.anchor.columnIndex, options.focus.columnIndex)
    const activeCell = options.activeCell ?? options.focus
    return {
      activeRangeIndex: 0,
      activeCell: {
        rowIndex: activeCell.rowIndex,
        colIndex: activeCell.columnIndex,
        rowId: activeCell.rowId,
      },
      ranges: [{
        startRow,
        endRow,
        startCol,
        endCol,
        startRowId: rows[startRow]?.rowId ?? null,
        endRowId: rows[endRow]?.rowId ?? null,
        anchor: {
          rowIndex: options.anchor.rowIndex,
          colIndex: options.anchor.columnIndex,
          rowId: options.anchor.rowId,
        },
        focus: {
          rowIndex: options.focus.rowIndex,
          colIndex: options.focus.columnIndex,
          rowId: options.focus.rowId,
        },
      }],
    }
  }
  const syncSelectionState = (snapshot: DataGridSelectionSnapshot | null): void => {
    selectionSnapshot.value = snapshot
    const activeRange = snapshot?.ranges[snapshot.activeRangeIndex ?? 0] ?? snapshot?.ranges[0] ?? null
    selectionAnchor = activeRange?.anchor
      ? {
          rowIndex: activeRange.anchor.rowIndex,
          columnIndex: activeRange.anchor.colIndex,
          rowId: normalizeRowId(activeRange.anchor.rowId),
        }
      : null
  }
  const setSelectionSnapshot = vi.fn((snapshot: DataGridSelectionSnapshot | null) => {
    syncSelectionState(snapshot)
  })
  const applySelectionRange = vi.fn((range: {
    startRow: number
    endRow: number
    startColumn: number
    endColumn: number
  }) => {
    setSelectionSnapshot(buildRangeSnapshot({
      anchor: {
        rowIndex: range.startRow,
        columnIndex: range.startColumn,
        rowId: rows[range.startRow]?.rowId ?? null,
      },
      focus: {
        rowIndex: range.endRow,
        columnIndex: range.endColumn,
        rowId: rows[range.endRow]?.rowId ?? null,
      },
    }))
  })
  const applyCellSelectionByCoord = vi.fn((coord: {
    rowIndex: number
    columnIndex: number
    rowId: string | number | null
  }, extend: boolean, fallbackAnchor?: {
    rowIndex: number
    columnIndex?: number
    colIndex?: number
    rowId?: string | number | null
  }) => {
    const anchor = extend
      ? (selectionAnchor ?? {
          rowIndex: fallbackAnchor?.rowIndex ?? coord.rowIndex,
          columnIndex: fallbackAnchor?.columnIndex ?? fallbackAnchor?.colIndex ?? coord.columnIndex,
          rowId: fallbackAnchor?.rowId ?? coord.rowId,
        })
      : {
          rowIndex: coord.rowIndex,
          columnIndex: coord.columnIndex,
          rowId: coord.rowId,
        }
    setSelectionSnapshot(buildRangeSnapshot({
      anchor,
      focus: {
        rowIndex: coord.rowIndex,
        columnIndex: coord.columnIndex,
        rowId: coord.rowId,
      },
    }))
  })
  const setCellSelection = vi.fn((nextRow: DataGridRowNode<DemoRow>, rowOffset: number, columnIndex: number, extend: boolean) => {
    applyCellSelectionByCoord({
      rowIndex: rowOffset,
      columnIndex,
      rowId: nextRow.rowId ?? null,
    }, extend)
  })
  const ensureKeyboardActiveCellVisible = vi.fn()
  const applyClipboardEdits = vi.fn(() => 0)
  const buildFillMatrixFromRange = vi.fn(() => [[""]])
  const recordIntentTransaction = vi.fn()
  const clearPendingClipboardOperation = vi.fn(() => false)
  const syncViewport = vi.fn()
  const editingCell = ref<{ rowId: string | number; columnKey: string } | null>(null)
  const startInlineEdit = vi.fn()
  const appendInlineEditTextInput = vi.fn(() => false)
  const cancelInlineEdit = vi.fn()
  const expandGroup = vi.fn()
  const collapseGroup = vi.fn()

  const controller = useDataGridAppInteractionController<DemoRow, readonly DemoRow[]>({
    mode: ref(mode),
    enableFillHandle: ref(options.enableFillHandle ?? true),
    enableRangeMove: ref(options.enableRangeMove ?? true),
    runtime: {
      api: {
        rows: {
          get: (rowIndex: number) => rows[rowIndex] ?? null,
          getCount: () => rows.length,
          expandGroup,
          collapseGroup,
          setData: (nextRows: Array<{ rowId: string | number; row: DemoRow }>) => {
            rows = nextRows.map(nextRow => ({
              rowId: nextRow.rowId,
              kind: "data",
              data: nextRow.row,
            })) as unknown as DataGridRowNode<DemoRow>[]
          },
        },
        selection: {
          hasSupport: () => true,
          setSnapshot: setSelectionSnapshot,
        },
      },
    } as never,
    totalRows: ref(rowCount),
    visibleColumns: ref(visibleColumns),
    viewportRowStart: ref(0),
    selectionSnapshot,
    bodyViewportRef: ref(bodyViewport),
    indexColumnWidth: options.indexColumnWidth ?? 0,
    resolveColumnWidth: column => column.width ?? 2,
    resolveRowHeight: () => 24,
    resolveRowIndexAtOffset: options.resolveRowIndexAtOffset ?? (() => 0),
    normalizeRowId,
    normalizeCellCoord: coord => coord,
    resolveSelectionRange: () => {
      const activeRange = selectionSnapshot.value?.ranges[selectionSnapshot.value.activeRangeIndex ?? 0]
        ?? selectionSnapshot.value?.ranges[0]
        ?? null
      if (!activeRange) {
        return null
      }
      return {
        startRow: activeRange.startRow,
        endRow: activeRange.endRow,
        startColumn: activeRange.startCol,
        endColumn: activeRange.endCol,
      }
    },
    applySelectionRange,
    applyCellSelectionByCoord,
    setCellSelection,
    clearCellSelection: vi.fn(),
    readCell: vi.fn((nextRow, columnKey) => {
      const value = (nextRow.data as Record<string, unknown>)?.[columnKey]
      return value == null ? "" : String(value)
    }),
    isCellEditable: (_row, rowIndex, _columnKey, columnIndex) => options.isCellEditable?.(rowIndex, columnIndex) ?? true,
    cloneRowData: rowData => ({ ...rowData }),
    resolveRowIndexById: rowId => rows.findIndex(nextRow => nextRow.rowId === rowId),
    captureRowsSnapshot: vi.fn(() => rows.map(nextRow => ({
      rowId: String(nextRow.rowId),
      ...(nextRow.data as DemoRow),
    }))),
    recordIntentTransaction,
    clearPendingClipboardOperation,
    copySelectedCells: vi.fn(async () => false),
    pasteSelectedCells: vi.fn(async () => false),
    cutSelectedCells: vi.fn(async () => false),
    normalizeClipboardRange: range => range,
    applyClipboardEdits,
    rangesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    buildFillMatrixFromRange,
    syncViewport,
    editingCell,
    startInlineEdit,
    appendInlineEditTextInput,
    cancelInlineEdit,
    commitInlineEdit: vi.fn(),
    canUndo: () => false,
    canRedo: () => false,
    runHistoryAction: vi.fn(),
    ensureKeyboardActiveCellVisible,
  })

  return {
    bodyViewport,
    row,
    controller,
    selectionSnapshot,
    applyCellSelectionByCoord,
    applySelectionRange,
    setSelectionSnapshot,
    ensureKeyboardActiveCellVisible,
    applyClipboardEdits,
    buildFillMatrixFromRange,
    clearPendingClipboardOperation,
    recordIntentTransaction,
    syncViewport,
    editingCell,
    startInlineEdit,
    appendInlineEditTextInput,
    cancelInlineEdit,
    expandGroup,
    collapseGroup,
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

  it("enables worker-mode drag selection like base mode", () => {
    const { controller, row, applyCellSelectionByCoord } = createControllerHarness({
      mode: "worker",
    })
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

  it("keeps drag selection in the current column until the pointer actually crosses the boundary", () => {
    const { controller, row, applyCellSelectionByCoord, selectionSnapshot } = createControllerHarness({
      rowCount: 3,
      columnWidths: [100, 100],
      shellWidth: 272,
      indexColumnWidth: 72,
    })
    const cell = createCell(0, 0)
    const pointerDown = createMouseEvent("mousedown", cell, {
      button: 0,
      clientX: 120,
      clientY: 10,
    })

    controller.handleCellMouseDown(pointerDown, row, 0, 0)
    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 169,
      clientY: 40,
    }))

    expect(controller.isPointerSelectingCells.value).toBe(true)
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 0,
      startCol: 0,
      endCol: 0,
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 0 },
    })

    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 173,
      clientY: 40,
    }))

    expect(applyCellSelectionByCoord).toHaveBeenCalled()
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 0,
      startCol: 0,
      endCol: 1,
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 1 },
    })
  })

  it("prefers the actual DOM cell under the pointer before geometry fallback during drag selection", () => {
    const { controller, row, selectionSnapshot } = createControllerHarness({
      rowCount: 3,
      columnWidths: [100, 100],
      shellWidth: 272,
      indexColumnWidth: 72,
    })
    const anchorCell = createCell(0, 0)
    document.body.appendChild(anchorCell)
    if (typeof document.elementFromPoint !== "function") {
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        writable: true,
        value: vi.fn(),
      })
    }
    const elementFromPointSpy = vi.spyOn(document, "elementFromPoint").mockReturnValue(anchorCell)
    const pointerDown = createMouseEvent("mousedown", anchorCell, {
      button: 0,
      clientX: 120,
      clientY: 10,
    })

    controller.handleCellMouseDown(pointerDown, row, 0, 0)
    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 173,
      clientY: 40,
    }))

    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 0,
      startCol: 0,
      endCol: 0,
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 0 },
    })

    elementFromPointSpy.mockRestore()
  })

  it("restores the active cell to the anchor after pointer range selection ends", async () => {
    const { controller, row, selectionSnapshot, ensureKeyboardActiveCellVisible } = createControllerHarness({
      rowCount: 6,
      columnWidths: [100, 100],
      shellWidth: 272,
      indexColumnWidth: 72,
      resolveRowIndexAtOffset: offset => Math.max(0, Math.min(5, Math.floor(offset / 24))),
    })
    const anchorCell = createCell(0, 0)
    const focusCell = createCell(3, 0)
    document.body.appendChild(anchorCell)
    document.body.appendChild(focusCell)
    const pointerDown = createMouseEvent("mousedown", anchorCell, {
      button: 0,
      clientX: 120,
      clientY: 10,
    })

    controller.handleCellMouseDown(pointerDown, row, 0, 0)
    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 120,
      clientY: 90,
    }))

    expect(selectionSnapshot.value?.activeCell).toMatchObject({ rowIndex: 3, colIndex: 0 })

    controller.handleWindowMouseUp()
    await nextTick()

    expect(selectionSnapshot.value?.activeCell).toMatchObject({ rowIndex: 0, colIndex: 0 })
    expect(ensureKeyboardActiveCellVisible).toHaveBeenCalledWith(0, 0)
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

  it("uses Enter for vertical navigation instead of keyboard edit start", () => {
    const { controller, row, startInlineEdit, selectionSnapshot } = createControllerHarness({
      rowCount: 3,
      isCellEditable: () => false,
    })

    const keydown = new KeyboardEvent("keydown", {
      key: "Enter",
      cancelable: true,
    })

    controller.handleCellKeydown(keydown, row, 0, 0)

    expect(keydown.defaultPrevented).toBe(true)
    expect(startInlineEdit).not.toHaveBeenCalled()
    expect(selectionSnapshot.value?.activeCell).toMatchObject({
      rowIndex: 1,
      colIndex: 0,
      rowId: "r2",
    })
  })

  it("invokes column cellInteraction on Enter and preserves active cell focus", () => {
    const onInvoke = vi.fn()
    const { controller, row, ensureKeyboardActiveCellVisible } = createControllerHarness({
      visibleColumns: [{
        key: "status",
        width: 120,
        pin: "center",
        column: {
          key: "status",
          label: "Status",
          cellInteraction: {
            role: "button",
            onInvoke,
          },
        },
      }] as unknown as readonly DataGridColumnSnapshot[],
      isCellEditable: () => false,
    })

    const keydown = new KeyboardEvent("keydown", {
      key: "Enter",
      cancelable: true,
    })

    controller.handleCellKeydown(keydown, row, 0, 0)

    expect(keydown.defaultPrevented).toBe(true)
    expect(onInvoke).toHaveBeenCalledWith(expect.objectContaining({
      trigger: "keyboard-enter",
    }))
    expect(ensureKeyboardActiveCellVisible).toHaveBeenCalledWith(0, 0)
  })

  it("starts inline editing from the first typed character on the focused cell", () => {
    const { controller, row, startInlineEdit } = createControllerHarness()

    const keydown = new KeyboardEvent("keydown", {
      key: "p",
      cancelable: true,
    })

    controller.handleCellKeydown(keydown, row, 0, 0)

    expect(keydown.defaultPrevented).toBe(true)
    expect(startInlineEdit).toHaveBeenCalledWith(
      row,
      "a",
      {
        draftValue: "p",
        openOnMount: true,
      },
    )
  })

  it("buffers additional typed characters on the same cell while inline editing is opening", () => {
    const { controller, row, editingCell, appendInlineEditTextInput, startInlineEdit } = createControllerHarness()

    editingCell.value = {
      rowId: row.rowId ?? "r1",
      columnKey: "a",
    }

    const keydown = new KeyboardEvent("keydown", {
      key: "l",
      cancelable: true,
    })

    controller.handleCellKeydown(keydown, row, 0, 0)

    expect(keydown.defaultPrevented).toBe(true)
    expect(appendInlineEditTextInput).toHaveBeenCalledWith("l")
    expect(startInlineEdit).not.toHaveBeenCalled()
  })

  it("cancels the pending inline edit on Escape while focus is still on the cell", () => {
    const { controller, row, editingCell, cancelInlineEdit } = createControllerHarness()

    editingCell.value = {
      rowId: row.rowId ?? "r1",
      columnKey: "a",
    }

    const keydown = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    })

    controller.handleCellKeydown(keydown, row, 0, 0)

    expect(keydown.defaultPrevented).toBe(true)
    expect(cancelInlineEdit).toHaveBeenCalledTimes(1)
  })

  it("clears the selected range on Delete and records a clear intent", () => {
    const {
      controller,
      row,
      setSelectionSnapshot,
      applyClipboardEdits,
      clearPendingClipboardOperation,
      recordIntentTransaction,
      syncViewport,
    } = createControllerHarness({
      rowCount: 3,
      columnCount: 3,
    })
    applyClipboardEdits.mockReturnValue(2)
    setSelectionSnapshot({
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: 1,
        startRowId: "r1",
        endRowId: "r2",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 1, colIndex: 1, rowId: "r2" },
      }],
    })

    const keydown = new KeyboardEvent("keydown", {
      key: "Delete",
      cancelable: true,
    })

    controller.handleCellKeydown(keydown, row, 0, 0)

    expect(keydown.defaultPrevented).toBe(true)
    expect(clearPendingClipboardOperation).toHaveBeenCalledWith(false)
    expect(applyClipboardEdits).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 1,
      startColumn: 0,
      endColumn: 1,
    }, [[""]], { recordHistory: false })
    expect(recordIntentTransaction).toHaveBeenCalledWith({
      intent: "clear",
      label: "Clear 4 cells",
      affectedRange: {
        startRow: 0,
        endRow: 1,
        startColumn: 0,
        endColumn: 1,
      },
    }, expect.any(Array))
    expect(syncViewport).toHaveBeenCalled()
  })

  it("continues plain keyboard navigation from the anchor after a shift-extended range", () => {
    const { controller, row, selectionSnapshot, setSelectionSnapshot } = createControllerHarness({
      rowCount: 6,
      columnCount: 3,
    })

    setSelectionSnapshot({
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      }],
    })

    controller.handleCellKeydown(new KeyboardEvent("keydown", {
      key: "ArrowDown",
      shiftKey: true,
      cancelable: true,
    }), row, 0, 0)

    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 1,
      startCol: 0,
      endCol: 0,
      anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      focus: { rowIndex: 1, colIndex: 0 },
    })

    controller.handleCellKeydown(new KeyboardEvent("keydown", {
      key: "ArrowRight",
      cancelable: true,
    }), row, 0, 0)

    expect(selectionSnapshot.value?.activeCell).toMatchObject({ rowIndex: 0, colIndex: 1, rowId: "r1" })
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 0,
      startCol: 1,
      endCol: 1,
      anchor: { rowIndex: 0, colIndex: 1, rowId: "r1" },
      focus: { rowIndex: 0, colIndex: 1, rowId: "r1" },
    })
  })

  it("expands a collapsed tree group row on Space", () => {
    const { controller, row, expandGroup, collapseGroup } = createControllerHarness({
      mode: "base",
      firstRowKind: "group",
      firstRowExpanded: false,
      firstRowGroupKey: "tree:path:workspace",
    })

    const keydown = new KeyboardEvent("keydown", {
      key: " ",
      cancelable: true,
    })

    controller.handleCellKeydown(keydown, row, 0, 0)

    expect(keydown.defaultPrevented).toBe(true)
    expect(expandGroup).toHaveBeenCalledWith("tree:path:workspace")
    expect(collapseGroup).not.toHaveBeenCalled()
  })

  it("collapses an expanded tree group row on Space", () => {
    const { controller, row, expandGroup, collapseGroup } = createControllerHarness({
      mode: "base",
      firstRowKind: "group",
      firstRowExpanded: true,
      firstRowGroupKey: "tree:path:workspace",
    })

    const keydown = new KeyboardEvent("keydown", {
      key: " ",
      cancelable: true,
    })

    controller.handleCellKeydown(keydown, row, 0, 0)

    expect(keydown.defaultPrevented).toBe(true)
    expect(collapseGroup).toHaveBeenCalledWith("tree:path:workspace")
    expect(expandGroup).not.toHaveBeenCalled()
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

  it("keeps the moved range selected and only returns the active cell to the new anchor", () => {
    const {
      controller,
      row,
      selectionSnapshot,
      applyCellSelectionByCoord,
    } = createControllerHarness({
      rowCount: 6,
      columnWidths: [100, 100],
      shellWidth: 272,
      shellHeight: 160,
      indexColumnWidth: 72,
      resolveRowIndexAtOffset: offset => Math.max(0, Math.min(5, Math.floor(offset / 24))),
    })

    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "r2" },
      ranges: [{
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r2",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 1, colIndex: 0, rowId: "r2" },
      }],
    }

    const anchorCell = createCell(0, 0)
    const pointerDown = createMouseEvent("mousedown", anchorCell, {
      button: 0,
      clientX: 120,
      clientY: 10,
    })

    controller.handleCellMouseDown(pointerDown, row, 0, 0)
    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 120,
      clientY: 82,
    }))
    controller.handleWindowMouseUp()

    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 3,
      endRow: 4,
      startCol: 0,
      endCol: 0,
      anchor: { rowIndex: 3, colIndex: 0, rowId: "r4" },
      focus: { rowIndex: 4, colIndex: 0, rowId: "r5" },
    })
    expect(selectionSnapshot.value?.activeCell).toMatchObject({ rowIndex: 3, colIndex: 0, rowId: "r4" })
    expect(applyCellSelectionByCoord).not.toHaveBeenCalled()
  })

  it("does not start range move from a non-editable selected cell", () => {
    const {
      controller,
      row,
      selectionSnapshot,
    } = createControllerHarness({
      rowCount: 6,
      columnWidths: [100, 100],
      shellWidth: 272,
      shellHeight: 160,
      indexColumnWidth: 72,
      resolveRowIndexAtOffset: offset => Math.max(0, Math.min(5, Math.floor(offset / 24))),
      isCellEditable: () => false,
    })

    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "r2" },
      ranges: [{
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r2",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 1, colIndex: 0, rowId: "r2" },
      }],
    }

    const anchorCell = createCell(0, 0)
    const pointerDown = createMouseEvent("mousedown", anchorCell, {
      button: 0,
      clientX: 120,
      clientY: 10,
    })

    controller.handleCellMouseDown(pointerDown, row, 0, 0)
    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 120,
      clientY: 82,
    }))

    expect(controller.isRangeMoving.value).toBe(false)
    expect(controller.rangeMovePreviewRange.value).toBeNull()

    controller.handleWindowMouseUp()

    expect(selectionSnapshot.value?.ranges[0]).not.toMatchObject({
      startRow: 3,
      endRow: 4,
      startCol: 0,
      endCol: 0,
    })
  })

  it("does not start range move when the feature is disabled", () => {
    const {
      controller,
      row,
      selectionSnapshot,
    } = createControllerHarness({
      rowCount: 6,
      columnWidths: [100, 100],
      shellWidth: 272,
      shellHeight: 160,
      indexColumnWidth: 72,
      resolveRowIndexAtOffset: offset => Math.max(0, Math.min(5, Math.floor(offset / 24))),
      enableRangeMove: false,
    })

    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "r2" },
      ranges: [{
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r2",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 1, colIndex: 0, rowId: "r2" },
      }],
    }

    const anchorCell = createCell(0, 0)
    const pointerDown = createMouseEvent("mousedown", anchorCell, {
      button: 0,
      clientX: 120,
      clientY: 10,
    })

    controller.handleCellMouseDown(pointerDown, row, 0, 0)
    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 120,
      clientY: 82,
    }))

    expect(controller.isRangeMoving.value).toBe(false)
    expect(controller.rangeMovePreviewRange.value).toBeNull()
  })

  it("starts fill drag from the current range without extending preview before pointer movement", () => {
    const { controller, selectionSnapshot } = createControllerHarness({
      rowCount: 3,
      columnCount: 2,
    })
    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      }],
    }

    controller.startFillHandleDrag(new MouseEvent("mousedown", {
      button: 0,
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    }))

    expect(controller.isFillDragging.value).toBe(true)
    expect(controller.fillPreviewRange.value).toEqual({
      startRow: 0,
      endRow: 0,
      startColumn: 0,
      endColumn: 0,
    })
  })

  it("suppresses fill-handle interactions when the feature is disabled", () => {
    const { controller, selectionSnapshot, applyClipboardEdits } = createControllerHarness({
      rowCount: 3,
      columnCount: 2,
      enableFillHandle: false,
    })
    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      }],
    }

    controller.startFillHandleDrag(new MouseEvent("mousedown", {
      button: 0,
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    }))
    controller.startFillHandleDoubleClick(new MouseEvent("dblclick", {
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    }))

    expect(controller.isFillDragging.value).toBe(false)
    expect(controller.fillPreviewRange.value).toBeNull()
    expect(controller.isFillHandleCell(0, 0)).toBe(false)
    expect(applyClipboardEdits).not.toHaveBeenCalled()
    expect(controller.applyLastFillBehavior("copy")).toBe(false)
  })

  it("fills down on fill-handle double click using the nearest contiguous reference column", () => {
    const { controller, selectionSnapshot, applyClipboardEdits, buildFillMatrixFromRange } = createControllerHarness({
      rowCount: 5,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        { b: "task-2" },
        { b: "task-3" },
        { b: "stop" },
        {},
      ],
    })

    applyClipboardEdits.mockReturnValue(3)
    buildFillMatrixFromRange.mockReturnValue([["1"]])
    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      }],
    }

    controller.startFillHandleDoubleClick(new MouseEvent("dblclick", {
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    }))

    expect(buildFillMatrixFromRange).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 0,
      startColumn: 0,
      endColumn: 0,
    })
    expect(applyClipboardEdits).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 3,
      startColumn: 0,
      endColumn: 0,
    }, [["1"], ["2"], ["3"], ["4"]])
    expect(controller.lastAppliedFill.value).toMatchObject({
      behavior: "series",
      previewRange: {
        startRow: 0,
        endRow: 3,
        startColumn: 0,
        endColumn: 0,
      },
      allowBehaviorToggle: true,
    })
  })

  it("falls back to the nearest contiguous reference column on the right when the left side has no extent", () => {
    const { controller, selectionSnapshot, applyClipboardEdits, buildFillMatrixFromRange } = createControllerHarness({
      rowCount: 5,
      columnCount: 3,
      rowData: [
        { a: "1", c: "task-1" },
        { c: "task-2" },
        { c: "task-3" },
        { c: "task-4" },
        {},
      ],
    })

    applyClipboardEdits.mockReturnValue(3)
    buildFillMatrixFromRange.mockReturnValue([["1"]])
    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      }],
    }

    controller.startFillHandleDoubleClick(new MouseEvent("dblclick", {
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    }))

    expect(applyClipboardEdits).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 3,
      startColumn: 0,
      endColumn: 0,
    }, [["1"], ["2"], ["3"], ["4"]])
  })

  it("prefers the left reference side before using the right side for fill-handle double click", () => {
    const { controller, selectionSnapshot, applyClipboardEdits, buildFillMatrixFromRange } = createControllerHarness({
      rowCount: 6,
      columnCount: 3,
      rowData: [
        { a: "left-1", b: "1", c: "right-1" },
        { a: "left-2", c: "right-2" },
        { a: "left-3", c: "right-3" },
        { c: "right-4" },
        { c: "right-5" },
        {},
      ],
    })

    applyClipboardEdits.mockReturnValue(3)
    buildFillMatrixFromRange.mockReturnValue([["1"]])
    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 1, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 1,
        endCol: 1,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 1, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 1, rowId: "r1" },
      }],
    }

    controller.startFillHandleDoubleClick(new MouseEvent("dblclick", {
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    }))

    expect(applyClipboardEdits).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 2,
      startColumn: 1,
      endColumn: 1,
    }, [["1"], ["2"], ["3"]])
  })

  it("clears the removed tail when a repeated fill drag shrinks back toward the base range", () => {
    const elementFromPointSpy = vi.spyOn(document, "elementFromPoint")
    const { controller, selectionSnapshot, applyClipboardEdits } = createControllerHarness({
      rowCount: 5,
      columnCount: 1,
      columnWidths: [24],
      resolveRowIndexAtOffset: offset => Math.max(0, Math.min(4, Math.floor(offset / 24))),
    })

    applyClipboardEdits.mockReturnValue(1)
    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 3, colIndex: 0, rowId: "r4" },
      ranges: [{
        startRow: 0,
        endRow: 3,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r4",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 3, colIndex: 0, rowId: "r4" },
      }],
    }
    controller.lastAppliedFill.value = {
      baseRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
      previewRange: { startRow: 0, endRow: 3, startColumn: 0, endColumn: 0 },
      behavior: "series",
      allowBehaviorToggle: true,
    }

    controller.startFillHandleDrag(new MouseEvent("mousedown", {
      button: 0,
      clientX: 10,
      clientY: 82,
      bubbles: true,
      cancelable: true,
    }))

    elementFromPointSpy.mockReturnValue(createCell(2, 0))
    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 10,
      clientY: 58,
      bubbles: true,
      cancelable: true,
    }))
    controller.handleWindowMouseUp()

    expect(applyClipboardEdits).toHaveBeenNthCalledWith(1, {
      startRow: 3,
      endRow: 3,
      startColumn: 0,
      endColumn: 0,
    }, [[""]], { recordHistory: false })
    expect(controller.lastAppliedFill.value).toMatchObject({
      previewRange: {
        startRow: 0,
        endRow: 2,
        startColumn: 0,
        endColumn: 0,
      },
    })

    elementFromPointSpy.mockRestore()
  })


  it("does not apply fill-down from a blocked anchor cell", () => {
    const { controller, selectionSnapshot, applyClipboardEdits } = createControllerHarness({
      rowCount: 4,
      columnCount: 2,
      isCellEditable: () => false,
    })

    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      }],
    }

    controller.startFillHandleDoubleClick(new MouseEvent("dblclick", {
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    }))

    expect(applyClipboardEdits).not.toHaveBeenCalled()
    expect(controller.lastAppliedFill.value).toBeNull()
  })
  it("marks plain-text fills as not offering a fill behavior toggle", () => {
    const { controller, selectionSnapshot, applyClipboardEdits, buildFillMatrixFromRange } = createControllerHarness({
      rowCount: 4,
      columnCount: 2,
      rowData: [
        { a: "Atlas", b: "task-1" },
        { b: "task-2" },
        { b: "task-3" },
        {},
      ],
    })

    applyClipboardEdits.mockReturnValue(3)
    buildFillMatrixFromRange.mockReturnValue([["Atlas"]])
    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      }],
    }

    controller.startFillHandleDoubleClick(new MouseEvent("dblclick", {
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    }))

    expect(applyClipboardEdits).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 2,
      startColumn: 0,
      endColumn: 0,
    }, [["Atlas"], ["Atlas"], ["Atlas"]])
    expect(controller.lastAppliedFill.value).toMatchObject({
      behavior: "copy",
      allowBehaviorToggle: false,
    })
  })

  it("reapplies the last fill with an explicit behavior override", () => {
    const { controller, selectionSnapshot, applyClipboardEdits, buildFillMatrixFromRange } = createControllerHarness({
      rowCount: 4,
      columnCount: 2,
    })

    applyClipboardEdits.mockReturnValue(4)
    buildFillMatrixFromRange.mockReturnValue([["1"]])
    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 3,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r4",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 3, colIndex: 0, rowId: "r4" },
      }],
    }

    controller.lastAppliedFill.value = {
      baseRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
      previewRange: { startRow: 0, endRow: 3, startColumn: 0, endColumn: 0 },
      behavior: "series",
      allowBehaviorToggle: true,
    }

    const applied = controller.applyLastFillBehavior("copy")

    expect(applied).toBe(true)
    expect(applyClipboardEdits).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 3,
      startColumn: 0,
      endColumn: 0,
    }, [["1"], ["1"], ["1"], ["1"]])
    expect(controller.lastAppliedFill.value).toMatchObject({ behavior: "copy" })
  })

  it("restores focus to the anchor cell after fill-handle apply", async () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => {
      return 1
    })
    const { controller, selectionSnapshot, bodyViewport, ensureKeyboardActiveCellVisible } = createControllerHarness({
      rowCount: 3,
      columnCount: 2,
    })
    const anchorCell = createCell(0, 0)
    bodyViewport.parentElement?.appendChild(anchorCell)
    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      }],
    }

    controller.startFillHandleDrag(new MouseEvent("mousedown", {
      button: 0,
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    }))

    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "r2" },
      ranges: [{
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r2",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 1, colIndex: 0, rowId: "r2" },
      }],
    }

    const focusCallsBeforeMouseUp = vi.mocked(bodyViewport.focus).mock.calls.length
    const ensureCallsBeforeMouseUp = ensureKeyboardActiveCellVisible.mock.calls.length

    controller.handleWindowMouseUp()
    await nextTick()

    expect(ensureKeyboardActiveCellVisible.mock.calls.length).toBeGreaterThan(ensureCallsBeforeMouseUp)
    expect(ensureKeyboardActiveCellVisible).toHaveBeenCalledWith(0, 0)
    expect(vi.mocked(bodyViewport.focus).mock.calls.length).toBe(focusCallsBeforeMouseUp)

    rafSpy.mockRestore()
  })

  it("restores the active cell to the fill origin anchor after fill-handle apply", async () => {
    const { controller, selectionSnapshot } = createControllerHarness({
      rowCount: 3,
      columnCount: 2,
    })

    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      }],
    }

    controller.startFillHandleDrag(new MouseEvent("mousedown", {
      button: 0,
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    }))

    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "r2" },
      ranges: [{
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r2",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 1, colIndex: 0, rowId: "r2" },
      }],
    }

    controller.handleWindowMouseUp()
    await nextTick()

    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 1,
      startCol: 0,
      endCol: 0,
    })
    expect(selectionSnapshot.value?.activeCell).toMatchObject({ rowIndex: 0, colIndex: 0, rowId: "r1" })
  })

  it("restarts fill-handle drag from the last applied fill base range so the filled selection can shrink", () => {
    const elementFromPointSpy = vi.spyOn(document, "elementFromPoint")
    const { controller, selectionSnapshot } = createControllerHarness({
      rowCount: 5,
      columnCount: 1,
      columnWidths: [24],
      resolveRowIndexAtOffset: offset => Math.max(0, Math.min(4, Math.floor(offset / 24))),
    })

    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 3, colIndex: 0, rowId: "r4" },
      ranges: [{
        startRow: 0,
        endRow: 3,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r4",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 3, colIndex: 0, rowId: "r4" },
      }],
    }
    controller.lastAppliedFill.value = {
      baseRange: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
      previewRange: { startRow: 0, endRow: 3, startColumn: 0, endColumn: 0 },
      behavior: "series",
      allowBehaviorToggle: true,
    }

    controller.startFillHandleDrag(new MouseEvent("mousedown", {
      button: 0,
      clientX: 10,
      clientY: 82,
      bubbles: true,
      cancelable: true,
    }))

    const targetCell = createCell(2, 0)
    elementFromPointSpy.mockReturnValue(targetCell)

    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 10,
      clientY: 58,
      bubbles: true,
      cancelable: true,
    }))

    expect(controller.selectionRange.value).toEqual({
      startRow: 0,
      endRow: 2,
      startColumn: 0,
      endColumn: 0,
    })
    expect(controller.fillPreviewRange.value).toEqual({
      startRow: 0,
      endRow: 2,
      startColumn: 0,
      endColumn: 0,
    })
    expect(controller.isFillHandleCell(2, 0)).toBe(true)
    expect(controller.isFillHandleCell(0, 0)).toBe(false)

    elementFromPointSpy.mockRestore()
  })

  it("prefers the selection anchor over the active cell when restoring focus after fill-handle apply", async () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1)
    const { controller, selectionSnapshot, bodyViewport, ensureKeyboardActiveCellVisible } = createControllerHarness({
      rowCount: 3,
      columnCount: 2,
    })
    const anchorCell = createCell(0, 0)
    const focusCell = createCell(0, 1)
    bodyViewport.parentElement?.appendChild(anchorCell)
    bodyViewport.parentElement?.appendChild(focusCell)

    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 1, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 1,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 1, rowId: "r1" },
      }],
    }

    controller.startFillHandleDrag(new MouseEvent("mousedown", {
      button: 0,
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    }))

    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 1, rowId: "r2" },
      ranges: [{
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: 1,
        startRowId: "r1",
        endRowId: "r2",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 1, colIndex: 1, rowId: "r2" },
      }],
    }

    const ensureCallsBeforeMouseUp = ensureKeyboardActiveCellVisible.mock.calls.length

    controller.handleWindowMouseUp()
    await nextTick()

    expect(ensureKeyboardActiveCellVisible.mock.calls.length).toBeGreaterThan(ensureCallsBeforeMouseUp)
    expect(ensureKeyboardActiveCellVisible).toHaveBeenCalledWith(0, 0)

    rafSpy.mockRestore()
  })
})
