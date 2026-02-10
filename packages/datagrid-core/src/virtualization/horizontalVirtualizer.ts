import {
  type ColumnSizeLike,
} from "./columnSizing"
import { clamp } from "../utils/constants"
import { createAxisVirtualizer, type AxisVirtualizerStrategy } from "./axisVirtualizer"
import {
  computeHorizontalScrollClamp,
  computeHorizontalVirtualWindowRange,
  resolveHorizontalEffectiveViewport,
} from "./horizontalVirtualWindowMath"

export interface HorizontalVirtualizerMeta<TColumn extends ColumnSizeLike> {
  scrollableColumns: readonly TColumn[]
  scrollableIndices: readonly number[]
  metrics: {
    widths: number[]
    offsets: number[]
    totalWidth: number
  }
  pinnedLeftWidth: number
  pinnedRightWidth: number
  containerWidthForColumns: number
  nativeScrollLimit: number
  zoom: number
  buffer: number
  scrollDirection: number
  scrollVelocity?: number
  isRTL?: boolean
  version?: number
}

export interface HorizontalVirtualizerPayload {
  visibleStart: number
  visibleEnd: number
  leftPadding: number
  rightPadding: number
  totalScrollableWidth: number
  visibleScrollableWidth: number
  averageWidth: number
  scrollSpeed: number
  effectiveViewport: number
}

export function createHorizontalAxisStrategy<TColumn extends ColumnSizeLike>(): AxisVirtualizerStrategy<
  HorizontalVirtualizerMeta<TColumn>,
  HorizontalVirtualizerPayload
