import type { DataGridApi } from "@affino/datagrid-core"
import { useDataGridAxisAutoScrollDelta, useDataGridPointerAutoScroll } from "@affino/datagrid-orchestration"
import type { DataGridDomCellCoord } from "./cellSelectionController.js"

const DRAG_THRESHOLD_PX = 5

export function createDomCellPointerSelectionController<TRow>(options: {
  grid: HTMLElement
  api: DataGridApi<TRow>
  resolveAllowHorizontalAutoScroll: () => boolean
  setCellSelection: (
    point: DataGridDomCellCoord,
    anchor: DataGridDomCellCoord,
    origin: string,
    mode?: "replace" | "extend" | "add",
  ) => void
}) {
  const window = options.grid.ownerDocument.defaultView
  let pending: {
    pointerId: number | null
    startX: number
    startY: number
    anchor: DataGridDomCellCoord
    lastPoint: DataGridDomCellCoord
    dragging: boolean
  } | null = null
  let nextClickOutcome: "selected" | "dragged" | null = null
  let clearClickSuppressionTimer: number | null = null
  let dragPointer: { clientX: number; clientY: number } | null = null
  let allowHorizontalAutoScroll = true

  const autoScrollDelta = useDataGridAxisAutoScrollDelta({ edgePx: 28, maxStepPx: 22 })
  const autoScroll = useDataGridPointerAutoScroll({
    resolveInteractionState: () => ({
      isDragSelecting: pending?.dragging === true,
      isFillDragging: false,
      isRangeMoving: false,
    }),
    resolveRangeMovePointer: () => null,
    resolveFillPointer: () => null,
    resolveDragPointer: () => dragPointer,
    resolveAllowHorizontalAutoScroll: () => allowHorizontalAutoScroll,
    resolveViewportElement: () => options.grid.querySelector<HTMLElement>(".affino-grid-dom__body"),
    resolveHeaderHeight: () => 0,
    resolveAxisAutoScrollDelta: autoScrollDelta.resolveAxisAutoScrollDelta,
    setScrollPosition: () => {
      options.grid.querySelector<HTMLElement>(".affino-grid-dom__body")
        ?.dispatchEvent(new Event("scroll", { bubbles: true }))
    },
    applyRangeMovePreviewFromPointer: () => undefined,
    applyFillPreviewFromPointer: () => undefined,
    applyDragSelectionFromPointer: applyPointerRange,
  })

  const resolveCell = (target: EventTarget | null): HTMLElement | null => {
    const element = target instanceof Element ? target : null
    const cell = element?.closest<HTMLElement>(".affino-grid-dom__cell[data-row-index][data-column-index]") ?? null
    return cell && options.grid.contains(cell) ? cell : null
  }

  const resolveCoord = (cell: HTMLElement): DataGridDomCellCoord | null => {
    const rowIndex = Number(cell.dataset.rowIndex)
    const colIndex = Number(cell.dataset.columnIndex)
    const row = options.api.rows.get(rowIndex)
    if (!row || !Number.isInteger(colIndex) || colIndex < 0) return null
    return { rowIndex, colIndex, rowId: row.rowId }
  }

  function applyPointerRange(): void {
    if (!pending?.dragging || !dragPointer) return
    const viewport = options.grid.querySelector<HTMLElement>(".affino-grid-dom__body")
    const rect = viewport?.getBoundingClientRect()
    const x = rect ? Math.max(rect.left, Math.min(rect.right - 1, dragPointer.clientX)) : dragPointer.clientX
    const y = rect ? Math.max(rect.top, Math.min(rect.bottom - 1, dragPointer.clientY)) : dragPointer.clientY
    const target = options.grid.ownerDocument.elementFromPoint?.(x, y)
    const cell = resolveCell(target)
    const point = cell ? resolveCoord(cell) : null
    if (!point || (point.rowIndex === pending.lastPoint.rowIndex && point.colIndex === pending.lastPoint.colIndex)) return
    pending.lastPoint = point
    options.setCellSelection(point, pending.anchor, "datagrid-dom-pointer-range", "extend")
  }

  const clearPending = (): void => {
    if (window) {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerCancel)
    }
    pending = null
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || event.altKey || event.pointerType === "touch") return
    if ((event.target as Element | null)?.closest?.(".affino-grid-dom__editor, [data-fill-handle], [data-fill-action]")) return
    const cell = resolveCell(event.target)
    const point = cell ? resolveCoord(cell) : null
    if (!cell || !point || !options.api.selection.hasSupport()) return

    const current = options.api.selection.getSnapshot()
    const activeRange = current?.ranges[current.activeRangeIndex ?? 0] ?? current?.ranges[0]
    const anchor = event.shiftKey ? activeRange?.anchor ?? point : point
    const mode = event.shiftKey ? "extend" : event.ctrlKey || event.metaKey ? "add" : "replace"
    options.setCellSelection(point, anchor, "datagrid-dom-pointer-selection", mode)
    options.grid.focus({ preventScroll: true })

    clearPending()
    pending = {
      pointerId: Number.isFinite(event.pointerId) ? event.pointerId : null,
      startX: event.clientX,
      startY: event.clientY,
      anchor,
      lastPoint: point,
      dragging: false,
    }
    dragPointer = { clientX: event.clientX, clientY: event.clientY }
    allowHorizontalAutoScroll = options.resolveAllowHorizontalAutoScroll()
    window?.addEventListener("pointermove", onPointerMove)
    window?.addEventListener("pointerup", onPointerUp)
    window?.addEventListener("pointercancel", onPointerCancel)
  }

  const onPointerMove = (event: PointerEvent): void => {
    const active = pending
    if (!active || (active.pointerId != null && event.pointerId !== active.pointerId)) return
    if (event.buttons === 0) {
      clearPending()
      dragPointer = null
      autoScroll.stopAutoScrollFrameIfIdle()
      return
    }
    dragPointer = { clientX: event.clientX, clientY: event.clientY }
    const target = options.grid.ownerDocument.elementFromPoint?.(event.clientX, event.clientY) ?? event.target
    const cell = resolveCell(target)
    const point = cell ? resolveCoord(cell) : null
    if (!point) return

    if (!active.dragging) {
      const distance = Math.max(Math.abs(event.clientX - active.startX), Math.abs(event.clientY - active.startY))
      if (distance < DRAG_THRESHOLD_PX) return
      active.dragging = true
      autoScroll.startInteractionAutoScroll()
    }
    if (point.rowIndex === active.lastPoint.rowIndex && point.colIndex === active.lastPoint.colIndex) return
    active.lastPoint = point
    options.setCellSelection(point, active.anchor, "datagrid-dom-pointer-range", "extend")
    event.preventDefault()
  }

  const onPointerUp = (event: PointerEvent): void => {
    if (pending?.pointerId != null && event.pointerId !== pending.pointerId) return
    nextClickOutcome = pending?.dragging ? "dragged" : "selected"
    clearPending()
    dragPointer = null
    autoScroll.stopAutoScrollFrameIfIdle()
    if (clearClickSuppressionTimer != null && window) window.clearTimeout(clearClickSuppressionTimer)
    clearClickSuppressionTimer = window?.setTimeout(() => {
      nextClickOutcome = null
      clearClickSuppressionTimer = null
    }, 0) ?? null
  }

  const onPointerCancel = (): void => {
    clearPending()
    dragPointer = null
    autoScroll.stopAutoScrollFrameIfIdle()
  }

  options.grid.addEventListener("pointerdown", onPointerDown)

  return {
    consumeClick(): "none" | "selected" | "dragged" {
      const outcome = pending
        ? pending.dragging ? "dragged" : "selected"
        : nextClickOutcome ?? "none"
      if (pending) clearPending()
      nextClickOutcome = null
      if (clearClickSuppressionTimer != null && window) window.clearTimeout(clearClickSuppressionTimer)
      clearClickSuppressionTimer = null
      return outcome
    },
    dispose(): void {
      options.grid.removeEventListener("pointerdown", onPointerDown)
      clearPending()
      dragPointer = null
      autoScroll.dispose()
      if (clearClickSuppressionTimer != null && window) window.clearTimeout(clearClickSuppressionTimer)
      clearClickSuppressionTimer = null
      nextClickOutcome = null
    },
  }
}
