import type { HorizontalClampContext } from "./dataGridViewportHorizontalClamp"
import type { DataGridViewportHorizontalMeta } from "./dataGridViewportHorizontalMeta"
import type { LayoutMeasurementSnapshot, ViewportMetricsSnapshot } from "./dataGridViewportTypes"

export interface ResolveViewportDimensionsInput {
  viewportMetrics: ViewportMetricsSnapshot | null
  layoutMeasurement: LayoutMeasurementSnapshot | null
  cachedContainerHeight: number
  cachedContainerWidth: number
  cachedHeaderHeight: number
  resolvedRowHeight: number
  fallbackColumnWidth: number
}

export interface ViewportDimensionsResolution {
  containerHeight: number
  containerWidth: number
  headerHeight: number
  viewportHeight: number
  viewportWidth: number
}

export interface ResolvePendingScrollInput {
  pendingScrollTopRequest: number | null
  pendingScrollLeftRequest: number | null
  measuredScrollTop: number | null | undefined
  measuredScrollLeft: number | null | undefined
  lastScrollTopSample: number
  lastScrollLeftSample: number
}

export interface PendingScrollResolution {
  fallbackScrollTop: number
  fallbackScrollLeft: number
  pendingTop: number
  pendingLeft: number
  measuredScrollTopFromPending: boolean
  measuredScrollLeftFromPending: boolean
  hadPendingScrollTop: boolean
  hadPendingScrollLeft: boolean
}

export interface ShouldUseFastPathInput {
  force: boolean
  pendingHorizontalSettle: boolean
  measuredScrollTopFromPending: boolean
  measuredScrollLeftFromPending: boolean
  hadPendingScrollTop: boolean
  hadPendingScrollLeft: boolean
  scrollTopDelta: number
  scrollLeftDelta: number
  verticalScrollEpsilon: number
  horizontalScrollEpsilon: number
}

export interface HorizontalSizingInput {
  columnMeta: DataGridViewportHorizontalMeta
  viewportWidth: number
  totalRowCount: number
  resolvedRowHeight: number
  viewportHeight: number
}

export interface HorizontalSizingResolution {
  averageColumnWidth: number
  contentWidthEstimate: number
  contentHeightEstimate: number
  horizontalClampContext: HorizontalClampContext
}

export interface NearBottomCheckInput {
  nextScrollTop: number
  totalContentHeight: number
  viewportHeight: number
  totalRowCount: number
  loading: boolean
}

function normalizeFinite(value: number | null | undefined, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return value as number
}

export function resolveViewportDimensions(
  input: ResolveViewportDimensionsInput,
): ViewportDimensionsResolution {
  const { viewportMetrics, layoutMeasurement, resolvedRowHeight, fallbackColumnWidth } = input

  let containerHeight = input.cachedContainerHeight
  let containerWidth = input.cachedContainerWidth
  let headerHeight = input.cachedHeaderHeight

  if (viewportMetrics) {
    containerHeight = viewportMetrics.containerHeight
    containerWidth = viewportMetrics.containerWidth
    headerHeight = viewportMetrics.headerHeight
  } else if (layoutMeasurement) {
    containerHeight = layoutMeasurement.containerHeight
    containerWidth = layoutMeasurement.containerWidth
    headerHeight = layoutMeasurement.headerHeight
  }

  if (containerHeight <= 0) {
    containerHeight = input.cachedContainerHeight > 0 ? input.cachedContainerHeight : resolvedRowHeight
  }
  if (containerWidth <= 0) {
    containerWidth = input.cachedContainerWidth > 0 ? input.cachedContainerWidth : fallbackColumnWidth
  }
  if (headerHeight < 0) {
    headerHeight = input.cachedHeaderHeight > 0 ? input.cachedHeaderHeight : 0
  }

  return {
    containerHeight,
    containerWidth,
    headerHeight,
    viewportHeight: Math.max(containerHeight - headerHeight, resolvedRowHeight),
    viewportWidth: containerWidth,
  }
}

