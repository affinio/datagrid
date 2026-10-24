import type { DataGridApi } from "@affino/datagrid-core"
import {
  useDataGridAxisAutoScrollDelta,
  useDataGridPointerAutoScroll,
  type DataGridClipboardRange,
  type DataGridFillBehavior,
} from "@affino/datagrid-orchestration"
import type { DomClipboardController } from "./clipboardController.js"
import { renderDomRangeOverlay } from "./rangeOverlay.js"

export interface DomFillHandleController {
  sync(): void
  dispose(): void
}

export function createDomFillHandleController<TRow>(options: {
  grid: HTMLElement
  api: DataGridApi<TRow>
  clipboard: DomClipboardController
  enabled: boolean
}): DomFillHandleController {
  const { grid, api, clipboard } = options
  const document = grid.ownerDocument
  const renderedCells = new Map<string, HTMLElement>()
  const previewOverlays: HTMLElement[] = []
  let baseRange: DataGridClipboardRange | null = null
  let previewRange: DataGridClipboardRange | null = null
  let pointerId: number | null = null
  let fillPointer: { clientX: number; clientY: number; target: EventTarget | null } | null = null
  let dragStartPointer: { clientX: number; clientY: number } | null = null
  let lastAppliedFill: {
    baseRange: DataGridClipboardRange
    previewRange: DataGridClipboardRange
    behavior: DataGridFillBehavior
    canToggle: boolean
    transactionId: string
  } | null = null
  let fillOptionsOpen = false

  const autoScrollDelta = useDataGridAxisAutoScrollDelta({ edgePx: 28, maxStepPx: 22 })
  const autoScroll = useDataGridPointerAutoScroll({
    resolveInteractionState: () => ({ isDragSelecting: false, isFillDragging: pointerId != null, isRangeMoving: false }),
    resolveRangeMovePointer: () => null,
    resolveFillPointer: () => fillPointer,
    resolveDragPointer: () => null,
    resolveAllowHorizontalAutoScroll: () => true,
    resolveViewportElement: () => grid.querySelector<HTMLElement>(".affino-grid-dom__body"),
    resolveHeaderHeight: () => 0,
    resolveAxisAutoScrollDelta: autoScrollDelta.resolveAxisAutoScrollDelta,
    setScrollPosition: () => {
      grid.querySelector<HTMLElement>(".affino-grid-dom__body")?.dispatchEvent(new Event("scroll", { bubbles: true }))
    },
    applyRangeMovePreviewFromPointer: () => undefined,
    applyFillPreviewFromPointer: updatePreviewFromPointer,
    applyDragSelectionFromPointer: () => undefined,
  })

  const keyFor = (rowIndex: number, columnIndex: number): string => `${rowIndex}:${columnIndex}`

  function normalizeRange(range: DataGridClipboardRange): DataGridClipboardRange | null {
    const rowCount = api.rows.getCount()
    const columnCount = api.columns.getSnapshot().visibleColumns.length
    if (rowCount <= 0 || columnCount <= 0) return null
    const startRow = Math.max(0, Math.min(rowCount - 1, Math.trunc(Math.min(range.startRow, range.endRow))))
    const endRow = Math.max(0, Math.min(rowCount - 1, Math.trunc(Math.max(range.startRow, range.endRow))))
    const startColumn = Math.max(0, Math.min(columnCount - 1, Math.trunc(Math.min(range.startColumn, range.endColumn))))
    const endColumn = Math.max(0, Math.min(columnCount - 1, Math.trunc(Math.max(range.startColumn, range.endColumn))))
    return { startRow, endRow, startColumn, endColumn }
  }

  function resolveSelectionRange(): DataGridClipboardRange | null {
    if (api.selection.getSnapshotStatus() !== "current") return null
    const selection = api.selection.getSnapshot()
    const range = selection?.ranges[selection.activeRangeIndex]
    if (range) {
      return normalizeRange({
        startRow: range.startRow,
        endRow: range.endRow,
        startColumn: range.startCol,
        endColumn: range.endCol,
      })
    }
    const activeCell = selection?.activeCell
    return activeCell
      ? normalizeRange({
        startRow: activeCell.rowIndex,
        endRow: activeCell.rowIndex,
        startColumn: activeCell.colIndex,
        endColumn: activeCell.colIndex,
      })
      : null
  }

  function clearPreview(): void {
    for (const overlay of previewOverlays) overlay.remove()
    previewOverlays.length = 0
  }

  function applyPreview(): void {
    if (!baseRange || !previewRange) {
      clearPreview()
      return
    }
    clearPreview()
    previewOverlays.push(...renderDomRangeOverlay({
      grid,
      cells: renderedCells,
      columnPins: api.columns.getSnapshot().visibleColumns.map(column => column.pin),
      range: previewRange,
      className: "affino-grid-dom__fill-preview-overlay",
      dataAttribute: "fillPreviewOverlay",
    }))
  }

  function sync(): void {
    renderedCells.clear()
    for (const cell of Array.from(grid.querySelectorAll<HTMLElement>(".affino-grid-dom__cell[data-row-index][data-column-index]"))) {
      cell.classList.remove("affino-grid-dom__cell--fill-handle-host")
      renderedCells.set(keyFor(Number(cell.dataset.rowIndex), Number(cell.dataset.columnIndex)), cell)
    }
    for (const handle of Array.from(grid.querySelectorAll(".affino-grid-dom__fill-handle"))) handle.remove()
    for (const menu of Array.from(grid.querySelectorAll(".affino-grid-dom__fill-action"))) menu.remove()
    applyPreview()
    if (!options.enabled || baseRange || grid.querySelector(".affino-grid-dom__editor")) return

    const range = resolveSelectionRange()
    if (!range) return
    const latestTransactionId = api.transaction.getSnapshot()?.lastCommittedId
    if (lastAppliedFill && (
      !rangesEqual(range, lastAppliedFill.previewRange)
      || latestTransactionId !== lastAppliedFill.transactionId
    )) {
      lastAppliedFill = null
      fillOptionsOpen = false
    }
    const row = api.rows.get(range.endRow)
    const column = api.columns.getSnapshot().visibleColumns[range.endColumn]
    const cell = renderedCells.get(keyFor(range.endRow, range.endColumn))
    if (!row || row.kind !== "leaf" || !column || column.column.capabilities?.editable !== true || !cell) return

    const handle = document.createElement("button")
    handle.type = "button"
    handle.className = "affino-grid-dom__fill-handle"
    handle.dataset.fillHandle = ""
    handle.setAttribute("aria-label", "Fill selected range")
    handle.tabIndex = -1
    cell.classList.add("affino-grid-dom__cell--fill-handle-host")
    cell.append(handle)
    if (lastAppliedFill?.canToggle && api.transaction.canUndo()) {
      renderFillOptions(range, lastAppliedFill)
    }
  }

  function renderFillOptions(
    range: DataGridClipboardRange,
    session: NonNullable<typeof lastAppliedFill>,
  ): void {
    const body = grid.querySelector<HTMLElement>(".affino-grid-dom__body")
    const cell = renderedCells.get(keyFor(range.endRow, range.endColumn))
    if (!body || !cell) return
    const bodyRect = body.getBoundingClientRect()
    const cellRect = cell.getBoundingClientRect()
    const root = document.createElement("div")
    root.className = "affino-grid-dom__fill-action"
    root.style.left = `${Math.min(body.clientWidth - 16, cellRect.right - bodyRect.left + body.scrollLeft - 14)}px`
    root.style.top = `${Math.max(body.scrollTop, cellRect.bottom - bodyRect.top + body.scrollTop - 14)}px`

    const trigger = document.createElement("button")
    trigger.type = "button"
    trigger.className = "affino-grid-dom__fill-action-trigger"
    trigger.dataset.fillAction = ""
    trigger.setAttribute("aria-label", "Fill options")
    trigger.setAttribute("aria-haspopup", "menu")
    trigger.setAttribute("aria-expanded", String(fillOptionsOpen))
    trigger.textContent = "⌄"
    trigger.addEventListener("pointerdown", event => event.stopPropagation())
    trigger.addEventListener("click", event => {
      event.preventDefault()
      event.stopPropagation()
      fillOptionsOpen = !fillOptionsOpen
      sync()
      grid.focus({ preventScroll: true })
    })
    root.append(trigger)

    if (fillOptionsOpen) {
      const menu = document.createElement("div")
      menu.className = "affino-grid-dom__fill-action-menu"
      menu.setAttribute("role", "menu")
      for (const behavior of ["series", "copy"] as const) {
        const item = document.createElement("button")
        item.type = "button"
        item.className = "affino-grid-dom__fill-action-item"
        item.setAttribute("role", "menuitemradio")
        item.setAttribute("aria-checked", String(session.behavior === behavior))
        item.textContent = behavior === "series" ? "Series / Increment" : "Copy"
        item.addEventListener("pointerdown", event => event.stopPropagation())
        item.addEventListener("click", event => {
          event.preventDefault()
          event.stopPropagation()
          void applyFillBehavior(session, behavior)
        })
        menu.append(item)
      }
      root.append(menu)
    }
    body.append(root)
  }

  async function applyFillBehavior(
    session: NonNullable<typeof lastAppliedFill>,
    behavior: DataGridFillBehavior,
  ): Promise<void> {
    if (session.behavior === behavior) {
      fillOptionsOpen = false
      sync()
      return
    }
    if (api.transaction.getSnapshot()?.lastCommittedId !== session.transactionId) {
      lastAppliedFill = null
      fillOptionsOpen = false
      sync()
      return
    }
    const undoneTransactionId = await api.transaction.undo()
    if (undoneTransactionId !== session.transactionId) return
    lastAppliedFill = null
    fillOptionsOpen = false
    const result = await clipboard.fillRange(session.baseRange, session.previewRange, behavior)
    if (result.applied && result.transactionId) {
      lastAppliedFill = {
        baseRange: session.baseRange,
        previewRange: session.previewRange,
        behavior: result.behavior,
        canToggle: result.canToggle,
        transactionId: result.transactionId,
      }
    }
    sync()
  }

  function resolveTargetCell(clientX: number, clientY: number, fallback: EventTarget | null = null): HTMLElement | null {
    const fallbackElement = fallback as Element | null
    const fallbackCell = fallbackElement?.closest?.<HTMLElement>(".affino-grid-dom__cell[data-row-index][data-column-index]") ?? null
    const elementAtPoint = typeof document.elementFromPoint === "function"
      ? document.elementFromPoint(clientX, clientY)
      : null
    // Pointer capture can keep event.target on the fill handle while the
    // pointer moves across the grid. Resolve the actual cell under the pointer
    // first; use the event target only in environments without hit testing.
    let target: Element | null = elementAtPoint ?? fallbackCell ?? fallbackElement
    if (!target?.closest?.(".affino-grid-dom__cell[data-row-index][data-column-index]")) {
      const body = grid.querySelector<HTMLElement>(".affino-grid-dom__body")
      const rect = body?.getBoundingClientRect()
      if (rect && typeof document.elementFromPoint === "function") {
        const x = Math.max(rect.left + 1, Math.min(rect.right - 1, clientX))
        const y = Math.max(rect.top + 1, Math.min(rect.bottom - 1, clientY))
        target = document.elementFromPoint(x, y)
      }
    }
    const cell = target?.closest?.<HTMLElement>(".affino-grid-dom__cell[data-row-index][data-column-index]") ?? null
    return cell && grid.contains(cell) ? cell : null
  }

  function updatePreviewFromPointer(): void {
    if (!baseRange || !fillPointer) return
    const cell = resolveTargetCell(fillPointer.clientX, fillPointer.clientY, fillPointer.target)
    if (!cell) return
    const rowIndex = Number(cell.dataset.rowIndex)
    const columnIndex = Number(cell.dataset.columnIndex)
    const row = api.rows.get(rowIndex)
    if (!row || row.kind !== "leaf") return
    const nextPreviewRange = buildAxisPreviewRange(baseRange, rowIndex, columnIndex)
    if (previewRange && rangesEqual(previewRange, nextPreviewRange)) return
    previewRange = nextPreviewRange
    applyPreview()
  }

  function onPointerDown(event: PointerEvent): void {
    const target = event.target as Element | null
    if (fillOptionsOpen && !target?.closest?.(".affino-grid-dom__fill-action")) {
      fillOptionsOpen = false
      sync()
    }
    if (!options.enabled || !target?.closest?.("[data-fill-handle]") || event.isPrimary === false) return
    const range = resolveSelectionRange()
    if (!range) return
    event.preventDefault()
    event.stopPropagation()
    baseRange = range
    previewRange = range
    pointerId = event.pointerId
    fillPointer = { clientX: event.clientX, clientY: event.clientY, target: event.target }
    dragStartPointer = { clientX: event.clientX, clientY: event.clientY }
    lastAppliedFill = null
    fillOptionsOpen = false
    grid.focus({ preventScroll: true })
    applyPreview()
    autoScroll.startInteractionAutoScroll()
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerId == null || event.pointerId !== pointerId || !baseRange) return
    fillPointer = { clientX: event.clientX, clientY: event.clientY, target: event.target }
    updatePreviewFromPointer()
    autoScroll.startInteractionAutoScroll()
    event.preventDefault()
  }

  async function onPointerUp(event: PointerEvent): Promise<void> {
    if (pointerId == null || event.pointerId !== pointerId) return
    const base = baseRange
    const preview = previewRange
    pointerId = null
    baseRange = null
    previewRange = null
    fillPointer = null
    dragStartPointer = null
    autoScroll.stopAutoScrollFrameIfIdle()
    clearPreview()
    if (base && preview) {
      try {
        const result = await clipboard.fillRange(base, preview)
        if (result.applied && result.transactionId) {
          lastAppliedFill = {
            baseRange: base,
            previewRange: preview,
            behavior: result.behavior,
            canToggle: result.canToggle,
            transactionId: result.transactionId,
          }
        }
      } catch {
        grid.dataset.clipboardAction = "Fill failed"
      }
    }
    sync()
  }

  function onPointerCancel(event: PointerEvent): void {
    if (pointerId == null || event.pointerId !== pointerId) return
    pointerId = null
    baseRange = null
    previewRange = null
    fillPointer = null
    dragStartPointer = null
    autoScroll.stopAutoScrollFrameIfIdle()
    clearPreview()
    sync()
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!fillOptionsOpen || event.key !== "Escape") return
    event.preventDefault()
    event.stopPropagation()
    fillOptionsOpen = false
    sync()
  }

  grid.addEventListener("pointerdown", onPointerDown)
  grid.addEventListener("keydown", onKeyDown)
  document.addEventListener("pointermove", onPointerMove)
  document.addEventListener("pointerup", onPointerUp)
  document.addEventListener("pointercancel", onPointerCancel)

  return {
    sync,
    dispose() {
      grid.removeEventListener("pointerdown", onPointerDown)
      grid.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointermove", onPointerMove)
      document.removeEventListener("pointerup", onPointerUp)
      document.removeEventListener("pointercancel", onPointerCancel)
      autoScroll.dispose()
      clearPreview()
      for (const handle of Array.from(grid.querySelectorAll(".affino-grid-dom__fill-handle"))) handle.remove()
      for (const menu of Array.from(grid.querySelectorAll(".affino-grid-dom__fill-action"))) menu.remove()
      for (const cell of renderedCells.values()) cell.classList.remove("affino-grid-dom__cell--fill-handle-host")
      renderedCells.clear()
    },
  }

  function buildAxisPreviewRange(
    base: DataGridClipboardRange,
    rowIndex: number,
    columnIndex: number,
  ): DataGridClipboardRange {
    const rowOutside = rowIndex < base.startRow || rowIndex > base.endRow
    const columnOutside = columnIndex < base.startColumn || columnIndex > base.endColumn
    let axis: "vertical" | "horizontal"
    if (rowOutside && !columnOutside) {
      axis = "vertical"
    } else if (columnOutside && !rowOutside) {
      axis = "horizontal"
    } else {
      const deltaX = Math.abs((fillPointer?.clientX ?? 0) - (dragStartPointer?.clientX ?? 0))
      const deltaY = Math.abs((fillPointer?.clientY ?? 0) - (dragStartPointer?.clientY ?? 0))
      axis = deltaX > deltaY + 10 ? "horizontal" : "vertical"
    }
    if (axis === "vertical") {
      return {
        startRow: Math.min(base.startRow, rowIndex),
        endRow: Math.max(base.endRow, rowIndex),
        startColumn: base.startColumn,
        endColumn: base.endColumn,
      }
    }
    return {
      startRow: base.startRow,
      endRow: base.endRow,
      startColumn: Math.min(base.startColumn, columnIndex),
      endColumn: Math.max(base.endColumn, columnIndex),
    }
  }
}

function rangesEqual(left: DataGridClipboardRange, right: DataGridClipboardRange): boolean {
  return left.startRow === right.startRow
    && left.endRow === right.endRow
    && left.startColumn === right.startColumn
    && left.endColumn === right.endColumn
}
