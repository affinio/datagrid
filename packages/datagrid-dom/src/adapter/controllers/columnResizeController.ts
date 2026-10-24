import { useDataGridHeaderResizeOrchestration } from "@affino/datagrid-orchestration"
import type { DataGridApi, DataGridColumnSnapshot } from "@affino/datagrid-core"

interface ColumnResizeControllerOptions<TRow> {
  grid: HTMLElement
  api: DataGridApi<TRow>
  getColumns: () => readonly DataGridColumnSnapshot[]
  setWidth: (key: string, width: number) => void
}

export function createDomColumnResizeController<TRow>(options: ColumnResizeControllerOptions<TRow>) {
  const document = options.grid.ownerDocument
  const window = document.defaultView
  const resize = useDataGridHeaderResizeOrchestration<TRow>({
    resolveColumnBaseWidth: key => options.getColumns().find(column => column.key === key)?.width ?? 160,
    resolveColumnLabel: key => options.getColumns().find(column => column.key === key)?.column.label ?? key,
    resolveRowsForAutoSize: () => options.api.rows.getProjectedRows(),
    resolveCellText: (row, key) => {
      const column = options.getColumns().find(candidate => candidate.key === key)?.column
      const value = column?.valueGetter?.(row) ?? column?.accessor?.(row)
        ?? (column?.field ? (row as Record<string, unknown>)[column.field] : "")
      return value == null ? "" : String(value)
    },
    resolveColumnWidthOverride: key => options.getColumns().find(column => column.key === key)?.width,
    resolveColumnMinWidth: key => options.getColumns().find(column => column.key === key)?.column.minWidth ?? 56,
    applyColumnWidth: options.setWidth,
    isColumnResizable: key => options.getColumns().some(column => column.key === key && column.column.meta?.isSystem !== true),
    isFillDragging: () => false,
    stopFillSelection: () => undefined,
    isDragSelecting: () => false,
    stopDragSelection: () => undefined,
    setLastAction: () => undefined,
    autoSizeSampleLimit: 400,
    autoSizeCharWidth: 7.2,
    autoSizeHorizontalPadding: 42,
    autoSizeMaxWidth: 640,
    resizeApplyMode: "raf",
    requestAnimationFrame: window?.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window?.cancelAnimationFrame.bind(window),
  })
  const unsubscribeResize = resize.subscribe(state => {
    options.grid.classList.toggle("affino-grid-dom--column-resizing", state !== null)
  })

  const onPointerDown = (event: PointerEvent): void => {
    const target = event.target as Element | null
    const handle = target?.closest<HTMLElement>("[data-column-resize-handle]")
    const key = handle?.dataset.columnResizeHandle
    if (!key) return
    const modelWidth = options.getColumns().find(column => column.key === key)?.width
    const startWidth = resolveRenderedColumnWidth(handle) ?? modelWidth ?? 160
    handle.dataset.datagridResizeColumnWidth = String(startWidth)
    const resizeEvent = {
      button: event.button,
      clientX: event.clientX,
      currentTarget: handle,
      preventDefault: () => event.preventDefault(),
      stopPropagation: () => event.stopPropagation(),
    } as unknown as MouseEvent
    resize.onHeaderResizeHandleMouseDown(key, resizeEvent)
  }
  const onDoubleClick = (event: MouseEvent): void => {
    const target = event.target as Element | null
    const handle = target?.closest<HTMLElement>("[data-column-resize-handle]")
    const key = handle?.dataset.columnResizeHandle
    if (!key) return
    const resizeEvent = {
      currentTarget: handle,
      preventDefault: () => event.preventDefault(),
      stopPropagation: () => event.stopPropagation(),
    } as unknown as MouseEvent
    resize.onHeaderResizeHandleDoubleClick(key, resizeEvent)
  }
  const onPointerMove = (event: PointerEvent): void => resize.applyColumnResizeFromPointer(event.clientX)
  const onPointerUp = (): void => resize.stopColumnResize()
  const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as Element | null
    const handle = target?.closest<HTMLElement>("[data-column-resize-handle]")
    const key = handle?.dataset.columnResizeHandle
    if (!key || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return
    event.preventDefault()
    const modelWidth = options.getColumns().find(column => column.key === key)?.width
    const current = resolveRenderedColumnWidth(handle) ?? modelWidth ?? 160
    resize.setColumnWidth(key, current + (event.key === "ArrowRight" ? 10 : -10))
    const width = options.getColumns().find(column => column.key === key)?.width ?? current
    const nextHandle = Array.from(options.grid.querySelectorAll<HTMLElement>("[data-column-resize-handle]"))
      .find(candidate => candidate.dataset.columnResizeHandle === key)
    if (nextHandle) {
      nextHandle.dataset.datagridResizeColumnWidth = String(width)
      nextHandle.setAttribute("aria-valuenow", String(width))
      nextHandle.focus({ preventScroll: true })
    }
  }

  function resolveRenderedColumnWidth(handle: HTMLElement): number | null {
    const cell = handle.closest<HTMLElement>(".affino-grid-dom__cell")
    const width = cell?.getBoundingClientRect().width
    return width != null && Number.isFinite(width) && width > 0 ? width : null
  }

  options.grid.addEventListener("pointerdown", onPointerDown)
  options.grid.addEventListener("dblclick", onDoubleClick)
  options.grid.addEventListener("keydown", onKeyDown)
  document.addEventListener("pointermove", onPointerMove)
  document.addEventListener("pointerup", onPointerUp)

  return {
    dispose(): void {
      options.grid.removeEventListener("pointerdown", onPointerDown)
      options.grid.removeEventListener("dblclick", onDoubleClick)
      options.grid.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointermove", onPointerMove)
      document.removeEventListener("pointerup", onPointerUp)
      unsubscribeResize()
      options.grid.classList.remove("affino-grid-dom--column-resizing")
      resize.dispose()
    },
  }
}
