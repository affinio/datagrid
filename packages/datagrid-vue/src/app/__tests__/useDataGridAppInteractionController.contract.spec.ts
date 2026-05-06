import { nextTick, ref } from "vue"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DataGridColumnSnapshot, DataGridRowId, DataGridRowNode, DataGridSelectionSnapshot } from "@affino/datagrid-core"
import { useDataGridAppInteractionController } from "../useDataGridAppInteractionController"

type DemoRow = Record<string, unknown>

interface DemoRowSnapshot {
  kind: "full" | "partial"
  rows: Array<{ rowId: string | number; row: DemoRow }>
}

interface DataGridAppResolveFillBoundaryRequest {
  direction: "up" | "down" | "left" | "right"
  baseRange: { startRow: number; endRow: number; startColumn: number; endColumn: number }
  fillColumns: readonly string[]
  referenceColumns: readonly string[]
  projection: unknown
  startRowIndex: number
  startColumnIndex: number
  limit?: number | null
}

interface DataGridAppResolveFillBoundaryResult {
  endRowIndex: number | null
  endRowId?: string | number | null
  boundaryKind: "data-end" | "gap" | "cache-boundary" | "projection-end" | "unresolved"
  scannedRowCount?: number
  truncated?: boolean
  revision?: string | null
  projectionHash?: string | null
  boundaryToken?: string | null
}

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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

async function flushAsync(): Promise<void> {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 0))
}