> {
  let lastClampInput = Number.NaN
  let lastClampResult = 0
  let lastClampVersion = -1
  let lastClampOverscanLeading = -1
  let lastClampOverscanTrailing = -1
  let lastClampVirtualizationEnabled = false
  let lastRangeOffset = Number.NaN
  let lastRangeStart = 0
  let lastRangeEnd = 0
  let lastRangePayload: HorizontalVirtualizerPayload | null = null
  let lastVersion = -1
  let lastRangeOverscanLeading = -1
  let lastRangeOverscanTrailing = -1
  let lastRangeVirtualizationEnabled = false

  return {
    computeVisibleCount(context) {
      if (!context.virtualizationEnabled) {
        return context.totalCount
      }
      const { metrics, pinnedLeftWidth, pinnedRightWidth, containerWidthForColumns } = context.meta
      if (!metrics.widths.length) return 0
      const averageWidth = metrics.totalWidth / Math.max(metrics.widths.length, 1)
      if (!Number.isFinite(averageWidth) || averageWidth <= 0) {
        return metrics.widths.length
      }
      const effectiveViewport = resolveHorizontalEffectiveViewport(
        containerWidthForColumns,
        pinnedLeftWidth,
        pinnedRightWidth,
      )
      if (effectiveViewport <= 0) return 1
      return Math.max(1, Math.ceil(effectiveViewport / averageWidth))
    },
    clampScroll(value, context) {
      const {
        metrics,
        containerWidthForColumns,
        pinnedLeftWidth,
        pinnedRightWidth,
        nativeScrollLimit,
        buffer,
        version = -1,
      } = context.meta

      if (version !== lastClampVersion) {
        lastClampVersion = version
        lastClampInput = Number.NaN
      }

      if (
        lastClampOverscanLeading !== context.overscanLeading ||
        lastClampOverscanTrailing !== context.overscanTrailing ||
        lastClampVirtualizationEnabled !== context.virtualizationEnabled
      ) {
        lastClampInput = Number.NaN
        lastClampOverscanLeading = context.overscanLeading
        lastClampOverscanTrailing = context.overscanTrailing
        lastClampVirtualizationEnabled = context.virtualizationEnabled
      }

      if (!metrics.widths.length) return 0

      if (Number.isFinite(lastClampInput) && Math.abs(value - lastClampInput) < 1) {
        return lastClampResult
      }

      lastClampInput = value
      lastClampResult = computeHorizontalScrollClamp({
        value,
        virtualizationEnabled: context.virtualizationEnabled,
        overscanLeading: context.overscanLeading,
        overscanTrailing: context.overscanTrailing,
        meta: {
          metrics,
          pinnedLeftWidth,
          pinnedRightWidth,
          containerWidthForColumns,
          nativeScrollLimit,
          zoom: context.meta.zoom,
          buffer,
          isRTL: context.meta.isRTL,
        },
      })
      return lastClampResult
    },
    computeRange(offset, context, target) {
      const { metrics, scrollVelocity = 0, version = -1 } = context.meta
      const payload = target.payload

      const isRTL = Boolean(context.meta.isRTL)

      if (version !== lastVersion) {
        lastVersion = version
        lastRangeOffset = Number.NaN
        lastRangePayload = null
      }

      if (
        lastRangeOverscanLeading !== context.overscanLeading ||
        lastRangeOverscanTrailing !== context.overscanTrailing ||
        lastRangeVirtualizationEnabled !== context.virtualizationEnabled
      ) {
        lastRangeOffset = Number.NaN
        lastRangePayload = null
        lastRangeOverscanLeading = context.overscanLeading
        lastRangeOverscanTrailing = context.overscanTrailing
        lastRangeVirtualizationEnabled = context.virtualizationEnabled
      }

      if (context.totalCount <= 0 || !metrics.widths.length) {
        payload.visibleStart = 0
        payload.visibleEnd = 0
        payload.leftPadding = 0
        payload.rightPadding = 0
        payload.totalScrollableWidth = 0
        payload.visibleScrollableWidth = 0
        payload.averageWidth = 0
        payload.scrollSpeed = 0
        payload.effectiveViewport = 0
        target.start = 0
        target.end = 0
        lastRangeOffset = offset
        lastRangeStart = 0
        lastRangeEnd = 0
        lastRangePayload = { ...payload }
        return target
      }

      if (Number.isFinite(lastRangeOffset) && Math.abs(offset - lastRangeOffset) < 1 && lastRangePayload) {
        payload.visibleStart = lastRangePayload.visibleStart
        payload.visibleEnd = lastRangePayload.visibleEnd
        payload.leftPadding = lastRangePayload.leftPadding
        payload.rightPadding = lastRangePayload.rightPadding
        payload.totalScrollableWidth = lastRangePayload.totalScrollableWidth
        payload.visibleScrollableWidth = lastRangePayload.visibleScrollableWidth
        payload.averageWidth = lastRangePayload.averageWidth
        payload.scrollSpeed = lastRangePayload.scrollSpeed
        payload.effectiveViewport = lastRangePayload.effectiveViewport
        target.start = lastRangeStart
        target.end = lastRangeEnd
        return target
      }

      const result = computeHorizontalVirtualWindowRange({
        offset,
        totalCount: context.totalCount,
        virtualizationEnabled: context.virtualizationEnabled,
        overscanLeading: context.overscanLeading,
        overscanTrailing: context.overscanTrailing,
        scrollVelocity,
        meta: {
          metrics,
          pinnedLeftWidth: context.meta.pinnedLeftWidth,
          pinnedRightWidth: context.meta.pinnedRightWidth,
          containerWidthForColumns: context.meta.containerWidthForColumns,
          nativeScrollLimit: context.meta.nativeScrollLimit,
          zoom: context.meta.zoom,
          buffer: context.meta.buffer,
          isRTL,
        },
      })

      payload.visibleStart = result.payload.visibleStart
      payload.visibleEnd = result.payload.visibleEnd
      payload.leftPadding = result.payload.leftPadding
      payload.rightPadding = result.payload.rightPadding
      payload.totalScrollableWidth = result.payload.totalScrollableWidth
      payload.visibleScrollableWidth = result.payload.visibleScrollableWidth
      payload.averageWidth = result.payload.averageWidth
      payload.scrollSpeed = result.payload.scrollSpeed
      payload.effectiveViewport = result.payload.effectiveViewport

      target.start = result.start
      target.end = result.end

      lastRangeOffset = offset
      lastRangeStart = target.start
      lastRangeEnd = target.end
      lastRangePayload = { ...payload }
      return target
    },
    getOffsetForIndex(index, context) {
      const { metrics } = context.meta
      if (!metrics.offsets.length) return 0
      const clampedIndex = clamp(index, 0, Math.max(metrics.offsets.length - 1, 0))
      return metrics.offsets[clampedIndex] ?? 0
    },
  }
}

export function createHorizontalAxisVirtualizer<TColumn extends ColumnSizeLike>() {
  return createAxisVirtualizer<HorizontalVirtualizerMeta<TColumn>, HorizontalVirtualizerPayload>(
    "horizontal",
    createHorizontalAxisStrategy<TColumn>(),
    {
      visibleStart: 0,
      visibleEnd: 0,
      leftPadding: 0,
      rightPadding: 0,
      totalScrollableWidth: 0,
      visibleScrollableWidth: 0,
      averageWidth: 0,
      scrollSpeed: 0,
      effectiveViewport: 0,
    },
  )
}
