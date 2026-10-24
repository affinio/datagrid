import type { DataGridApi, DataGridColumnSnapshot, DataGridColumnZone } from "@affino/datagrid-core"
import type { DataGridSelectionSnapshot } from "@affino/datagrid-core"

interface ColumnReorderControllerOptions<TRow> {
  grid: HTMLElement
  api: DataGridApi<TRow>
}

interface CapturedSelectionPoint {
  readonly rowIndex: number
  readonly rowId: unknown
  readonly columnKey: string
}

interface CapturedSelection {
  readonly ranges: readonly {
    readonly startRow: number
    readonly endRow: number
    readonly startColumnKey: string
    readonly endColumnKey: string
    readonly startRowId: unknown
    readonly endRowId: unknown
    readonly anchor: CapturedSelectionPoint
    readonly focus: CapturedSelectionPoint
    readonly virtual?: DataGridSelectionSnapshot["ranges"][number]["virtual"]
  }[]
  readonly activeRangeIndex: number
  readonly activeCell: CapturedSelectionPoint | null
}

function resolveZone(column: DataGridColumnSnapshot): DataGridColumnZone {
  return column.pin === "left" ? "pinnedLeft" : column.pin === "right" ? "pinnedRight" : "center"
}

function resolvePlacement(target: HTMLElement, clientX: number): "before" | "after" {
  const bounds = target.getBoundingClientRect()
  return clientX < bounds.left + bounds.width / 2 ? "before" : "after"
}