function createControllerHarness(options: {
  rowCount?: number
  loadedRowCount?: number
  columnCount?: number
  rowData?: readonly DemoRow[]
  missingRowIndices?: readonly number[]
  bodyRowAtIndex?: (rowIndex: number) => DataGridRowNode<DemoRow> | null | undefined
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
  runtimeRowModelDataSource?: Record<string, unknown>
  runtimeRowModelFallbackDataSource?: Record<string, unknown>
  materializeRowsOnRefresh?: boolean
  recordServerFillTransaction?: (descriptor: {
    intent: "fill"
    label: string
    affectedRange?: { startRow: number; endRow: number; startColumn: number; endColumn: number } | null
    operationId: string
    revision?: string | number | null
    mode: "copy" | "series"
  }) => void
  refreshServerFillViewport?: (range?: {
    startRow?: number
    endRow?: number
    startColumn?: number
    endColumn?: number
    start?: number
    end?: number
    kind?: "range" | "rows"
    rowIds?: readonly (string | number)[]
    range?: {
      startRow: number
      endRow: number
      startColumn: number
      endColumn: number
    }
  } | null) => void | Promise<void>
  reportFillPlumbingState?: (layer: string, present: boolean) => void
  resolveFillBoundary?: (
    request: DataGridAppResolveFillBoundaryRequest,
  ) => Promise<DataGridAppResolveFillBoundaryResult> | DataGridAppResolveFillBoundaryResult
} = {}) {
  const rowCount = options.rowCount ?? 1
  const loadedRowCount = options.loadedRowCount ?? rowCount
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
    const isLoaded = rowIndex < loadedRowCount
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
    if (!isLoaded) {
      return {
        rowId: `__datagrid_placeholder__:${rowIndex}`,
        __placeholder: true,
        kind: "leaf",
        data: {},
      }
    }
    return {
      rowId: `r${rowIndex + 1}`,
      kind: "data",
      data: options.rowData?.[rowIndex] ?? {},
    }
  }) as unknown as DataGridRowNode<DemoRow>[]
  let requestedViewportRange: { start: number; end: number } | null = null
  const materializeRowsInRange = (range: { start: number; end: number }): void => {
    rows = rows.map((nextRow, rowIndex) => {
      if (rowIndex < range.start || rowIndex > range.end || (nextRow as { __placeholder?: boolean }).__placeholder !== true) {
        return nextRow
      }
      return {
        rowId: `r${rowIndex + 1}`,
        kind: "data",
        data: options.rowData?.[rowIndex] ?? {},
      } as unknown as DataGridRowNode<DemoRow>
    }) as unknown as DataGridRowNode<DemoRow>[]
  }
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
  const applyEdits = vi.fn(async (updates: readonly { rowId: string | number; data: Partial<DemoRow> }[]) => {
    if (!Array.isArray(updates) || updates.length === 0) {
      return
    }
    const updatesByRowId = new Map<string | number, Partial<DemoRow>>()
    for (const update of updates) {
      if (!update || (typeof update.rowId !== "string" && typeof update.rowId !== "number") || !update.data) {
        continue
      }
      const previous = updatesByRowId.get(update.rowId)
      updatesByRowId.set(update.rowId, {
        ...(previous ?? {}),
        ...update.data,
      })
    }
    rows = rows.map(nextRow => {
      const patch = updatesByRowId.get(nextRow.rowId)
      if (!patch) {
        return nextRow
      }
      return {
        ...nextRow,
        data: {
          ...(nextRow.data as DemoRow),
          ...patch,
        },
      } as DataGridRowNode<DemoRow>
    }) as unknown as DataGridRowNode<DemoRow>[]
  })
  const applyClipboardEdits = vi.fn(() => 0)
  const buildFillMatrixFromRange = vi.fn(() => [[""]])
  const recordIntentTransaction = vi.fn()
  const reportFillWarning = vi.fn()
  const captureRowsSnapshotForRowIds = vi.fn((rowIds: readonly (string | number)[]): DemoRowSnapshot => ({
    kind: "partial",
    rows: rows
      .filter(nextRow => rowIds.includes(nextRow.rowId))
      .map(nextRow => ({
        rowId: nextRow.rowId,
        row: {
          ...(nextRow.data as DemoRow),
        },
      })),
  }))
  const clearPendingClipboardOperation = vi.fn(() => false)
  const syncViewport = vi.fn()
  const editingCell = ref<{ rowId: string | number; columnKey: string } | null>(null)
  const startInlineEdit = vi.fn()
  const appendInlineEditTextInput = vi.fn(() => false)
  const cancelInlineEdit = vi.fn()
  const commitInlineEdit = vi.fn()
  const expandGroup = vi.fn()
  const collapseGroup = vi.fn()
  const invalidateRange = vi.fn()
  const invalidateRows = vi.fn()
  const setViewportRange = vi.fn((range: { start: number; end: number }) => {
    requestedViewportRange = range
  })
  const refreshRows = vi.fn(async () => {
    if (options.materializeRowsOnRefresh && requestedViewportRange) {
      materializeRowsInRange(requestedViewportRange)
    }
  })

  const controller = useDataGridAppInteractionController<DemoRow, DemoRowSnapshot>({
    mode: ref(mode),
    enableFillHandle: ref(options.enableFillHandle ?? true),
    enableRangeMove: ref(options.enableRangeMove ?? true),
    runtime: {
        api: {
          rows: {
            get: (rowIndex: number) => {
              if (options.missingRowIndices?.includes(rowIndex)) {
                return null
              }
              if (options.bodyRowAtIndex) {
                return options.bodyRowAtIndex(rowIndex) ?? null
              }
              return rows[rowIndex] ?? null
            },
          getCount: () => rows.length,
          applyEdits,
          getSnapshot: () => ({
            sortModel: [],
            filterModel: null,
            groupBy: null,
            groupExpansion: { expandedByDefault: false, toggledGroupKeys: [] },
            pagination: {
              enabled: false,
              pageSize: 0,
              currentPage: 0,
              pageCount: 0,
              totalRowCount: rows.length,
              startIndex: 0,
              endIndex: Math.max(0, rows.length - 1),
            },
          }),
          expandGroup,
          collapseGroup,
          invalidateRange,
          refresh: refreshRows,
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
      setViewportRange,
      rowModel: {
        invalidateRange,
        invalidateRows,
        refresh: refreshRows,
        setViewportRange,
        dataSource: options.runtimeRowModelFallbackDataSource
          ? options.runtimeRowModelFallbackDataSource as never
          : undefined,
      },
    } as never,
    runtimeRowModel: options.runtimeRowModelDataSource
      ? {
          dataSource: options.runtimeRowModelDataSource as never,
        }
      : null,
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
    recordServerFillTransaction: options.recordServerFillTransaction,
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
    resolveFillBoundary: options.resolveFillBoundary,
    reportFillWarning,
    reportFillPlumbingState: options.reportFillPlumbingState,
    captureRowsSnapshot: vi.fn((): DemoRowSnapshot => ({
      kind: "full",
      rows: rows.map(nextRow => ({
        rowId: nextRow.rowId,
        row: {
          ...(nextRow.data as DemoRow),
        },
      })),
    })),
    captureRowsSnapshotForRowIds,
    recordIntentTransaction,
    clearPendingClipboardOperation,
    copySelectedCells: vi.fn(async () => false),
    pasteSelectedCells: vi.fn(async () => false),
    cutSelectedCells: vi.fn(async () => false),
    normalizeClipboardRange: range => range,
    applyClipboardEdits,
    rangesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    buildFillMatrixFromRange,
    refreshServerFillViewport: options.refreshServerFillViewport,
    syncViewport,
    editingCell,
    startInlineEdit,
    appendInlineEditTextInput,
    cancelInlineEdit,
    commitInlineEdit,
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
    getBodyRowAtIndex: (rowIndex: number) => rows[rowIndex] ?? null,
    applyCellSelectionByCoord,
    applySelectionRange,
    setSelectionSnapshot,
    ensureKeyboardActiveCellVisible,
    applyClipboardEdits,
    applyEdits,
    buildFillMatrixFromRange,
    clearPendingClipboardOperation,
    recordIntentTransaction,
    captureRowsSnapshotForRowIds,
    reportFillWarning,
    syncViewport,
    editingCell,
    startInlineEdit,
    appendInlineEditTextInput,
    cancelInlineEdit,
    commitInlineEdit,
    expandGroup,
    collapseGroup,
    invalidateRange,
    invalidateRows,
    setViewportRange,
    refreshRows,
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

  it("clears the selected range on Delete and records a clear intent", async () => {
    const {
      controller,
      row,
      setSelectionSnapshot,
      applyClipboardEdits,
      clearPendingClipboardOperation,
      recordIntentTransaction,
      syncViewport,
      reportFillWarning,
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
    await flushAsync()

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
    }, expect.objectContaining({
      kind: "partial",
    }))
    expect(syncViewport).toHaveBeenCalled()
    expect(reportFillWarning).not.toHaveBeenCalled()
  })

  it("blocks Delete when the selected range includes a missing unloaded row", async () => {
    const {
      controller,
      row,
      setSelectionSnapshot,
      applyClipboardEdits,
      clearPendingClipboardOperation,
      recordIntentTransaction,
      reportFillWarning,
      getBodyRowAtIndex,
    } = createControllerHarness({
      rowCount: 4,
      columnCount: 2,
      rowData: [
        { a: "alpha", b: "beta" },
        { a: "bravo", b: "charlie" },
      ],
      missingRowIndices: [2],
    })
    setSelectionSnapshot({
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 2,
        startCol: 0,
        endCol: 1,
        startRowId: "r1",
        endRowId: "__datagrid_placeholder__:2",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 2, colIndex: 1, rowId: null },
      }],
    })

    const keydown = new KeyboardEvent("keydown", {
      key: "Delete",
      cancelable: true,
    })

    controller.handleCellKeydown(keydown, row, 0, 0)
    await flushAsync()

    expect(keydown.defaultPrevented).toBe(true)
    expect(clearPendingClipboardOperation).not.toHaveBeenCalled()
    expect(applyClipboardEdits).not.toHaveBeenCalled()
    expect(recordIntentTransaction).not.toHaveBeenCalled()
    expect(reportFillWarning).toHaveBeenCalledWith(
      "Selected range includes unloaded rows. Load rows or use server operation.",
    )
    expect(getBodyRowAtIndex(0)?.data).toEqual({
      a: "alpha",
      b: "beta",
    })
    expect(getBodyRowAtIndex(1)?.data).toEqual({
      a: "bravo",
      b: "charlie",
    })
  })

  it("blocks Delete when the selected range includes a placeholder unloaded row", async () => {
    const {
      controller,
      row,
      setSelectionSnapshot,
      applyClipboardEdits,
      clearPendingClipboardOperation,
      recordIntentTransaction,
      reportFillWarning,
      getBodyRowAtIndex,
    } = createControllerHarness({
      rowCount: 4,
      loadedRowCount: 1,
      columnCount: 2,
      rowData: [
        { a: "alpha", b: "beta" },
      ],
    })
    setSelectionSnapshot({
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 2,
        startCol: 0,
        endCol: 1,
        startRowId: "r1",
        endRowId: "__datagrid_placeholder__:2",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 2, colIndex: 1, rowId: "__datagrid_placeholder__:2" },
      }],
    })

    const keydown = new KeyboardEvent("keydown", {
      key: "Delete",
      cancelable: true,
    })

    controller.handleCellKeydown(keydown, row, 0, 0)
    await flushAsync()

    expect(keydown.defaultPrevented).toBe(true)
    expect(clearPendingClipboardOperation).not.toHaveBeenCalled()
    expect(applyClipboardEdits).not.toHaveBeenCalled()
    expect(recordIntentTransaction).not.toHaveBeenCalled()
    expect(reportFillWarning).toHaveBeenCalledWith(
      "Selected range includes unloaded rows. Load rows or use server operation.",
    )
    expect(getBodyRowAtIndex(0)?.data).toEqual({
      a: "alpha",
      b: "beta",
    })
    expect((getBodyRowAtIndex(1) as { __placeholder?: boolean } | null)?.__placeholder).toBe(true)
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

  it("extends selection with Shift+Cmd/Ctrl+Arrow to the first blank gap like Excel", () => {
    const { controller, row, selectionSnapshot, setSelectionSnapshot } = createControllerHarness({
      rowCount: 1,
      columnCount: 4,
      rowData: [{
        a: "alpha",
        b: "beta",
        c: "",
        d: "tail",
      }],
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

    const keydown = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      shiftKey: true,
      metaKey: true,
      cancelable: true,
    })

    controller.handleCellKeydown(keydown, row, 0, 0)

    expect(keydown.defaultPrevented).toBe(true)
    expect(selectionSnapshot.value?.activeCell).toMatchObject({
      rowIndex: 0,
      colIndex: 1,
      rowId: "r1",
    })
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 0,
      startCol: 0,
      endCol: 1,
      anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      focus: { rowIndex: 0, colIndex: 1, rowId: "r1" },
    })
  })

  it("extends Shift+Cmd/Ctrl+ArrowDown and ArrowUp to logical row boundaries in server-backed mode", () => {
    const { controller, row, selectionSnapshot, setSelectionSnapshot } = createControllerHarness({
      rowCount: 6,
      loadedRowCount: 2,
      columnCount: 2,
      runtimeRowModelDataSource: {},
      rowData: [
        { a: "alpha", b: "beta" },
        { a: "bravo", b: "charlie" },
      ],
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

    const extendToEnd = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      shiftKey: true,
      metaKey: true,
      cancelable: true,
    })

    controller.handleCellKeydown(extendToEnd, row, 0, 0)

    expect(extendToEnd.defaultPrevented).toBe(true)
    expect(selectionSnapshot.value?.activeCell).toMatchObject({
      rowIndex: 5,
      colIndex: 0,
    })
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 5,
      startCol: 0,
      endCol: 0,
      anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      focus: { rowIndex: 5, colIndex: 0 },
    })

    const plainArrowDown = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      cancelable: true,
    })

    controller.handleCellKeydown(plainArrowDown, row, 0, 0)

    expect(plainArrowDown.defaultPrevented).toBe(true)
    expect(selectionSnapshot.value?.activeCell).toMatchObject({
      rowIndex: 1,
      colIndex: 0,
      rowId: "r2",
    })
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 1,
      endRow: 1,
      startCol: 0,
      endCol: 0,
      anchor: { rowIndex: 1, colIndex: 0, rowId: "r2" },
      focus: { rowIndex: 1, colIndex: 0, rowId: "r2" },
    })

    setSelectionSnapshot({
      activeRangeIndex: 0,
      activeCell: { rowIndex: 5, colIndex: 0, rowId: "r6" },
      ranges: [{
        startRow: 5,
        endRow: 5,
        startCol: 0,
        endCol: 0,
        startRowId: "r6",
        endRowId: "r6",
        anchor: { rowIndex: 5, colIndex: 0, rowId: "r6" },
        focus: { rowIndex: 5, colIndex: 0, rowId: "r6" },
      }],
    })

    const extendToStart = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      shiftKey: true,
      metaKey: true,
      cancelable: true,
    })

    controller.handleCellKeydown(extendToStart, row, 0, 0)

    expect(extendToStart.defaultPrevented).toBe(true)
    expect(selectionSnapshot.value?.activeCell).toMatchObject({
      rowIndex: 0,
      colIndex: 0,
    })
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 5,
      startCol: 0,
      endCol: 0,
      anchor: { rowIndex: 5, colIndex: 0, rowId: "r6" },
      focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
    })
  })

  it("extends Shift+Cmd/Ctrl+ArrowLeft and ArrowRight to logical column boundaries in server-backed mode", () => {
    const { controller, row, selectionSnapshot, setSelectionSnapshot } = createControllerHarness({
      rowCount: 3,
      loadedRowCount: 1,
      visibleColumns: [
        {
          key: "a",
          width: 2,
          pin: "center",
          column: {
            key: "a",
            label: "A",
          },
        },
        {
          key: "__datagrid_row_selection__",
          width: 2,
          pin: "left",
          column: {
            key: "__datagrid_row_selection__",
            label: "",
            meta: {
              isSystem: true,
              rowSelection: true,
            },
          },
        },
        {
          key: "b",
          width: 2,
          pin: "center",
          column: {
            key: "b",
            label: "B",
          },
        },
        {
          key: "c",
          width: 2,
          pin: "center",
          column: {
            key: "c",
            label: "C",
          },
        },
      ] as unknown as readonly DataGridColumnSnapshot[],
      runtimeRowModelDataSource: {},
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

    const plainArrowRight = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      cancelable: true,
    })

    controller.handleCellKeydown(plainArrowRight, row, 0, 0)

    expect(plainArrowRight.defaultPrevented).toBe(true)
    expect(selectionSnapshot.value?.activeCell).toMatchObject({
      rowIndex: 0,
      colIndex: 1,
      rowId: "r1",
    })
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 0,
      startCol: 1,
      endCol: 1,
      anchor: { rowIndex: 0, colIndex: 1, rowId: "r1" },
      focus: { rowIndex: 0, colIndex: 1, rowId: "r1" },
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

    const extendRight = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      shiftKey: true,
      metaKey: true,
      cancelable: true,
    })

    controller.handleCellKeydown(extendRight, row, 0, 0)

    expect(extendRight.defaultPrevented).toBe(true)
    expect(selectionSnapshot.value?.activeCell).toMatchObject({
      rowIndex: 0,
      colIndex: 3,
      rowId: "r1",
    })
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 0,
      startCol: 0,
      endCol: 3,
      anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      focus: { rowIndex: 0, colIndex: 3, rowId: "r1" },
    })

    setSelectionSnapshot({
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 3, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 3,
        endCol: 3,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 3, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 3, rowId: "r1" },
      }],
    })

    const plainArrowLeft = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      cancelable: true,
    })

    controller.handleCellKeydown(plainArrowLeft, row, 0, 0)

    expect(plainArrowLeft.defaultPrevented).toBe(true)
    expect(selectionSnapshot.value?.activeCell).toMatchObject({
      rowIndex: 0,
      colIndex: 2,
      rowId: "r1",
    })
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 0,
      startCol: 2,
      endCol: 2,
      anchor: { rowIndex: 0, colIndex: 2, rowId: "r1" },
      focus: { rowIndex: 0, colIndex: 2, rowId: "r1" },
    })

    setSelectionSnapshot({
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 3, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 3,
        endCol: 3,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 3, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 3, rowId: "r1" },
      }],
    })

    const extendLeft = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      shiftKey: true,
      metaKey: true,
      cancelable: true,
    })

    controller.handleCellKeydown(extendLeft, row, 0, 0)

    expect(extendLeft.defaultPrevented).toBe(true)
    expect(selectionSnapshot.value?.activeCell).toMatchObject({
      rowIndex: 0,
      colIndex: 0,
      rowId: "r1",
    })
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 0,
      startCol: 0,
      endCol: 3,
      anchor: { rowIndex: 0, colIndex: 3, rowId: "r1" },
      focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
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

  it("commits the previous inline editor without restoring its focus when pointer-selecting a new cell", () => {
    const { controller, row, editingCell, commitInlineEdit, applyCellSelectionByCoord } = createControllerHarness({
      rowCount: 3,
      columnCount: 3,
    })

    editingCell.value = {
      rowId: row.rowId ?? "r1",
      columnKey: "a",
    }

    const cell = createCell(0, 1)
    const pointerDown = createMouseEvent("mousedown", cell, {
      button: 0,
      clientX: 10,
      clientY: 10,
    })

    controller.handleCellMouseDown(pointerDown, row, 0, 1)

    expect(commitInlineEdit).toHaveBeenCalledWith("none")
    expect(applyCellSelectionByCoord).toHaveBeenCalledWith(
      expect.objectContaining({ rowIndex: 0, columnIndex: 1 }),
      false,
      expect.objectContaining({ rowIndex: 0, columnIndex: 1 }),
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

  it("commits server-backed range move as a single batch with source clears and target writes", async () => {
    const {
      controller,
      row,
      selectionSnapshot,
      applyEdits,
      recordIntentTransaction,
      syncViewport,
      applySelectionRange,
    } = createControllerHarness({
      rowCount: 2,
      columnCount: 2,
      columnWidths: [100, 100],
      shellWidth: 272,
      shellHeight: 80,
      indexColumnWidth: 72,
      resolveRowIndexAtOffset: offset => Math.max(0, Math.min(1, Math.floor(offset / 24))),
      rowData: [
        { a: "A1", b: "B1" },
        { a: "A2", b: "B2" },
      ],
      runtimeRowModelDataSource: {},
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

    const sourceCell = createCell(0, 0)
    const pointerDown = createMouseEvent("mousedown", sourceCell, {
      button: 0,
      altKey: true,
      clientX: 120,
      clientY: 12,
    })

    controller.handleCellMouseDown(pointerDown, row, 0, 0)
    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      altKey: true,
      clientX: 220,
      clientY: 36,
    }))
    controller.handleWindowMouseUp()
    await flushAsync()

    expect(applyEdits).toHaveBeenCalledTimes(1)
    expect(applyEdits).toHaveBeenCalledWith([
      { rowId: "r1", data: { a: "" } },
      { rowId: "r2", data: { b: "A1" } },
    ])
    expect(recordIntentTransaction).toHaveBeenCalledTimes(1)
    expect(recordIntentTransaction.mock.calls[0]?.[0]).toMatchObject({
      intent: "move",
      affectedRange: {
        startRow: 1,
        endRow: 1,
        startColumn: 1,
        endColumn: 1,
      },
    })
    expect(recordIntentTransaction.mock.calls[0]?.[1]).toMatchObject({
      kind: "partial",
      rows: [
        { rowId: "r1", row: { a: "A1", b: "B1" } },
        { rowId: "r2", row: { a: "A2", b: "B2" } },
      ],
    })
    expect(recordIntentTransaction.mock.calls[0]?.[2]).toMatchObject({
      kind: "partial",
      rows: [
        { rowId: "r1", row: { a: "", b: "B1" } },
        { rowId: "r2", row: { a: "A2", b: "A1" } },
      ],
    })
    expect(applySelectionRange).toHaveBeenCalledWith({
      startRow: 1,
      endRow: 1,
      startColumn: 1,
      endColumn: 1,
    })
    expect(syncViewport).toHaveBeenCalled()
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

  it("promotes the full dragged range into selection after a successful server fill commit", async () => {
    const elementFromPointSpy = vi.spyOn(document, "elementFromPoint")
    const commitFillOperation = vi.fn(async () => ({
      operationId: "fill-1",
      revision: "rev-1",
      affectedRowCount: 6,
      affectedCellCount: 6,
      invalidation: {
        kind: "range" as const,
        range: {
          startRow: 0,
          endRow: 5,
          startColumn: 0,
          endColumn: 0,
        },
        reason: "server-demo-fill",
      },
      warnings: [],
    }))
    const refreshServerFillViewport = vi.fn(async () => undefined)
    const { controller, selectionSnapshot } = createControllerHarness({
      rowCount: 6,
      loadedRowCount: 6,
      columnCount: 1,
      rowData: [
        { a: "seed" },
        { a: "" },
        { a: "" },
        { a: "" },
        { a: "" },
        { a: "" },
      ],
      runtimeRowModelDataSource: { commitFillOperation },
      refreshServerFillViewport,
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

    elementFromPointSpy.mockReturnValue(createCell(5, 0))
    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 10,
      clientY: 160,
      bubbles: true,
      cancelable: true,
    }))
    controller.handleWindowMouseUp()
    await flushAsync()

    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    expect(commitFillOperation).toHaveBeenCalledWith(expect.objectContaining({
      sourceRange: {
        startRow: 0,
        endRow: 0,
        startColumn: 0,
        endColumn: 0,
      },
      targetRange: {
        startRow: 0,
        endRow: 5,
        startColumn: 0,
        endColumn: 0,
      },
      mode: "copy",
    }))
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 5,
      startCol: 0,
      endCol: 0,
      anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      focus: { rowIndex: 5, colIndex: 0, rowId: "r6" },
    })
    expect(selectionSnapshot.value?.activeCell).toMatchObject({ rowIndex: 0, colIndex: 0, rowId: "r1" })
    expect(refreshServerFillViewport).toHaveBeenCalledWith(expect.objectContaining({
      kind: "range",
      range: {
        startRow: 0,
        endRow: 5,
        startColumn: 0,
        endColumn: 0,
      },
    }))

    elementFromPointSpy.mockRestore()
  })

  it("keeps the source selection when a server fill commit fails", async () => {
    const elementFromPointSpy = vi.spyOn(document, "elementFromPoint")
    const commitFillOperation = vi.fn(async () => null)
    const { controller, selectionSnapshot } = createControllerHarness({
      rowCount: 6,
      loadedRowCount: 6,
      columnCount: 1,
      runtimeRowModelDataSource: { commitFillOperation },
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
    elementFromPointSpy.mockReturnValue(createCell(5, 0))
    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 10,
      clientY: 160,
      bubbles: true,
      cancelable: true,
    }))
    controller.handleWindowMouseUp()
    await flushAsync()

    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 0,
      startCol: 0,
      endCol: 0,
    })
    expect(selectionSnapshot.value?.activeCell).toMatchObject({ rowIndex: 0, colIndex: 0, rowId: "r1" })

    elementFromPointSpy.mockRestore()
  })

  it("cancels an in-flight fill drag with Escape without promoting selection", async () => {
    const elementFromPointSpy = vi.spyOn(document, "elementFromPoint")
    const { controller, selectionSnapshot, applyClipboardEdits } = createControllerHarness({
      rowCount: 6,
      loadedRowCount: 6,
      columnCount: 1,
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
    elementFromPointSpy.mockReturnValue(createCell(5, 0))
    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 10,
      clientY: 160,
      bubbles: true,
      cancelable: true,
    }))
    controller.handleCellKeydown(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    }), {
      rowId: "r1",
      kind: "data",
      data: {},
    } as never, 0, 0)
    await flushAsync()

    expect(applyClipboardEdits).not.toHaveBeenCalled()
    expect(controller.fillPreviewRange.value).toBeNull()
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 0,
      startCol: 0,
      endCol: 0,
    })

    elementFromPointSpy.mockRestore()
  })

  it("keeps the full filled range selected for local drag-fill commits", async () => {
    const elementFromPointSpy = vi.spyOn(document, "elementFromPoint")
    const { controller, selectionSnapshot, applyClipboardEdits } = createControllerHarness({
      rowCount: 6,
      loadedRowCount: 6,
      columnCount: 1,
      rowData: [
        { a: "seed" },
        { a: "" },
        { a: "" },
        { a: "" },
        { a: "" },
        { a: "" },
      ],
    })

    applyClipboardEdits.mockReturnValue(5)
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
    elementFromPointSpy.mockReturnValue(createCell(5, 0))
    controller.handleWindowMouseMove(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 10,
      clientY: 160,
      bubbles: true,
      cancelable: true,
    }))
    controller.handleWindowMouseUp()
    await flushAsync()

    expect(applyClipboardEdits).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 5,
      startColumn: 0,
      endColumn: 0,
    }, expect.any(Array), expect.objectContaining({ recordHistoryLabel: "Fill edit" }))
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 5,
      startCol: 0,
      endCol: 0,
    })

    elementFromPointSpy.mockRestore()
  })

  it("suppresses fill-handle interactions when the feature is disabled", async () => {
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
    await expect(controller.applyLastFillBehavior("copy")).resolves.toBe(false)
  })

  it("falls back to the nearest contiguous reference column on the right when the left side has no extent", async () => {
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
    await flushAsync()

    expect(applyClipboardEdits).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 3,
      startColumn: 0,
      endColumn: 0,
    }, [["1"], ["2"], ["3"], ["4"]], { recordHistoryLabel: "Fill edit" })
  })

  it("uses datasource fill boundary resolution when available", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 4,
      endRowId: "r5",
      boundaryKind: "gap" as const,
    }))
    const { controller, selectionSnapshot, applyClipboardEdits, reportFillWarning } = createControllerHarness({
      rowCount: 5,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        { b: "task-2" },
        { b: "task-3" },
        { b: "task-4" },
        { b: "" },
      ],
      resolveFillBoundary,
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
    await flushAsync()

    expect(resolveFillBoundary).toHaveBeenCalled()
    expect(applyClipboardEdits).not.toHaveBeenCalled()
    expect(reportFillWarning).toHaveBeenCalledWith("server fill execution not implemented yet")
  })

  it("warns and does not partially fill when server boundary exceeds the safe threshold", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 750,
      endRowId: "r751",
      boundaryKind: "gap" as const,
    }))
    const { controller, selectionSnapshot, applyClipboardEdits, reportFillWarning } = createControllerHarness({
      rowCount: 800,
      loadedRowCount: 8,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        ...Array.from({ length: 799 }, () => ({ b: "task-x" })),
      ],
      resolveFillBoundary,
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
    await flushAsync()

    expect(resolveFillBoundary).toHaveBeenCalled()
    expect(applyClipboardEdits).not.toHaveBeenCalled()
    expect(reportFillWarning).toHaveBeenCalledWith("server fill execution not implemented yet")
  })

  it("does not apply edits for server-resolved unloaded fill ranges", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 750,
      endRowId: "r751",
      boundaryKind: "gap" as const,
    }))
    const { controller, selectionSnapshot, applyClipboardEdits, reportFillWarning } = createControllerHarness({
      rowCount: 800,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        ...Array.from({ length: 799 }, () => ({ b: "task-x" })),
      ],
      resolveFillBoundary,
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
    await flushAsync()

    expect(resolveFillBoundary).toHaveBeenCalled()
    expect(applyClipboardEdits).not.toHaveBeenCalled()
    expect(reportFillWarning).toHaveBeenCalledWith("server fill execution not implemented yet")
  })

  it("bounds cache-boundary double-click fill to contiguous materialized target rows", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 500,
      endRowId: "r501",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 500,
      truncated: true,
    }))
    const commitFillOperation = vi.fn(async () => ({
      operationId: "fill-1",
      revision: 1,
      affectedRowCount: 173,
      affectedCellCount: 173,
      invalidation: {
        kind: "range" as const,
        range: {
          startRow: 0,
          endRow: 173,
          startColumn: 0,
          endColumn: 0,
        },
      },
      warnings: [],
    }))
    const { controller, selectionSnapshot, applyClipboardEdits, reportFillWarning } = createControllerHarness({
      rowCount: 800,
      loadedRowCount: 174,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        ...Array.from({ length: 799 }, () => ({ b: "task-x" })),
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
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
    await flushAsync()

    expect(resolveFillBoundary).toHaveBeenCalled()
    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    expect(applyClipboardEdits).not.toHaveBeenCalled()
    const commitRequest = (commitFillOperation.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]?.[0]
    expect(commitRequest).toMatchObject({
      targetRange: {
        startRow: 0,
        endRow: 173,
        startColumn: 0,
        endColumn: 0,
      },
      sourceRowIds: ["r1"],
      targetRowIds: Array.from({ length: 174 }, (_unused, index) => `r${index + 1}`),
    })
    expect(reportFillWarning).toHaveBeenCalledWith(
      "Fill applied only to loaded rows; server range was truncated/not fully materialized (327 target rows missing).",
    )
    expect(reportFillWarning).not.toHaveBeenLastCalledWith("Fill truncated at cache boundary")
    expect(controller.fillPreviewRange.value).toBeNull()
  })

  it("attempts to materialize cache-boundary target rows before committing the server fill", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 5,
      endRowId: "r6",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 5,
      truncated: true,
    }))
    const commitFillOperation = vi.fn(async () => ({
      operationId: "fill-1",
      revision: 1,
      affectedRowCount: 5,
      affectedCellCount: 5,
      invalidation: {
        kind: "range" as const,
        range: {
          startRow: 0,
          endRow: 5,
          startColumn: 0,
          endColumn: 0,
        },
      },
      warnings: [],
    }))
    const { controller, selectionSnapshot, setViewportRange, refreshRows, reportFillWarning } = createControllerHarness({
      rowCount: 6,
      loadedRowCount: 2,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        ...Array.from({ length: 5 }, () => ({ b: "task-x" })),
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
      materializeRowsOnRefresh: true,
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
    await flushAsync()

    expect(resolveFillBoundary).toHaveBeenCalled()
    expect(setViewportRange).toHaveBeenCalledWith({ start: 0, end: 5 })
    expect(refreshRows).toHaveBeenCalled()
    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    const commitRequest = (commitFillOperation.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]?.[0]
    expect(commitRequest).toMatchObject({
      targetRange: {
        startRow: 0,
        endRow: 5,
        startColumn: 0,
        endColumn: 0,
      },
      sourceRowIds: ["r1"],
      targetRowIds: ["r1", "r2", "r3", "r4", "r5", "r6"],
    })
    expect(reportFillWarning).toHaveBeenCalledWith("Fill truncated at cache boundary")
  })

  it("warns with missing target count and skips commit when no non-source target rows are materialized", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 500,
      endRowId: "r501",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 500,
      truncated: true,
    }))
    const commitFillOperation = vi.fn(async () => ({
      operationId: "fill-1",
      revision: 1,
      affectedRowCount: 1,
      affectedCellCount: 1,
      invalidation: null,
      warnings: [],
    }))
    const reportFillPlumbingState = vi.fn()
    const { controller, selectionSnapshot, reportFillWarning } = createControllerHarness({
      rowCount: 800,
      loadedRowCount: 1,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        ...Array.from({ length: 799 }, () => ({ b: "task-x" })),
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
      reportFillPlumbingState,
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
    await flushAsync()

    expect(resolveFillBoundary).toHaveBeenCalled()
    expect(commitFillOperation).not.toHaveBeenCalled()
    expect(reportFillWarning).toHaveBeenCalledWith(
      "server fill target row ids are not fully materialized (500 target rows missing)",
    )
    expect(reportFillPlumbingState).not.toHaveBeenCalledWith("server-fill-committed", true)
    expect(controller.fillPreviewRange.value).toBeNull()
  })

  it("builds a non-empty cache-boundary preview range before server commit settles", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 2,
      endRowId: "r3",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 2,
      truncated: true,
    }))
    const commitFill = createDeferred<{
      operationId: string
      revision?: string | number | null
      affectedRowCount: number
      affectedCellCount?: number
      invalidation?: { kind: "range"; range: { startRow: number; endRow: number; startColumn: number; endColumn: number }; reason?: string } | null
      warnings?: readonly string[]
    } | null>()
    const commitFillOperation = vi.fn(() => commitFill.promise)
    const { controller, selectionSnapshot } = createControllerHarness({
      rowCount: 3,
      loadedRowCount: 3,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        { a: "2", b: "task-2" },
        { a: "3", b: "task-3" },
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
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
    await flushAsync()

    expect(resolveFillBoundary).toHaveBeenCalled()
    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    expect(controller.fillPreviewRange.value).toEqual({
      startRow: 0,
      endRow: 2,
      startColumn: 0,
      endColumn: 0,
    })

    commitFill.resolve({
      operationId: "fill-1",
      revision: 1,
      affectedRowCount: 3,
      affectedCellCount: 3,
      invalidation: {
        kind: "range",
        range: {
          startRow: 0,
          endRow: 2,
          startColumn: 0,
          endColumn: 0,
        },
      },
      warnings: [],
    })
    await flushAsync()

    expect(controller.fillPreviewRange.value).toBeNull()
  })

  it("clears cache-boundary preview when server commit fails", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 2,
      endRowId: "r3",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 2,
      truncated: true,
    }))
    const commitFillOperation = vi.fn(async () => {
      throw new Error("commit failed")
    })
    const { controller, selectionSnapshot, reportFillWarning } = createControllerHarness({
      rowCount: 3,
      loadedRowCount: 3,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        { a: "2", b: "task-2" },
        { a: "3", b: "task-3" },
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
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
    await flushAsync()

    expect(resolveFillBoundary).toHaveBeenCalled()
    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    expect(reportFillWarning).toHaveBeenCalledWith("server fill commit failed")
    expect(controller.fillPreviewRange.value).toBeNull()
  })

  it("clicking a cell cancels pending server fill preview and resets selection", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 2,
      endRowId: "r3",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 2,
      truncated: true,
    }))
    const commitFill = createDeferred<{
      operationId: string
      revision?: string | number | null
      affectedRowCount: number
      affectedCellCount?: number
      invalidation?: { kind: "range"; range: { startRow: number; endRow: number; startColumn: number; endColumn: number }; reason?: string } | null
      warnings?: readonly string[]
    } | null>()
    const commitFillOperation = vi.fn(() => commitFill.promise)
    const { controller, selectionSnapshot, getBodyRowAtIndex } = createControllerHarness({
      rowCount: 3,
      loadedRowCount: 3,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        { a: "2", b: "task-2" },
        { a: "3", b: "task-3" },
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
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
    await flushAsync()

    expect(controller.fillPreviewRange.value).toEqual({
      startRow: 0,
      endRow: 2,
      startColumn: 0,
      endColumn: 0,
    })

    const clickedCell = createCell(1, 1)
    const clickedRow = getBodyRowAtIndex(1)
    expect(clickedRow).not.toBeNull()
    controller.handleCellMouseDown(createMouseEvent("mousedown", clickedCell, {
      button: 0,
      clientX: 12,
      clientY: 36,
    }), clickedRow!, 1, 1)

    expect(controller.fillPreviewRange.value).toBeNull()
    expect(selectionSnapshot.value?.activeCell).toMatchObject({
      rowIndex: 1,
      colIndex: 1,
      rowId: "r2",
    })
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 1,
      endRow: 1,
      startCol: 1,
      endCol: 1,
    })

    commitFill.resolve({
      operationId: "fill-1",
      revision: 1,
      affectedRowCount: 3,
      affectedCellCount: 3,
      invalidation: {
        kind: "range",
        range: {
          startRow: 0,
          endRow: 2,
          startColumn: 0,
          endColumn: 0,
        },
      },
      warnings: [],
    })
    await flushAsync()

    expect(selectionSnapshot.value?.activeCell).toMatchObject({
      rowIndex: 0,
      colIndex: 0,
      rowId: "r1",
    })
    expect(controller.fillPreviewRange.value).toBeNull()
  })

  it("commits server fill for cache-boundary double-click ranges and sends projected row ids", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 2,
      endRowId: "r3",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 2,
      truncated: true,
    }))
    const commitFillOperation = vi.fn(async () => ({
      operationId: "fill-1",
      revision: 1,
      affectedRowCount: 3,
      affectedCellCount: 3,
      invalidation: {
        kind: "range" as const,
        range: {
          startRow: 0,
          endRow: 2,
          startColumn: 0,
          endColumn: 0,
        },
      },
      warnings: [],
    }))
    const { controller, selectionSnapshot, applyClipboardEdits, applySelectionRange, reportFillWarning } = createControllerHarness({
      rowCount: 3,
      loadedRowCount: 3,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        { a: "2", b: "task-2" },
        { a: "3", b: "task-3" },
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
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
    await flushAsync()

    expect(resolveFillBoundary).toHaveBeenCalled()
    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    expect(applyClipboardEdits).not.toHaveBeenCalled()
    expect(applySelectionRange).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 2,
      startColumn: 0,
      endColumn: 0,
    })
    expect(reportFillWarning).toHaveBeenCalledWith("Fill truncated at cache boundary")
    const commitRequest = (commitFillOperation.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]?.[0]
    expect(commitRequest).toMatchObject({
      sourceRange: {
        startRow: 0,
        endRow: 0,
        startColumn: 0,
        endColumn: 0,
      },
      targetRange: {
        startRow: 0,
        endRow: 2,
        startColumn: 0,
        endColumn: 0,
      },
      sourceRowIds: ["r1"],
      targetRowIds: ["r1", "r2", "r3"],
      fillColumns: ["a"],
      referenceColumns: ["a"],
      mode: "copy",
    })
  })

  it("forwards fill boundary consistency metadata into server fill commits and surfaces backend warnings", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 2,
      endRowId: "r3",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 2,
      truncated: false,
      revision: "rev-boundary-1",
      projectionHash: "hash-boundary-1",
      boundaryToken: "token-boundary-1",
    }))
    const commitFillOperation = vi.fn(async () => ({
      operationId: "fill-consistency-1",
      revision: "rev-fill-1",
      affectedRowCount: 3,
      affectedCellCount: 3,
      invalidation: {
        kind: "range" as const,
        range: {
          startRow: 0,
          endRow: 2,
          startColumn: 0,
          endColumn: 0,
        },
      },
      warnings: ["stale-revision", "projection-mismatch", "boundary-mismatch"],
    }))
    const { controller, selectionSnapshot, reportFillWarning } = createControllerHarness({
      rowCount: 3,
      loadedRowCount: 3,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        { a: "2", b: "task-2" },
        { a: "3", b: "task-3" },
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
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
    await flushAsync()

    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    const commitRequest = (commitFillOperation.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]?.[0]
    expect(commitRequest).toMatchObject({
      baseRevision: "rev-boundary-1",
      projectionHash: "hash-boundary-1",
      boundaryToken: "token-boundary-1",
      sourceRowIds: ["r1"],
      targetRowIds: ["r1", "r2", "r3"],
      fillColumns: ["a"],
      referenceColumns: ["a"],
      mode: "copy",
    })
    expect(reportFillWarning).toHaveBeenCalledTimes(3)
    expect(reportFillWarning).toHaveBeenNthCalledWith(1, "stale-revision")
    expect(reportFillWarning).toHaveBeenNthCalledWith(2, "projection-mismatch")
    expect(reportFillWarning).toHaveBeenNthCalledWith(3, "boundary-mismatch")
  })

  it("downgrades inferred server series double-click fill commits to copy mode", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 2,
      endRowId: "r3",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 2,
      truncated: false,
    }))
    const commitFillOperation = vi.fn(async () => ({
      operationId: "fill-1",
      revision: 1,
      affectedRowCount: 2,
      affectedCellCount: 2,
      invalidation: {
        kind: "range" as const,
        range: {
          startRow: 1,
          endRow: 2,
          startColumn: 0,
          endColumn: 0,
        },
      },
      warnings: [],
    }))
    const { controller, selectionSnapshot, buildFillMatrixFromRange, reportFillWarning } = createControllerHarness({
      rowCount: 3,
      loadedRowCount: 3,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        { a: "", b: "task-2" },
        { a: "", b: "task-3" },
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
    })

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
    await flushAsync()

    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    const commitRequest = (commitFillOperation.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]?.[0]
    expect(commitRequest).toMatchObject({
      mode: "copy",
      sourceRowIds: ["r1"],
      targetRowIds: ["r1", "r2", "r3"],
      fillColumns: ["a"],
      referenceColumns: ["a"],
    })
    expect(commitRequest?.mode).not.toBe("series")
    expect(reportFillWarning).toHaveBeenCalledWith(
      "Series fill is not supported by the server datasource yet; using copy fill.",
    )
  })

  it("registers a successful server fill operation id in server history", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 2,
      endRowId: "r3",
      boundaryKind: "data-end" as const,
      scannedRowCount: 2,
      truncated: false,
    }))
    const commitFillOperation = vi.fn(async () => ({
      operationId: "fill-history-1",
      revision: "rev-fill-1",
      affectedRowCount: 2,
      affectedCellCount: 2,
      invalidation: {
        kind: "range" as const,
        range: {
          startRow: 1,
          endRow: 2,
          startColumn: 0,
          endColumn: 0,
        },
      },
      warnings: [],
    }))
    const recordServerFillTransaction = vi.fn()
    const { controller, selectionSnapshot } = createControllerHarness({
      rowCount: 3,
      loadedRowCount: 3,
      columnCount: 2,
      rowData: [
        { a: "Atlas", b: "task-1" },
        { a: "", b: "task-2" },
        { a: "", b: "task-3" },
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
      recordServerFillTransaction,
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
    await flushAsync()

    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    expect(recordServerFillTransaction).toHaveBeenCalledTimes(1)
    expect(recordServerFillTransaction).toHaveBeenCalledWith({
      intent: "fill",
      label: "Server fill",
      affectedRange: {
        startRow: 1,
        endRow: 2,
        startColumn: 0,
        endColumn: 0,
      },
      operationId: "fill-history-1",
      revision: "rev-fill-1",
      mode: "copy",
    })
  })

  it("warns and does not register server fill history when a successful commit has no operation id", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 2,
      endRowId: "r3",
      boundaryKind: "data-end" as const,
      scannedRowCount: 2,
      truncated: false,
    }))
    const commitFillOperation = vi.fn(async () => ({
      operationId: "",
      revision: "rev-fill-1",
      affectedRowCount: 2,
      affectedCellCount: 2,
      invalidation: {
        kind: "range" as const,
        range: {
          startRow: 1,
          endRow: 2,
          startColumn: 0,
          endColumn: 0,
        },
      },
      warnings: [],
    }))
    const recordServerFillTransaction = vi.fn()
    const refreshServerFillViewport = vi.fn()
    const { controller, selectionSnapshot, reportFillWarning } = createControllerHarness({
      rowCount: 3,
      loadedRowCount: 3,
      columnCount: 2,
      rowData: [
        { a: "Atlas", b: "task-1" },
        { a: "", b: "task-2" },
        { a: "", b: "task-3" },
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
      recordServerFillTransaction,
      refreshServerFillViewport,
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
    await flushAsync()

    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    expect(recordServerFillTransaction).not.toHaveBeenCalled()
    expect(refreshServerFillViewport).toHaveBeenCalledWith({
      kind: "range",
      range: {
        startRow: 1,
        endRow: 2,
        startColumn: 0,
        endColumn: 0,
      },
    })
    expect(reportFillWarning).toHaveBeenCalledWith("server fill committed without operation id; undo/redo disabled")
  })

  it("refreshes the server fill viewport after a successful materialized double-click commit", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 2,
      endRowId: "srv-000002",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 2,
      truncated: true,
    }))
    const commitFillOperation = vi.fn(async () => ({
      operationId: "fill-status",
      revision: "rev-2",
      affectedRowCount: 2,
      affectedCellCount: 2,
      invalidation: {
        kind: "range" as const,
        range: {
          start: 1,
          end: 2,
        },
        reason: "server-demo-fill",
      },
      warnings: [],
    }))
    const refreshServerFillViewport = vi.fn(async () => undefined)
    const reportFillPlumbingState = vi.fn()
    const visibleColumns = [
      { key: "status", width: 2, pin: "center", column: { key: "status", label: "Status" } },
      { key: "region", width: 2, pin: "center", column: { key: "region", label: "Region" } },
    ] as unknown as readonly DataGridColumnSnapshot[]
    const { controller, selectionSnapshot, applyClipboardEdits } = createControllerHarness({
      rowCount: 3,
      loadedRowCount: 3,
      visibleColumns,
      rowData: [
        { status: "Active", region: "AMER" },
        { status: "Paused", region: "EMEA" },
        { status: "Closed", region: "APAC" },
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
      refreshServerFillViewport,
      reportFillPlumbingState,
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
    await flushAsync()

    expect(resolveFillBoundary).toHaveBeenCalled()
    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    expect(applyClipboardEdits).not.toHaveBeenCalled()
    expect(refreshServerFillViewport).toHaveBeenCalledTimes(1)
    expect(refreshServerFillViewport).toHaveBeenCalledWith({
      kind: "range",
      range: {
        start: 1,
        end: 2,
      },
      reason: "server-demo-fill",
    })
    expect(selectionSnapshot.value?.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 2,
      startCol: 0,
      endCol: 0,
      anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      focus: { rowIndex: 2, colIndex: 0, rowId: "r3" },
    })
    expect(reportFillPlumbingState).toHaveBeenCalledWith("server-fill-committed", true)
    const commitRequest = (commitFillOperation.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]?.[0]
    expect(commitRequest).toMatchObject({
      sourceRowIds: ["r1"],
      targetRowIds: ["r1", "r2", "r3"],
      fillColumns: ["status"],
      referenceColumns: ["status"],
      mode: "copy",
    })
  })

  it("treats a zero affected-cell server fill as an explicit no-op instead of success", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 2,
      endRowId: "r3",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 2,
      truncated: false,
    }))
    const commitFillOperation = vi.fn(async () => ({
      operationId: "fill-noop",
      revision: 1,
      affectedRowCount: 1,
      affectedCellCount: 0,
      invalidation: {
        kind: "range" as const,
        range: {
          startRow: 0,
          endRow: 2,
          startColumn: 0,
          endColumn: 0,
        },
      },
      warnings: [],
    }))
    const refreshServerFillViewport = vi.fn(async () => undefined)
    const reportFillPlumbingState = vi.fn()
    const { controller, selectionSnapshot, applySelectionRange, reportFillWarning } = createControllerHarness({
      rowCount: 3,
      loadedRowCount: 3,
      columnCount: 2,
      rowData: [
        { a: "same", b: "ref-1" },
        { a: "same", b: "ref-2" },
        { a: "same", b: "ref-3" },
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
      refreshServerFillViewport,
      reportFillPlumbingState,
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
    await flushAsync()

    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    expect(reportFillWarning).toHaveBeenCalledWith("server fill no-op")
    expect(refreshServerFillViewport).not.toHaveBeenCalled()
    expect(applySelectionRange).not.toHaveBeenCalledWith({
      startRow: 0,
      endRow: 2,
      startColumn: 0,
      endColumn: 0,
    })
    expect(reportFillPlumbingState).not.toHaveBeenCalledWith("server-fill-committed", true)
    expect(controller.fillPreviewRange.value).toBeNull()
  })

  it.each(["data-end", "gap"] as const)("commits server fill for %s double-click boundaries", async boundaryKind => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 2,
      endRowId: "r3",
      boundaryKind,
      scannedRowCount: 2,
      truncated: false,
    }))
    const commitFillOperation = vi.fn(async () => ({
      operationId: `fill-${boundaryKind}`,
      revision: 1,
      affectedRowCount: 3,
      affectedCellCount: 3,
      invalidation: {
        kind: "range" as const,
        range: {
          startRow: 0,
          endRow: 2,
          startColumn: 0,
          endColumn: 0,
        },
      },
      warnings: [],
    }))
    const { controller, selectionSnapshot, applyClipboardEdits } = createControllerHarness({
      rowCount: 3,
      loadedRowCount: 3,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        { a: "2", b: "task-2" },
        { a: "3", b: "task-3" },
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
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
    await flushAsync()

    expect(resolveFillBoundary).toHaveBeenCalled()
    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    expect(applyClipboardEdits).not.toHaveBeenCalled()
    const commitRequest = (commitFillOperation.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]?.[0]
    expect(commitRequest).toMatchObject({
      targetRange: {
        startRow: 0,
        endRow: 2,
        startColumn: 0,
        endColumn: 0,
      },
      sourceRowIds: ["r1"],
      targetRowIds: ["r1", "r2", "r3"],
    })
  })

  it("uses the runtime rowModel fallback when the controller datasource only resolves boundaries", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 2,
      endRowId: "r3",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 2,
      truncated: true,
    }))
    const commitFillOperation = vi.fn(async () => ({
      operationId: "fill-1",
      revision: 1,
      affectedRowCount: 3,
      affectedCellCount: 3,
      invalidation: {
        kind: "range" as const,
        range: {
          startRow: 0,
          endRow: 2,
          startColumn: 0,
          endColumn: 0,
        },
      },
      warnings: [],
    }))
    const { controller, selectionSnapshot, applyClipboardEdits } = createControllerHarness({
      rowCount: 3,
      loadedRowCount: 3,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        { a: "2", b: "task-2" },
        { a: "3", b: "task-3" },
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { resolveFillBoundary },
      runtimeRowModelFallbackDataSource: { commitFillOperation },
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
    await flushAsync()

    expect(resolveFillBoundary).toHaveBeenCalled()
    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    expect(applyClipboardEdits).not.toHaveBeenCalled()
  })

  it("normalizes server fill invalidation to a row-model viewport range when falling back to direct invalidation", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 500,
      endRowId: "r501",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 500,
      truncated: true,
    }))
    const commitFillOperation = vi.fn(async () => ({
      operationId: "fill-1",
      revision: 1,
      affectedRowCount: 12,
      affectedCellCount: 12,
      invalidation: {
        kind: "range" as const,
        range: {
          startRow: 0,
          endRow: 500,
          startColumn: 4,
          endColumn: 4,
        },
      },
      warnings: [],
    }))
    const { controller, selectionSnapshot, applyClipboardEdits, invalidateRange, reportFillWarning } = createControllerHarness({
      rowCount: 501,
      loadedRowCount: 501,
      columnCount: 5,
      rowData: [
        { region: "AMER" },
        ...Array.from({ length: 500 }, () => ({ region: "LATAM" })),
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
    })

    selectionSnapshot.value = {
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 4, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 4,
        endCol: 4,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 4, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 4, rowId: "r1" },
      }],
    }

    controller.startFillHandleDoubleClick(new MouseEvent("dblclick", {
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    }))
    await flushAsync()

    expect(resolveFillBoundary).toHaveBeenCalled()
    expect(commitFillOperation).toHaveBeenCalled()
    expect(applyClipboardEdits).not.toHaveBeenCalled()
    expect(invalidateRange).toHaveBeenCalledWith({ start: 0, end: 500 })
    expect(reportFillWarning).toHaveBeenCalledWith("Fill truncated at cache boundary")
  })

  it("routes server row invalidation through invalidateRows without triggering a full refresh", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: 2,
      endRowId: "r3",
      boundaryKind: "cache-boundary" as const,
      scannedRowCount: 2,
      truncated: false,
    }))
    const commitFillOperation = vi.fn(async () => ({
      operationId: "fill-rows",
      revision: 1,
      affectedRowCount: 2,
      affectedCellCount: 2,
      invalidation: {
        kind: "rows" as const,
        rowIds: ["r2", "r3"],
        reason: "server-demo-fill",
      },
      warnings: [],
    }))
    const { controller, selectionSnapshot, invalidateRows, invalidateRange, refreshRows } = createControllerHarness({
      rowCount: 3,
      loadedRowCount: 3,
      columnCount: 2,
      rowData: [
        { status: "Active", region: "AMER" },
        { status: "Paused", region: "EMEA" },
        { status: "Closed", region: "APAC" },
      ],
      resolveFillBoundary,
      runtimeRowModelDataSource: { commitFillOperation },
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
    await flushAsync()

    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    expect(invalidateRows).toHaveBeenCalledWith(["r2", "r3"])
    expect(invalidateRange).not.toHaveBeenCalled()
    expect(refreshRows).not.toHaveBeenCalled()
  })

  it("applies optimistic server fill edits locally before commitFillOperation resolves when the target range is fully materialized", async () => {
    const commitFill = createDeferred<{
      operationId: string
      revision?: string | number | null
      affectedRowCount: number
      affectedCellCount?: number
      invalidation?: { kind: "range"; range: { startRow: number; endRow: number; startColumn: number; endColumn: number }; reason?: string } | null
      warnings?: readonly string[]
    } | null>()
    const commitFillOperation = vi.fn(() => commitFill.promise)
    const { controller, applyEdits, buildFillMatrixFromRange, captureRowsSnapshotForRowIds, invalidateRange, syncViewport } = createControllerHarness({
      rowCount: 300,
      loadedRowCount: 300,
      columnCount: 1,
      rowData: [
        { a: "Atlas" },
        ...Array.from({ length: 299 }, () => ({ a: "" })),
      ],
      runtimeRowModelDataSource: { commitFillOperation },
    })

    buildFillMatrixFromRange.mockReturnValue([["Atlas"]])
    controller.lastAppliedFill.value = {
      baseRange: {
        startRow: 0,
        endRow: 0,
        startColumn: 0,
        endColumn: 0,
      },
      previewRange: {
        startRow: 0,
        endRow: 299,
        startColumn: 0,
        endColumn: 0,
      },
      behavior: "copy",
      allowBehaviorToggle: true,
    }

    const applyPromise = controller.applyLastFillBehavior("copy")
    await flushAsync()

    expect(commitFillOperation).toHaveBeenCalled()
    expect(applyEdits).toHaveBeenCalled()
    expect(captureRowsSnapshotForRowIds(["r2", "r3"]).rows).toEqual([
      { rowId: "r2", row: { a: "Atlas" } },
      { rowId: "r3", row: { a: "Atlas" } },
    ])

    commitFill.resolve({
      operationId: "fill-1",
      revision: 1,
      affectedRowCount: 300,
      affectedCellCount: 300,
      invalidation: {
        kind: "range",
        range: {
          startRow: 0,
          endRow: 299,
          startColumn: 0,
          endColumn: 0,
        },
      },
      warnings: [],
    })
    await expect(applyPromise).resolves.toBe(true)

    expect(invalidateRange).toHaveBeenCalledWith({ start: 0, end: 299 })
    expect(syncViewport).not.toHaveBeenCalled()
    expect(captureRowsSnapshotForRowIds(["r2", "r3"]).rows).toEqual([
      { rowId: "r2", row: { a: "Atlas" } },
      { rowId: "r3", row: { a: "Atlas" } },
    ])
  })

  it("rolls back optimistic server fill edits when commitFillOperation fails", async () => {
    const commitFill = createDeferred<never>()
    const commitFillOperation = vi.fn(() => commitFill.promise)
    const { controller, applyEdits, buildFillMatrixFromRange, captureRowsSnapshotForRowIds, reportFillWarning } = createControllerHarness({
      rowCount: 300,
      loadedRowCount: 300,
      columnCount: 1,
      rowData: [
        { a: "Atlas" },
        ...Array.from({ length: 299 }, () => ({ a: "" })),
      ],
      runtimeRowModelDataSource: { commitFillOperation },
    })

    buildFillMatrixFromRange.mockReturnValue([["Atlas"]])
    controller.lastAppliedFill.value = {
      baseRange: {
        startRow: 0,
        endRow: 0,
        startColumn: 0,
        endColumn: 0,
      },
      previewRange: {
        startRow: 0,
        endRow: 299,
        startColumn: 0,
        endColumn: 0,
      },
      behavior: "copy",
      allowBehaviorToggle: true,
    }

    const applyPromise = controller.applyLastFillBehavior("copy")
    await flushAsync()

    expect(commitFillOperation).toHaveBeenCalled()
    expect(applyEdits).toHaveBeenCalled()
    expect(captureRowsSnapshotForRowIds(["r2", "r3"]).rows).toEqual([
      { rowId: "r2", row: { a: "Atlas" } },
      { rowId: "r3", row: { a: "Atlas" } },
    ])

    commitFill.reject(new Error("commit failed"))
    await expect(applyPromise).resolves.toBe(false)

    expect(reportFillWarning).toHaveBeenCalledWith("server fill commit failed")
    expect(captureRowsSnapshotForRowIds(["r2", "r3"]).rows).toEqual([
      { rowId: "r2", row: { a: "" } },
      { rowId: "r3", row: { a: "" } },
    ])
  })

  it("commits only the materialized target prefix without optimistic local patching when the server fill target range is partial", async () => {
    const commitFill = createDeferred<{
      operationId: string
      revision?: string | number | null
      affectedRowCount: number
      affectedCellCount?: number
      invalidation?: { kind: "range"; range: { startRow: number; endRow: number; startColumn: number; endColumn: number }; reason?: string } | null
      warnings?: readonly string[]
    } | null>()
    const commitFillOperation = vi.fn(() => commitFill.promise)
    const { controller, applyEdits, buildFillMatrixFromRange, captureRowsSnapshotForRowIds, reportFillWarning } = createControllerHarness({
      rowCount: 300,
      loadedRowCount: 48,
      columnCount: 1,
      rowData: [
        { a: "Atlas" },
        ...Array.from({ length: 299 }, () => ({ a: "" })),
      ],
      runtimeRowModelDataSource: { commitFillOperation },
    })

    buildFillMatrixFromRange.mockReturnValue([["Atlas"]])
    controller.lastAppliedFill.value = {
      baseRange: {
        startRow: 0,
        endRow: 0,
        startColumn: 0,
        endColumn: 0,
      },
      previewRange: {
        startRow: 0,
        endRow: 299,
        startColumn: 0,
        endColumn: 0,
      },
      behavior: "copy",
      allowBehaviorToggle: true,
    }

    const applyPromise = controller.applyLastFillBehavior("copy")
    await flushAsync()

    expect(commitFillOperation).toHaveBeenCalledTimes(1)
    expect(applyEdits).not.toHaveBeenCalled()
    const commitRequest = (commitFillOperation.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]?.[0]
    expect(commitRequest).toMatchObject({
      targetRange: {
        startRow: 0,
        endRow: 47,
        startColumn: 0,
        endColumn: 0,
      },
      sourceRowIds: ["r1"],
      targetRowIds: Array.from({ length: 48 }, (_unused, index) => `r${index + 1}`),
    })
    expect(captureRowsSnapshotForRowIds(["r2", "r3"]).rows).toEqual([
      { rowId: "r2", row: { a: "" } },
      { rowId: "r3", row: { a: "" } },
    ])
    commitFill.resolve({
      operationId: "fill-1",
      revision: 1,
      affectedRowCount: 47,
      affectedCellCount: 47,
      invalidation: {
        kind: "range",
        range: {
          startRow: 0,
          endRow: 47,
          startColumn: 0,
          endColumn: 0,
        },
      },
      warnings: [],
    })
    await expect(applyPromise).resolves.toBe(true)
    expect(reportFillWarning).toHaveBeenCalledWith(
      "Fill applied only to loaded rows; server range was truncated/not fully materialized (252 target rows missing).",
    )
  })

  it("falls back to loaded-cache boundary discovery when server boundary is unresolved", async () => {
    const resolveFillBoundary = vi.fn(async () => ({
      endRowIndex: null,
      boundaryKind: "unresolved" as const,
    }))
    const { controller, selectionSnapshot, applyClipboardEdits, reportFillWarning } = createControllerHarness({
      rowCount: 5,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        { b: "task-2" },
        { b: "task-3" },
        { b: "stop" },
        {},
      ],
      resolveFillBoundary,
    })

    applyClipboardEdits.mockReturnValue(3)
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
    await flushAsync()

    expect(reportFillWarning).toHaveBeenCalledWith("server fill boundary unresolved; using loaded-cache fallback")
    expect(applyClipboardEdits).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 3,
      startColumn: 0,
      endColumn: 0,
    }, expect.any(Array), expect.objectContaining({ recordHistoryLabel: "Fill edit" }))
  })

  it("prefers the left reference side before using the right side for fill-handle double click", async () => {
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
    await flushAsync()

    expect(applyClipboardEdits).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 2,
      startColumn: 1,
      endColumn: 1,
    }, [["1"], ["2"], ["3"]], { recordHistoryLabel: "Fill edit" })
  })

  it("keeps local numeric double-click fill using series behavior", async () => {
    const { controller, selectionSnapshot, applyClipboardEdits, buildFillMatrixFromRange } = createControllerHarness({
      rowCount: 4,
      columnCount: 2,
      rowData: [
        { a: "1", b: "task-1" },
        { b: "task-2" },
        { b: "task-3" },
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
    await flushAsync()

    expect(applyClipboardEdits).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 2,
      startColumn: 0,
      endColumn: 0,
    }, [["1"], ["2"], ["3"]], { recordHistoryLabel: "Fill edit" })
  })

  it("clears the removed tail when a repeated fill drag shrinks back toward the base range", async () => {
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
    await flushAsync()

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


  it("does not apply fill-down from a blocked anchor cell", async () => {
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
    await flushAsync()

    expect(applyClipboardEdits).not.toHaveBeenCalled()
    expect(controller.lastAppliedFill.value).toBeNull()
  })
  it("marks plain-text fills as not offering a fill behavior toggle", async () => {
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
    await flushAsync()

    expect(applyClipboardEdits).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 2,
      startColumn: 0,
      endColumn: 0,
    }, [["Atlas"], ["Atlas"], ["Atlas"]], { recordHistoryLabel: "Fill edit" })
    expect(controller.lastAppliedFill.value).toMatchObject({
      behavior: "copy",
      allowBehaviorToggle: false,
    })
  })

  it("reapplies the last fill with an explicit behavior override", async () => {
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

    await expect(controller.applyLastFillBehavior("copy")).resolves.toBe(true)
    expect(applyClipboardEdits).toHaveBeenCalledWith({
      startRow: 0,
      endRow: 3,
      startColumn: 0,
      endColumn: 0,
    }, [["1"], ["1"], ["1"], ["1"]], { recordHistoryLabel: "Fill edit" })
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
