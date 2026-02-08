import type { DataGridColumn, VisibleRow } from "../types"
import type { ColumnVirtualizationSnapshot } from "../virtualization/columnSnapshot"
import type { ColumnPinMode } from "../virtualization/types"
import type { DataGridColumnModel } from "../models/columnModel"
import type { DataGridRowModel } from "../models/rowModel"
import type { RowPoolItem } from "./tableViewportSignals"
import type { TableViewportHostEnvironment } from "./viewportHostEnvironment"
import type { CreateWritableSignal } from "../runtime/signals"
import type { AxisVirtualizationConstants, ViewportFrameBudget } from "./tableViewportConstants"
import type { ViewportClock } from "./tableViewportConfig"
import type { FrameScheduler, FrameSchedulerHooks } from "../runtime/frameScheduler"
import type { RafScheduler } from "../runtime/rafScheduler"
import type { MeasurementQueue } from "../runtime/measurementQueue"
export type { LayoutMeasurementSnapshot } from "./tableViewportLayoutCache"

export interface ViewportMetricsSnapshot {
  containerWidth: number
  containerHeight: number
  headerHeight: number
}

export interface ImperativeRowUpdatePayload {
  pool: RowPoolItem[]
  visibleRows?: VisibleRow[]
  startIndex: number
  endIndex: number
  visibleCount: number
  totalRowCount: number
  rowHeight: number
  scrollTop: number
  viewportHeight: number
  overscanLeading: number
  overscanTrailing: number
  timestamp: number
  version: number
}

export interface ImperativeColumnUpdatePayload {
  snapshot: ColumnVirtualizationSnapshot<DataGridColumn>
  scrollLeft: number
  viewportWidth: number
  zoom: number
  timestamp: number
}

export interface ImperativeScrollSyncPayload {
  scrollTop: number
  scrollLeft: number
  timestamp: number
}

export interface TableViewportImperativeCallbacks {
  onRows?: (payload: ImperativeRowUpdatePayload) => void
  onColumns?: (payload: ImperativeColumnUpdatePayload) => void
  onScrollSync?: (payload: ImperativeScrollSyncPayload) => void
}

export interface ViewportSyncTargets {
  scrollHost: HTMLElement | null
  mainViewport: HTMLElement | null
  layoutRoot: HTMLElement | null
  bodyLayer: HTMLElement | null
  headerLayer: HTMLElement | null
  pinnedLeftLayer: HTMLElement | null
  pinnedRightLayer: HTMLElement | null
  overlayRoot: HTMLElement | null
}

export interface ViewportSyncState {
  scrollTop: number
  scrollLeft: number
  pinnedOffsetLeft: number
  pinnedOffsetRight: number
}

export interface ViewportIntegrationSnapshot {
  scrollTop: number
  scrollLeft: number
  viewportHeight: number
  viewportWidth: number
  visibleRowRange: {
    start: number
    end: number
    total: number
  }
  visibleColumnRange: {
    start: number
    end: number
    total: number
  }
  pinnedWidth: {
    left: number
    right: number
  }
  overlaySync: ViewportSyncState
}

export interface TableViewportRuntimeOverrides {
  rafScheduler?: RafScheduler
  createRafScheduler?: () => RafScheduler
  createFrameScheduler?: (hooks: FrameSchedulerHooks) => FrameScheduler
  measurementQueue?: MeasurementQueue
}

export interface TableViewportControllerOptions {
  resolvePinMode: (column: DataGridColumn) => ColumnPinMode
  getColumnKey?: (column: DataGridColumn) => string
  resolveColumnWidth?: (column: DataGridColumn, zoom: number) => number
  rowModel?: DataGridRowModel<unknown> | null
  columnModel?: DataGridColumnModel | null
  createSignal?: CreateWritableSignal<unknown>
  supportsCssZoom?: boolean
  onAfterScroll?: () => void
  onNearBottom?: () => void
  imperativeCallbacks?: TableViewportImperativeCallbacks
  hostEnvironment?: TableViewportHostEnvironment
  clock?: ViewportClock
  frameBudget?: ViewportFrameBudget
  verticalVirtualization?: AxisVirtualizationConstants
  horizontalVirtualization?: AxisVirtualizationConstants
  normalizeAndClampScroll?: boolean
  runtime?: TableViewportRuntimeOverrides
}
