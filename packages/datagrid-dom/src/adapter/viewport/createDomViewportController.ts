import type { DataGridCoreViewportService } from "@affino/datagrid-core"
import {
  createDataGridViewportController,
  createDataGridViewportCoreService,
  DEFAULT_TABLE_VIRTUALIZATION_CONSTANTS,
  type DataGridImperativeColumnUpdatePayload,
  type DataGridViewportController,
} from "@affino/datagrid-core/advanced"
import type { DataGridRuntime } from "@affino/datagrid-orchestration"
import type { DataGridDomOptions } from "../contracts.js"
import { DOM_ROW_SELECTION_COLUMN_WIDTH } from "../rowSelectionConstants.js"
import { revealMountedDomCell } from "./revealDomCell.js"

export interface DomViewportRenderState {
  virtualRows?: {
    startIndex: number
    endIndex: number
    totalRowCount: number
    rowHeight: number
  }
  virtualColumns?: {
    columns: readonly { index: number; width: number; pin: "left" | "right" | "none"; offset: number }[]
    leftPadding: number
    rightPadding: number
  }
}

export function createDomViewportController<TRow>(options: {
  runtime: DataGridRuntime<TRow>
  service: DataGridCoreViewportService | null
  grid: HTMLDivElement
  rowVirtualization: Exclude<DataGridDomOptions<TRow>["rowVirtualization"], false | undefined> | null
  columnVirtualization: Exclude<DataGridDomOptions<TRow>["columnVirtualization"], false | undefined> | null
  rowSelection?: boolean
  onWindowChanged: () => void
}) {
  if (!options.service) return null
  const rowOverscan = resolveOverscan(
    options.rowVirtualization?.overscan,
    DEFAULT_TABLE_VIRTUALIZATION_CONSTANTS.vertical.minOverscan,
  )
  const columnOverscan = resolveOverscan(
    options.columnVirtualization?.overscan,
    DEFAULT_TABLE_VIRTUALIZATION_CONSTANTS.horizontal.minOverscan,
  )
  let virtualRows: DomViewportRenderState["virtualRows"] = options.rowVirtualization
    ? {
      startIndex: 0,
      endIndex: -1,
      totalRowCount: options.runtime.api.rows.getCount(),
      rowHeight: options.rowVirtualization.rowHeight,
    }
    : undefined
  let virtualColumns: DomViewportRenderState["virtualColumns"]
  let renderQueued = false
  let controller!: DataGridViewportController<TRow>

  const queueRender = (): void => {
    if (renderQueued) return
    renderQueued = true
    queueMicrotask(() => {
      renderQueued = false
      options.onWindowChanged()
    })
  }

  controller = createDataGridViewportController<TRow>({
    rowModel: options.runtime.rowModel,
    columnModel: options.runtime.columnModel,
    resolvePinMode: column => column.pin ?? "none",
    verticalVirtualization: {
      ...DEFAULT_TABLE_VIRTUALIZATION_CONSTANTS.vertical,
      minOverscan: rowOverscan,
    },
    horizontalVirtualization: {
      ...DEFAULT_TABLE_VIRTUALIZATION_CONSTANTS.horizontal,
      minOverscan: columnOverscan,
    },
  })
  if (options.rowVirtualization) {
    controller.setRowHeightMode("fixed")
    controller.setBaseRowHeight(options.rowVirtualization.rowHeight)
  }
  controller.setImperativeCallbacks({
    ...(options.rowVirtualization ? {
      onRows: payload => {
        virtualRows = {
          startIndex: payload.startIndex,
          // Core's virtual row pool uses a half-open [start, end) range while
          // the DOM renderer consumes inclusive indexes.
          endIndex: Math.max(payload.startIndex, payload.endIndex - 1),
          totalRowCount: payload.totalRowCount,
          rowHeight: payload.rowHeight,
        }
        queueRender()
      },
    } : {}),
    ...(options.columnVirtualization ? {
      onColumns: payload => {
        const next = toVirtualColumns(payload)
        // Core also publishes scroll offsets. Native scrolling already moves
        // retained cells; only a changed render window needs DOM reconciliation.
        if (sameColumnWindow(virtualColumns, next)) return
        virtualColumns = next
        queueRender()
      },
    } : {}),
  })
  Object.assign(
    options.service,
    createDataGridViewportCoreService({
      controller,
      rowModel: options.runtime.rowModel,
      columnModel: options.runtime.columnModel,
    }),
    { dispose: () => controller.dispose() },
  )

  return {
    getRenderState(): DomViewportRenderState {
      return {
        ...(virtualRows ? { virtualRows } : {}),
        ...(virtualColumns ? { virtualColumns } : {}),
      }
    },
    attach(): void {
      const bodyViewport = options.grid.querySelector<HTMLElement>(".affino-grid-dom__body")
      const headerViewport = options.grid.querySelector<HTMLElement>(".affino-grid-dom__header-viewport")
      controller.attach(bodyViewport as HTMLDivElement | null, headerViewport)
    },
    refresh(): void {
      controller.refresh(true)
    },
    revealCell(rowIndex: number, columnIndex: number): void {
      if (options.runtime.api.rows.get(rowIndex)?.state.pinned === "bottom") {
        const pinnedBottom = options.grid.querySelector<HTMLElement>(".affino-grid-dom__pinned-bottom")
        if (pinnedBottom) revealMountedDomCell(pinnedBottom, rowIndex, columnIndex)
        return
      }
      revealCellAtViewportEdge({
        viewport: options.grid.querySelector<HTMLElement>(".affino-grid-dom__body"),
        rowIndex,
        columnIndex,
        rowHeight: options.rowVirtualization?.rowHeight ?? null,
        columns: options.runtime.columnModel.getSnapshot().visibleColumns,
        virtualColumns: virtualColumns?.columns ?? null,
        rowSelectionColumnWidth: options.rowSelection ? DOM_ROW_SELECTION_COLUMN_WIDTH : 0,
      })
    },
    detach(): void {
      controller.detach()
    },
  }
}