export function resolvePendingScroll(input: ResolvePendingScrollInput): PendingScrollResolution {
  const fallbackScrollTop = normalizeFinite(input.measuredScrollTop, normalizeFinite(input.lastScrollTopSample))
  const fallbackScrollLeft = normalizeFinite(input.measuredScrollLeft, normalizeFinite(input.lastScrollLeftSample))

  const hasPendingTop = typeof input.pendingScrollTopRequest === "number" && Number.isFinite(input.pendingScrollTopRequest)
  const hasPendingLeft =
    typeof input.pendingScrollLeftRequest === "number" && Number.isFinite(input.pendingScrollLeftRequest)

  return {
    fallbackScrollTop,
    fallbackScrollLeft,
    pendingTop: hasPendingTop ? (input.pendingScrollTopRequest as number) : fallbackScrollTop,
    pendingLeft: hasPendingLeft ? (input.pendingScrollLeftRequest as number) : fallbackScrollLeft,
    measuredScrollTopFromPending: hasPendingTop,
    measuredScrollLeftFromPending: hasPendingLeft,
    hadPendingScrollTop: input.pendingScrollTopRequest != null,
    hadPendingScrollLeft: input.pendingScrollLeftRequest != null,
  }
}

export function shouldUseFastPath(input: ShouldUseFastPathInput): boolean {
  return (
    !input.force &&
    !input.pendingHorizontalSettle &&
    !input.measuredScrollTopFromPending &&
    !input.measuredScrollLeftFromPending &&
    !input.hadPendingScrollTop &&
    !input.hadPendingScrollLeft &&
    input.scrollTopDelta <= input.verticalScrollEpsilon &&
    input.scrollLeftDelta <= input.horizontalScrollEpsilon
  )
}

export function resolveHorizontalSizing(input: HorizontalSizingInput): HorizontalSizingResolution {
  const { columnMeta, viewportWidth, totalRowCount, resolvedRowHeight, viewportHeight } = input
  const totalPinnedWidth = columnMeta.pinnedLeftWidth + columnMeta.pinnedRightWidth
  const contentWidthEstimate = Math.max(columnMeta.metrics.totalWidth + totalPinnedWidth, viewportWidth)
  const contentHeightEstimate = Math.max(totalRowCount * resolvedRowHeight, viewportHeight)

  const fallbackWidth =
    columnMeta.metrics.widths[0] ??
    columnMeta.pinnedLeft[0]?.width ??
    columnMeta.pinnedRight[0]?.width ??
    60
  const averageColumnWidth = columnMeta.metrics.widths.length
    ? Math.max(1, columnMeta.metrics.totalWidth / Math.max(columnMeta.metrics.widths.length, 1))
    : Math.max(1, fallbackWidth)

  return {
    averageColumnWidth,
    contentWidthEstimate,
    contentHeightEstimate,
    horizontalClampContext: {
      totalScrollableWidth: columnMeta.metrics.totalWidth,
      containerWidthForColumns: columnMeta.containerWidthForColumns,
      pinnedLeftWidth: columnMeta.pinnedLeftWidth,
      pinnedRightWidth: columnMeta.pinnedRightWidth,
      averageColumnWidth,
      nativeScrollLimit: columnMeta.nativeScrollLimit,
      virtualizationEnabled: true,
    },
  }
}

export function computePinnedWidth(entries: readonly { width: number }[]): number {
  let total = 0
  for (const entry of entries) {
    const width = Number.isFinite(entry.width) ? (entry.width as number) : 0
    total += Math.max(0, width)
  }
  return total
}

export function shouldNotifyNearBottom(input: NearBottomCheckInput): boolean {
  if (input.loading || input.viewportHeight <= 0 || input.totalRowCount <= 0) {
    return false
  }
  const threshold = Math.max(0, input.totalContentHeight - input.viewportHeight * 2)
  return input.nextScrollTop >= threshold
}