export function createDomColumnReorderController<TRow>(options: ColumnReorderControllerOptions<TRow>) {
  let sourceColumnKey: string | null = null
  let dropTarget: HTMLElement | null = null
  let dropPlacement: "before" | "after" = "before"

  const resolveHeader = (target: EventTarget | null): HTMLElement | null => {
    const element = target instanceof Element ? target : null
    const header = element?.closest<HTMLElement>(".affino-grid-dom__column-header[data-column-key]") ?? null
    return header && options.grid.contains(header) ? header : null
  }

  const clearDropTarget = (): void => {
    dropTarget?.classList.remove("affino-grid-dom__column-drop-before", "affino-grid-dom__column-drop-after")
    dropTarget = null
  }

  const clearDragState = (): void => {
    clearDropTarget()
    options.grid.querySelector(".affino-grid-dom__column-drag-source")
      ?.classList.remove("affino-grid-dom__column-drag-source")
    sourceColumnKey = null
    options.grid.classList.remove("affino-grid-dom--column-reordering")
  }

  const captureSelection = (columns: readonly DataGridColumnSnapshot[]): CapturedSelection | null => {
    if (options.api.selection.getSnapshotStatus() !== "current") return null
    const snapshot = options.api.selection.getSnapshot()
    if (!snapshot) return null
    const keys = columns.map(column => column.key)
    const resolvePoint = (point: { rowIndex: number; colIndex: number; rowId?: unknown }): CapturedSelectionPoint | null => {
      const columnKey = keys[point.colIndex]
      return columnKey == null ? null : { rowIndex: point.rowIndex, rowId: point.rowId ?? null, columnKey }
    }
    const ranges = snapshot.ranges.flatMap(range => {
      const startColumnKey = keys[range.startCol]
      const endColumnKey = keys[range.endCol]
      const anchor = resolvePoint(range.anchor)
      const focus = resolvePoint(range.focus)
      if (!startColumnKey || !endColumnKey || !anchor || !focus) return []
      return [{
        startRow: range.startRow,
        endRow: range.endRow,
        startColumnKey,
        endColumnKey,
        startRowId: range.startRowId,
        endRowId: range.endRowId,
        anchor,
        focus,
        ...(range.virtual ? { virtual: range.virtual } : {}),
      }]
    })
    if (ranges.length === 0) return null
    return {
      ranges,
      activeRangeIndex: Math.min(snapshot.activeRangeIndex, ranges.length - 1),
      activeCell: snapshot.activeCell ? resolvePoint(snapshot.activeCell) : null,
    }
  }

  const restoreSelection = (captured: CapturedSelection | null, columns: readonly DataGridColumnSnapshot[]): void => {
    if (!captured) return
    const keys = columns.map(column => column.key)
    const ranges = captured.ranges.flatMap(range => {
      const startCol = keys.indexOf(range.startColumnKey)
      const endCol = keys.indexOf(range.endColumnKey)
      const anchorCol = keys.indexOf(range.anchor.columnKey)
      const focusCol = keys.indexOf(range.focus.columnKey)
      if (startCol < 0 || endCol < 0 || anchorCol < 0 || focusCol < 0) return []
      return [{
        startRow: range.startRow,
        endRow: range.endRow,
        startCol,
        endCol,
        startRowId: range.startRowId,
        endRowId: range.endRowId,
        anchor: { rowIndex: range.anchor.rowIndex, colIndex: anchorCol, rowId: range.anchor.rowId },
        focus: { rowIndex: range.focus.rowIndex, colIndex: focusCol, rowId: range.focus.rowId },
        ...(range.virtual ? { virtual: range.virtual } : {}),
      }]
    })
    if (ranges.length === 0) return
    const activeRangeIndex = Math.min(captured.activeRangeIndex, ranges.length - 1)
    const activeRange = ranges[activeRangeIndex]!
    const activeCellCol = captured.activeCell ? keys.indexOf(captured.activeCell.columnKey) : -1
    options.api.selection.setSnapshot({
      ranges,
      activeRangeIndex,
      activeCell: captured.activeCell && activeCellCol >= 0
        ? { rowIndex: captured.activeCell.rowIndex, colIndex: activeCellCol, rowId: captured.activeCell.rowId }
        : { ...activeRange.focus },
    }, { origin: "datagrid-dom-column-reorder" })
  }

  const reorder = (sourceKey: string, targetKey: string, placement: "before" | "after"): void => {
    if (sourceKey === targetKey) return
    const before = options.api.columns.getSnapshot()
    const source = before.byKey[sourceKey]
    const target = before.byKey[targetKey]
    if (!source || !target || !source.visible || !target.visible) return
    const capturedSelection = captureSelection(before.visibleColumns)
    const targetZone = resolveZone(target)
    if (resolveZone(source) !== targetZone) options.api.columns.setPin(sourceKey, target.pin)
    const currentZoneOrder = options.api.columns.getSnapshot().zoneOrder[targetZone]
    const reordered = currentZoneOrder.filter(key => key !== sourceKey)
    const targetIndex = reordered.indexOf(targetKey)
    if (targetIndex < 0) return
    reordered.splice(targetIndex + (placement === "after" ? 1 : 0), 0, sourceKey)
    options.api.columns.setZoneOrder(targetZone, reordered)
    restoreSelection(capturedSelection, options.api.columns.getSnapshot().visibleColumns)
  }

  const onDragStart = (event: DragEvent): void => {
    const header = resolveHeader(event.target)
    const key = header?.dataset.columnKey
    if (!header || !key || (event.target as Element | null)?.closest?.("[data-column-resize-handle]")) {
      event.preventDefault()
      return
    }
    sourceColumnKey = key
    options.grid.classList.add("affino-grid-dom--column-reordering")
    header.classList.add("affino-grid-dom__column-drag-source")
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move"
      event.dataTransfer.setData("text/plain", key)
    }
  }

  const onDragOver = (event: DragEvent): void => {
    if (!sourceColumnKey) return
    const target = resolveHeader(event.target)
    const targetKey = target?.dataset.columnKey
    if (!target || !targetKey || sourceColumnKey === targetKey) return
    event.preventDefault()
    clearDropTarget()
    dropTarget = target
    dropPlacement = resolvePlacement(target, event.clientX)
    target.classList.add(dropPlacement === "before" ? "affino-grid-dom__column-drop-before" : "affino-grid-dom__column-drop-after")
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move"
  }

  const onDrop = (event: DragEvent): void => {
    if (!sourceColumnKey) return
    const target = resolveHeader(event.target)
    const targetKey = target?.dataset.columnKey
    if (!target || !targetKey) return
    event.preventDefault()
    const placement = resolvePlacement(target, event.clientX)
    reorder(sourceColumnKey, targetKey, placement)
    clearDragState()
  }

  const onDragEnd = (): void => {
    options.grid.querySelector(".affino-grid-dom__column-drag-source")
      ?.classList.remove("affino-grid-dom__column-drag-source")
    clearDragState()
  }

  options.grid.addEventListener("dragstart", onDragStart)
  options.grid.addEventListener("dragover", onDragOver)
  options.grid.addEventListener("drop", onDrop)
  options.grid.addEventListener("dragend", onDragEnd)

  return {
    dispose(): void {
      options.grid.removeEventListener("dragstart", onDragStart)
      options.grid.removeEventListener("dragover", onDragOver)
      options.grid.removeEventListener("drop", onDrop)
      options.grid.removeEventListener("dragend", onDragEnd)
      onDragEnd()
    },
  }
}