function revealCellAtViewportEdge(options: {
  viewport: HTMLElement | null
  rowIndex: number
  columnIndex: number
  rowHeight: number | null
  columns: readonly { key: string; pin: "left" | "right" | "none"; width: number | null }[]
  virtualColumns: readonly { index: number; width: number; pin: "left" | "right" | "none" }[] | null
  rowSelectionColumnWidth: number
}): void {
  const viewport = options.viewport
  if (!viewport) return
  if (revealMountedDomCell(viewport, options.rowIndex, options.columnIndex, options.rowHeight)) return
  const nextScrollTop = resolveVerticalRevealOffset(viewport, options.rowIndex, options.rowHeight)
  const nextScrollLeft = resolveHorizontalRevealOffset(
    viewport,
    options.columnIndex,
    options.columns,
    options.virtualColumns,
    options.rowSelectionColumnWidth,
  )
  const changed = nextScrollTop !== viewport.scrollTop || nextScrollLeft !== viewport.scrollLeft
  if (!changed) return
  viewport.scrollTop = nextScrollTop
  viewport.scrollLeft = nextScrollLeft
  viewport.dispatchEvent(new Event("scroll", { bubbles: true }))
}

function resolveVerticalRevealOffset(viewport: HTMLElement, rowIndex: number, rowHeight: number | null): number {
  if (rowHeight != null) {
    const top = rowIndex * rowHeight
    const bottom = top + rowHeight
    if (top < viewport.scrollTop) return top
    if (bottom > viewport.scrollTop + viewport.clientHeight) {
      return Math.max(0, bottom - viewport.clientHeight)
    }
    return viewport.scrollTop
  }

  const row = viewport.querySelector<HTMLElement>(`[role="row"][data-row-index="${rowIndex}"]`)
  if (!row || viewport.clientHeight <= 0) return viewport.scrollTop
  const viewportRect = viewport.getBoundingClientRect()
  const rowRect = row.getBoundingClientRect()
  if (rowRect.top < viewportRect.top) return Math.max(0, viewport.scrollTop + rowRect.top - viewportRect.top)
  if (rowRect.bottom > viewportRect.bottom) return Math.max(0, viewport.scrollTop + rowRect.bottom - viewportRect.bottom)
  return viewport.scrollTop
}

