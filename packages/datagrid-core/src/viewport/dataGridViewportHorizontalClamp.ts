import { COLUMN_VIRTUALIZATION_BUFFER } from "../dom/gridUtils"
import { clampScrollOffset, computeHorizontalScrollLimit } from "../virtualization/scrollLimits"

export interface HorizontalClampContext {
  totalScrollableWidth: number
  containerWidthForColumns: number
  pinnedLeftWidth: number
  pinnedRightWidth: number
  averageColumnWidth: number
  nativeScrollLimit: number | null
  virtualizationEnabled: boolean
  bufferColumns?: number
}

export interface HorizontalClampResult {
  normalized: number
  maxScroll: number
  effectiveViewport: number
  trailingGap: number
  nativeLimit: number
  bufferPx: number
}

function normalizePositive(value: number, fallback = 0): number {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return value
}

export function clampHorizontalOffset(
  requestedOffset: number,
  context: HorizontalClampContext,
): HorizontalClampResult {
  const totalScrollableWidth = Math.max(0, context.totalScrollableWidth)
  const containerWidthForColumns = Math.max(0, context.containerWidthForColumns)
  const pinnedLeftWidth = Math.max(0, context.pinnedLeftWidth)
  const pinnedRightWidth = Math.max(0, context.pinnedRightWidth)
  const effectiveViewport = Math.max(0, containerWidthForColumns - pinnedLeftWidth - pinnedRightWidth)
  const averageColumnWidth = normalizePositive(context.averageColumnWidth, 1)
  const bufferColumns = Math.max(0, context.bufferColumns ?? COLUMN_VIRTUALIZATION_BUFFER)
  const bufferPx = bufferColumns * averageColumnWidth
  const trailingGap = Math.max(0, effectiveViewport - totalScrollableWidth)
  const nativeLimit = Math.max(
    0,
    context.nativeScrollLimit != null && Number.isFinite(context.nativeScrollLimit)
      ? (context.nativeScrollLimit as number)
      : 0,
  )

  const maxScroll = context.virtualizationEnabled
    ? computeHorizontalScrollLimit({
        totalScrollableWidth,
        viewportWidth: containerWidthForColumns,
        pinnedLeftWidth,
        pinnedRightWidth,
        bufferPx,
        trailingGap,
        nativeScrollLimit: nativeLimit,
        tolerancePx: averageColumnWidth + 1,
      })
    : nativeLimit

  const normalized = clampScrollOffset({
    offset: Number.isFinite(requestedOffset) ? requestedOffset : 0,
    limit: Number.isFinite(maxScroll) ? maxScroll : 0,
  })

  return {
    normalized,
    maxScroll: Number.isFinite(maxScroll) ? Math.max(0, maxScroll) : 0,
    effectiveViewport,
    trailingGap,
    nativeLimit,
    bufferPx,
  }
}
