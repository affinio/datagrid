import type {
  DataGridApi,
  DataGridClientRowPatch,
  DataGridColumnModel,
  DataGridColumnSnapshot,
  DataGridRowId,
  DataGridRowNode,
} from "@affino/datagrid-core"
import {
  useDataGridAxisAutoScrollDelta,
  useDataGridPointerAutoScroll,
  useDataGridPointerPreviewRouter,
  useDataGridRangeMoveLifecycle,
  useDataGridRangeMoveStart,
  type DataGridClipboardRange,
} from "@affino/datagrid-orchestration"
import { createHistoryPatch, createHistorySnapshot, type DomHistoryIntent } from "./historyController.js"
import { validateClipboardValue } from "./clipboardController.js"
import { renderDomRangeOverlay } from "./rangeOverlay.js"

const MOVE_THRESHOLD_PX = 5
const RANGE_MOVE_EDGE_ZONE_PX = 7

export function createDomRangeMoveController<TRow>(options: {
  grid: HTMLElement
  api: DataGridApi<TRow>
  columnModel: DataGridColumnModel
  runWithRenderBatch: (operation: () => Promise<void>) => Promise<void>
  recordIntent: (intent: DomHistoryIntent<TRow>) => Promise<string | null>
  setCellSelection: (
    point: { rowIndex: number; colIndex: number; rowId: unknown },
    anchor: { rowIndex: number; colIndex: number; rowId: unknown },
    origin: string,
  ) => void
}) {
  type Coord = { rowIndex: number; columnIndex: number; rowId: DataGridRowId }
  const { grid, api, columnModel } = options
  const document = grid.ownerDocument
  const window = document.defaultView
  const renderedCells = new Map<string, HTMLElement>()
  const overlays: HTMLElement[] = []
  let pending: { pointerId: number; startX: number; startY: number; origin: Coord } | null = null
  let pointer: { clientX: number; clientY: number; target: EventTarget | null } | null = null
  let rangeMoving = false
  let baseRange: DataGridClipboardRange | null = null
  let previewRange: DataGridClipboardRange | null = null
  let suppressNextClick = false
  let lastClickOutcomeTimer: number | null = null
  let hoveredPointer: { clientX: number; clientY: number; target: EventTarget | null } | null = null
  let hoveredCell: HTMLElement | null = null

  const keyFor = (rowIndex: number, columnIndex: number): string => `${rowIndex}:${columnIndex}`
  const visibleColumns = () => columnModel.getSnapshot().visibleColumns

  function resolveSelectionRange(): DataGridClipboardRange | null {
    if (api.selection.getSnapshotStatus() !== "current") return null
    const snapshot = api.selection.getSnapshot()
    const range = snapshot?.ranges[snapshot.activeRangeIndex]
    if (range) {
      return {
        startRow: Math.min(range.startRow, range.endRow),
        endRow: Math.max(range.startRow, range.endRow),
        startColumn: Math.min(range.startCol, range.endCol),
        endColumn: Math.max(range.startCol, range.endCol),
      }
    }
    const active = snapshot?.activeCell
    return active
      ? { startRow: active.rowIndex, endRow: active.rowIndex, startColumn: active.colIndex, endColumn: active.colIndex }
      : null
  }

  function isInside(coord: Coord, range: DataGridClipboardRange): boolean {
    return coord.rowIndex >= range.startRow && coord.rowIndex <= range.endRow
      && coord.columnIndex >= range.startColumn && coord.columnIndex <= range.endColumn
  }

  function resolveCell(target: EventTarget | null): HTMLElement | null {
    const element = target as Element | null
    const cell = element?.closest?.<HTMLElement>(".affino-grid-dom__cell[data-row-index][data-column-index]") ?? null
    return cell && grid.contains(cell) ? cell : null
  }

  function resolveCoord(cell: HTMLElement | null): Coord | null {
    if (!cell) return null
    const rowIndex = Number(cell.dataset.rowIndex)
    const columnIndex = Number(cell.dataset.columnIndex)
    const row = api.rows.get(rowIndex)
    if (!row || row.kind !== "leaf" || !Number.isInteger(columnIndex)) return null
    return { rowIndex, columnIndex, rowId: row.rowId }
  }

  function resolveCoordFromPointer(clientX: number, clientY: number): Coord | null {
    const cell = resolveCell(document.elementFromPoint?.(clientX, clientY) ?? pointer?.target ?? null)
    return resolveCoord(cell)
  }

  function clearOverlays(): void {
    for (const overlay of overlays) overlay.remove()
    overlays.length = 0
  }

  function renderPreview(): void {
    clearOverlays()
    if (!rangeMoving || !baseRange || !previewRange || rangesEqual(baseRange, previewRange)) return
    overlays.push(...renderDomRangeOverlay({
      grid,
      cells: renderedCells,
      columnPins: visibleColumns().map(column => column.pin),
      range: previewRange,
      className: "affino-grid-dom__range-move-overlay",
      dataAttribute: "rangeMovePreviewOverlay",
    }))
  }

  function clearMoveState(): void {
    rangeMoving = false
    delete grid.dataset.rangeMoving
    baseRange = null
    previewRange = null
    pointer = null
    renderPreview()
  }

  async function applyRangeMove(): Promise<boolean> {
    const sourceRange = baseRange
    const targetRange = previewRange
    if (!sourceRange || !targetRange || rangesEqual(sourceRange, targetRange)) return false
    const entries: Array<{
      sourceRowId: DataGridRowId
      sourceKey: string
      sourceValue: unknown
      sourceColumn: DataGridColumnSnapshot
      sourceRow: DataGridRowNode<TRow>
      targetRowId: DataGridRowId
      targetKey: string
      targetValue: unknown
      targetColumn: DataGridColumnSnapshot
      targetRow: DataGridRowNode<TRow>
    }> = []
    const columns = visibleColumns()
    for (let rowOffset = 0; rowOffset <= sourceRange.endRow - sourceRange.startRow; rowOffset += 1) {
      const sourceRow = api.rows.get(sourceRange.startRow + rowOffset)
      const targetRow = api.rows.get(targetRange.startRow + rowOffset)
      if (!sourceRow || sourceRow.kind !== "leaf" || sourceRow.rowId == null
        || !targetRow || targetRow.kind !== "leaf" || targetRow.rowId == null) return false
      for (let columnOffset = 0; columnOffset <= sourceRange.endColumn - sourceRange.startColumn; columnOffset += 1) {
        const sourceColumn = columns[sourceRange.startColumn + columnOffset]
        const targetColumn = columns[targetRange.startColumn + columnOffset]
        if (!sourceColumn || !targetColumn
          || sourceColumn.column.capabilities?.editable !== true
          || targetColumn.column.capabilities?.editable !== true) return false
        const source = api.cells.resolveValue({ rowId: sourceRow.rowId, columnKey: sourceColumn.key, purpose: "source" })
        const target = api.cells.resolveValue({ rowId: targetRow.rowId, columnKey: targetColumn.key, purpose: "source" })
        if (source.status !== "available" || source.writeTarget?.kind !== "row-patch"
          || target.status !== "available" || target.writeTarget?.kind !== "row-patch") return false
        entries.push({
          sourceRowId: sourceRow.rowId,
          sourceKey: source.writeTarget.key,
          sourceValue: source.sourceValue,
          sourceColumn,
          sourceRow,
          targetRowId: targetRow.rowId,
          targetKey: target.writeTarget.key,
          targetValue: target.sourceValue,
          targetColumn,
          targetRow,
        })
      }
    }
    if (entries.length === 0) return false

    const patches = new Map<DataGridRowId, DataGridClientRowPatch<TRow>>()
    const ensurePatch = (rowId: DataGridRowId): DataGridClientRowPatch<TRow> => {
      let patch = patches.get(rowId)
      if (!patch) {
        patch = { rowId, data: {} as Partial<TRow>, previousData: {} as Partial<TRow> }
        patches.set(rowId, patch)
      }
      return patch
    }
    const rememberBefore = (rowId: DataGridRowId, key: string, value: unknown): void => {
      const previousData = ensurePatch(rowId).previousData as Record<string, unknown>
      if (!Object.prototype.hasOwnProperty.call(previousData, key)) previousData[key] = value
    }
    const setValue = (rowId: DataGridRowId, key: string, value: unknown): void => {
      ;(ensurePatch(rowId).data as Record<string, unknown>)[key] = value
    }

    for (const entry of entries) {
      rememberBefore(entry.sourceRowId, entry.sourceKey, entry.sourceValue)
      const cleared = validateClipboardValue("", entry.sourceValue, entry.sourceColumn.column, entry.sourceRow.data)
      if (!cleared.ok) return false
      setValue(entry.sourceRowId, entry.sourceKey, cleared.value)
    }
    for (const entry of entries) {
      rememberBefore(entry.targetRowId, entry.targetKey, entry.targetValue)
      const moved = validateClipboardValue(String(entry.sourceValue ?? ""), entry.targetValue, entry.targetColumn.column, entry.targetRow.data)
      if (!moved.ok) return false
      setValue(entry.targetRowId, entry.targetKey, moved.value)
    }

    const beforeSelection = api.selection.getSnapshot()
    const before = [...patches.values()].map(patch => createHistoryPatch(patch.rowId, patch.previousData ?? {}))
    const after = [...patches.values()].map(patch => createHistoryPatch(patch.rowId, patch.data))
    await options.runWithRenderBatch(async () => {
      await api.rows.applyEdits([...patches.values()], { source: "grid" })
      const startRowId = entries[0]?.targetRowId
      const endRowId = entries[entries.length - 1]?.targetRowId
      const findProjectedIndex = (rowId: DataGridRowId | undefined): number => {
        if (rowId == null) return -1
        for (let rowIndex = 0; rowIndex < api.rows.getCount(); rowIndex += 1) {
          if (api.rows.get(rowIndex)?.rowId === rowId) return rowIndex
        }
        return -1
      }
      const startRowIndex = findProjectedIndex(startRowId)
      const endRowIndex = findProjectedIndex(endRowId)
      const firstColumn = targetRange.startColumn
      const lastColumn = targetRange.endColumn
      const startRow = api.rows.get(startRowIndex)
      const endRow = api.rows.get(endRowIndex)
      if (startRowIndex >= 0 && endRowIndex >= 0 && startRow && endRow) {
        options.setCellSelection(
          { rowIndex: startRowIndex, colIndex: firstColumn, rowId: startRow.rowId },
          { rowIndex: endRowIndex, colIndex: lastColumn, rowId: endRow.rowId },
          "datagrid-dom-range-move",
        )
      }
    })
    await options.recordIntent({
      intent: "move",
      label: "Move cells",
      affectedRange: {
        startRow: targetRange.startRow,
        endRow: targetRange.endRow,
        startColumn: targetRange.startColumn,
        endColumn: targetRange.endColumn,
      },
      before: createHistorySnapshot(before, beforeSelection),
      after: createHistorySnapshot(after, api.selection.getSnapshot()),
    })
    grid.dataset.rangeMoveAction = `Moved ${entries.length} cells`
    return true
  }

  const autoScrollDelta = useDataGridAxisAutoScrollDelta({ edgePx: 28, maxStepPx: 22 })
  const autoScroll = useDataGridPointerAutoScroll({
    resolveInteractionState: () => ({ isDragSelecting: false, isFillDragging: false, isRangeMoving: rangeMoving }),
    resolveRangeMovePointer: () => pointer,
    resolveFillPointer: () => null,
    resolveDragPointer: () => null,
    resolveAllowHorizontalAutoScroll: () => true,
    resolveViewportElement: () => grid.querySelector<HTMLElement>(".affino-grid-dom__body"),
    resolveHeaderHeight: () => 0,
    resolveAxisAutoScrollDelta: autoScrollDelta.resolveAxisAutoScrollDelta,
    setScrollPosition: () => grid.querySelector<HTMLElement>(".affino-grid-dom__body")
      ?.dispatchEvent(new Event("scroll", { bubbles: true })),
    applyRangeMovePreviewFromPointer: updatePreviewFromPointer,
    applyFillPreviewFromPointer: () => undefined,
    applyDragSelectionFromPointer: () => undefined,
  })

  const lifecycle = useDataGridRangeMoveLifecycle({
    applyRangeMove,
    setRangeMoving: value => {
      rangeMoving = value
      if (value) grid.dataset.rangeMoving = "true"
      else delete grid.dataset.rangeMoving
    },
    clearRangeMovePointer: () => { pointer = null },
    clearRangeMoveBaseRange: () => { baseRange = null },
    clearRangeMoveOrigin: () => undefined,
    clearRangeMovePreviewRange: () => { previewRange = null; clearOverlays() },
    stopAutoScrollFrameIfIdle: autoScroll.stopAutoScrollFrameIfIdle,
    onApplyRangeMoveError: () => { grid.dataset.rangeMoveAction = "Move failed" },
  })

  const start = useDataGridRangeMoveStart<Coord, DataGridClipboardRange>({
    resolveSelectionRange,
    isCoordInsideRange: isInside,
    closeContextMenu: () => undefined,
    focusViewport: () => grid.focus({ preventScroll: true }),
    stopDragSelection: () => undefined,
    stopFillSelection: () => undefined,
    setRangeMoving: value => {
      rangeMoving = value
      if (value) grid.dataset.rangeMoving = "true"
      else delete grid.dataset.rangeMoving
    },
    setRangeMovePointer: value => { pointer = { ...value, target: null } },
    setRangeMoveBaseRange: range => { baseRange = { ...range } },
    setRangeMoveOrigin: () => undefined,
    setRangeMovePreviewRange: range => { previewRange = { ...range } },
    startInteractionAutoScroll: autoScroll.startInteractionAutoScroll,
    setLastAction: message => { grid.dataset.rangeMoveAction = message },
  })

  const previewRouter = useDataGridPointerPreviewRouter<Coord, DataGridClipboardRange>({
    isFillDragging: () => false,
    resolveFillPointer: () => null,
    resolveFillBaseRange: () => null,
    resolveFillPreviewRange: () => null,
    setFillPreviewRange: () => undefined,
    isRangeMoving: () => rangeMoving,
    resolveRangeMovePointer: () => pointer,
    resolveRangeMoveBaseRange: () => baseRange,
    resolveRangeMoveOrigin: () => pending?.origin ?? null,
    resolveRangeMovePreviewRange: () => previewRange,
    setRangeMovePreviewRange: range => {
      const normalized = normalizeTranslatedRange(range)
      if (!normalized || rangesEqual(previewRange, normalized)) return
      previewRange = normalized
      renderPreview()
    },
    resolveCellCoordFromPointer: resolveCoordFromPointer,
    buildExtendedRange: (range, coord) => {
      const origin = pending?.origin
      if (!origin) return null
      const rowDelta = coord.rowIndex - origin.rowIndex
      const columnDelta = coord.columnIndex - origin.columnIndex
      return {
        startRow: range.startRow + rowDelta,
        endRow: range.endRow + rowDelta,
        startColumn: range.startColumn + columnDelta,
        endColumn: range.endColumn + columnDelta,
      }
    },
    normalizeSelectionRange: normalizeTranslatedRange,
    rangesEqual,
  })

  function normalizeTranslatedRange(range: DataGridClipboardRange): DataGridClipboardRange | null {
    const rowCount = api.rows.getCount()
    const columnCount = visibleColumns().length
    if (range.startRow < 0 || range.endRow >= rowCount
      || range.startColumn < 0 || range.endColumn >= columnCount) return null
    return range
  }

  function updatePreviewFromPointer(): void {
    previewRouter.applyRangeMovePreviewFromPointer()
  }

  function refreshRenderedCells(): void {
    renderedCells.clear()
    for (const cell of Array.from(grid.querySelectorAll<HTMLElement>(".affino-grid-dom__cell[data-row-index][data-column-index]"))) {
      renderedCells.set(keyFor(Number(cell.dataset.rowIndex), Number(cell.dataset.columnIndex)), cell)
    }
  }

  function isRangeMoveCellAvailable(cell: HTMLElement, range: DataGridClipboardRange): boolean {
    const coord = resolveCoord(cell)
    if (!coord || !isInside(coord, range)) return false
    const columns = visibleColumns()
    if (!columns.slice(range.startColumn, range.endColumn + 1)
      .every(column => column.column.capabilities?.editable === true)) return false
    const column = columns[coord.columnIndex]
    if (!column) return false
    const resolved = api.cells.resolveValue({ rowId: coord.rowId, columnKey: column.key, purpose: "source" })
    return resolved.status === "available" && resolved.writeTarget?.kind === "row-patch"
  }

  function isRangeMoveEdgeHit(cell: HTMLElement, range: DataGridClipboardRange, clientX: number, clientY: number): boolean {
    const rowIndex = Number(cell.dataset.rowIndex)
    const columnIndex = Number(cell.dataset.columnIndex)
    const rect = cell.getBoundingClientRect()
    const nearLeft = columnIndex === range.startColumn && clientX - rect.left <= RANGE_MOVE_EDGE_ZONE_PX
    const nearRight = columnIndex === range.endColumn && rect.right - clientX <= RANGE_MOVE_EDGE_ZONE_PX
    const nearTop = rowIndex === range.startRow && clientY - rect.top <= RANGE_MOVE_EDGE_ZONE_PX
    const nearBottom = rowIndex === range.endRow && rect.bottom - clientY <= RANGE_MOVE_EDGE_ZONE_PX
    return nearLeft || nearRight || nearTop || nearBottom
  }

  function updateMoveCursor(pointer: { clientX: number; clientY: number; target: EventTarget | null } | null): void {
    hoveredPointer = pointer
    if (hoveredCell) {
      hoveredCell.classList.remove("affino-grid-dom__cell--range-move-edge")
      hoveredCell = null
    }
    if (!pointer || rangeMoving) return
    const cell = resolveCell(document.elementFromPoint?.(pointer.clientX, pointer.clientY) ?? pointer.target)
    const range = resolveSelectionRange()
    if (!cell || !range || !isRangeMoveCellAvailable(cell, range)
      || !isRangeMoveEdgeHit(cell, range, pointer.clientX, pointer.clientY)) return
    hoveredCell = cell
    hoveredCell.classList.add("affino-grid-dom__cell--range-move-edge")
  }

  function syncMoveCursor(): void {
    if (hoveredCell && !grid.contains(hoveredCell)) hoveredCell = null
    if (hoveredPointer) updateMoveCursor(hoveredPointer)
  }

  function sync(): void {
    refreshRenderedCells()
    syncMoveCursor()
    renderPreview()
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.pointerType === "touch") return
    if ((event.target as Element | null)?.closest?.(".affino-grid-dom__editor, [data-fill-handle], [data-fill-action]")) return
    const origin = resolveCoord(resolveCell(event.target))
    const range = resolveSelectionRange()
    const originCell = resolveCell(event.target)
    if (!origin || !range || !originCell || !isRangeMoveCellAvailable(originCell, range)
      || !isRangeMoveEdgeHit(originCell, range, event.clientX, event.clientY)) return
    pending = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin }
    pointer = { clientX: event.clientX, clientY: event.clientY, target: event.target }
    event.preventDefault()
    event.stopImmediatePropagation()
    grid.focus({ preventScroll: true })
    window?.addEventListener("pointermove", onPointerMove)
    window?.addEventListener("pointerup", onPointerUp)
    window?.addEventListener("pointercancel", onPointerCancel)
  }

  function onPointerMove(event: PointerEvent): void {
    if (!pending || event.pointerId !== pending.pointerId) return
    pointer = { clientX: event.clientX, clientY: event.clientY, target: event.target }
    const distance = Math.max(Math.abs(event.clientX - pending.startX), Math.abs(event.clientY - pending.startY))
    if (!rangeMoving && distance < MOVE_THRESHOLD_PX) return
    if (!rangeMoving && !start.startRangeMove(pending.origin, { clientX: pending.startX, clientY: pending.startY })) {
      clearPending()
      pointer = null
      return
    }
    rangeMoving = true
    if (hoveredCell) hoveredCell.classList.remove("affino-grid-dom__cell--range-move-edge")
    hoveredCell = null
    pointer = { clientX: event.clientX, clientY: event.clientY, target: event.target }
    updatePreviewFromPointer()
    autoScroll.startInteractionAutoScroll()
    event.preventDefault()
  }

  async function onPointerUp(event: PointerEvent): Promise<void> {
    if (!pending || event.pointerId !== pending.pointerId) return
    const didMove = rangeMoving && previewRange != null && baseRange != null && !rangesEqual(baseRange, previewRange)
    clearPending()
    if (didMove) suppressNextClick = true
    if (rangeMoving) await lifecycle.stopRangeMove(didMove)
    else pointer = null
    updateMoveCursor({ clientX: event.clientX, clientY: event.clientY, target: event.target })
    autoScroll.stopAutoScrollFrameIfIdle()
    renderPreview()
    if (lastClickOutcomeTimer != null && window) window.clearTimeout(lastClickOutcomeTimer)
    if (suppressNextClick && window) {
      lastClickOutcomeTimer = window.setTimeout(() => {
        suppressNextClick = false
        lastClickOutcomeTimer = null
      }, 0)
    }
  }

  function onPointerCancel(event: PointerEvent): void {
    if (!pending || event.pointerId !== pending.pointerId) return
    clearPending()
    if (rangeMoving) void lifecycle.stopRangeMove(false)
    else clearMoveState()
    updateMoveCursor({ clientX: event.clientX, clientY: event.clientY, target: event.target })
  }

  function onHoverPointerMove(event: PointerEvent): void {
    if (event.pointerType === "touch" || pending) return
    updateMoveCursor({ clientX: event.clientX, clientY: event.clientY, target: event.target })
  }

  function onPointerLeave(): void {
    if (!pending) updateMoveCursor(null)
  }

  function clearPending(): void {
    window?.removeEventListener("pointermove", onPointerMove)
    window?.removeEventListener("pointerup", onPointerUp)
    window?.removeEventListener("pointercancel", onPointerCancel)
    pending = null
  }

  grid.addEventListener("pointerdown", onPointerDown)
  grid.addEventListener("pointermove", onHoverPointerMove)
  grid.addEventListener("pointerleave", onPointerLeave)

  return {
    sync,
    consumeClick(): boolean {
      const outcome = suppressNextClick
      suppressNextClick = false
      if (lastClickOutcomeTimer != null && window) window.clearTimeout(lastClickOutcomeTimer)
      lastClickOutcomeTimer = null
      return outcome
    },
    dispose(): void {
      grid.removeEventListener("pointerdown", onPointerDown)
      grid.removeEventListener("pointermove", onHoverPointerMove)
      grid.removeEventListener("pointerleave", onPointerLeave)
      clearPending()
      if (rangeMoving) void lifecycle.stopRangeMove(false)
      clearOverlays()
      updateMoveCursor(null)
      delete grid.dataset.rangeMoving
      autoScroll.dispose()
      if (lastClickOutcomeTimer != null && window) window.clearTimeout(lastClickOutcomeTimer)
    },
  }
}

function rangesEqual(left: DataGridClipboardRange | null, right: DataGridClipboardRange | null): boolean {
  return left?.startRow === right?.startRow
    && left?.endRow === right?.endRow
    && left?.startColumn === right?.startColumn
    && left?.endColumn === right?.endColumn
}