function resolveHorizontalRevealOffset(
  viewport: HTMLElement,
  columnIndex: number,
  columns: readonly { key: string; pin: "left" | "right" | "none"; width: number | null }[],
  virtualColumns: readonly { index: number; width: number; pin: "left" | "right" | "none" }[] | null,
  rowSelectionColumnWidth: number,
): number {
  const target = columns[columnIndex]
  if (!target || target.pin !== "none" || viewport.clientWidth <= 0) return viewport.scrollLeft

  let centerOffset = 0
  let centerWidth = 0
  let pinnedLeftWidth = rowSelectionColumnWidth
  let pinnedRightWidth = 0
  let targetStart: number | null = null
  let targetWidth = 0
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]!
    const measuredWidth = virtualColumns?.find(metric => metric.index === index)?.width
    const width = measuredWidth ?? column.width ?? (column.pin === "none" ? 160 : 120)
    if (column.pin === "left") pinnedLeftWidth += width
    else if (column.pin === "right") pinnedRightWidth += width
    else {
      if (index === columnIndex) {
        targetStart = centerOffset
        targetWidth = width
      }
      centerOffset += width
      centerWidth += width
    }
  }
  if (targetStart == null) return viewport.scrollLeft

  const visibleCenterWidth = Math.max(0, viewport.clientWidth - pinnedLeftWidth - pinnedRightWidth)
  const visibleStart = viewport.scrollLeft
  const visibleEnd = visibleStart + visibleCenterWidth
  let next = visibleStart
  if (targetStart < visibleStart) next = targetStart
  else if (targetStart + targetWidth > visibleEnd) next = targetStart + targetWidth - visibleCenterWidth
  const maxScrollLeft = Math.max(0, centerWidth - visibleCenterWidth)
  return Math.max(0, Math.min(maxScrollLeft, next))
}

function resolveOverscan(value: number | undefined, fallback: number): number {
  return value == null || !Number.isFinite(value) ? fallback : Math.max(0, Math.trunc(value))
}

function toVirtualColumns(payload: DataGridImperativeColumnUpdatePayload) {
  const snapshot = payload.snapshot
  const scrollableColumns = snapshot.visibleScrollable
  const firstScrollable = scrollableColumns[0]
  const lastScrollable = scrollableColumns.at(-1)
  return {
    columns: snapshot.visibleColumns.map(metric => ({
      index: metric.index,
      width: metric.width,
      pin: metric.pin,
      offset: metric.offset ?? 0,
    })),
    // Overscan columns are mounted, so use their edges for the spacer tracks.
    leftPadding: firstScrollable?.offset ?? 0,
    rightPadding: lastScrollable
      ? Math.max(0, snapshot.totalScrollableWidth - (lastScrollable.offset ?? 0) - lastScrollable.width)
      : snapshot.totalScrollableWidth,
  }
}

function sameColumnWindow(
  previous: DomViewportRenderState["virtualColumns"],
  next: NonNullable<DomViewportRenderState["virtualColumns"]>,
): boolean {
  return previous != null
    && previous.leftPadding === next.leftPadding
    && previous.rightPadding === next.rightPadding
    && previous.columns.length === next.columns.length
    && previous.columns.every((column, index) => {
      const other = next.columns[index]!
      return column.index === other.index && column.width === other.width
        && column.pin === other.pin && column.offset === other.offset
    })
}
