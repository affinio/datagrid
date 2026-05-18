import { describe, expect, it } from "vitest"
import { accumulateColumnWidths, type ColumnSizeLike } from "../../virtualization/columnSizing"
import { createHorizontalAxisVirtualizer } from "../../virtualization/horizontalVirtualizer"
import { createVerticalAxisVirtualizer } from "../../virtualization/verticalVirtualizer"
import type { AxisVirtualizerState } from "../../virtualization/axisVirtualizer"
import type { HorizontalVirtualizerPayload } from "../../virtualization/horizontalVirtualizer"

function expectRangeInvariants<TPayload>(
  state: AxisVirtualizerState<TPayload>,
  totalCount: number,
): void {
  expect(state.startIndex).toBeGreaterThanOrEqual(0)
  expect(state.endIndex).toBeGreaterThanOrEqual(state.startIndex)
  expect(state.endIndex).toBeLessThanOrEqual(totalCount)
  expect(state.poolSize).toBe(state.endIndex - state.startIndex)

  const indexes = Array.from(
    { length: state.endIndex - state.startIndex },
    (_unused, offset) => state.startIndex + offset,
  )
  expect(new Set(indexes).size).toBe(indexes.length)
}

function expectVerticalViewportCovered(
  state: AxisVirtualizerState<undefined>,
  rowHeight: number,
): void {
  if (state.totalCount <= 0 || state.visibleCount <= 0) {
    expect(state.startIndex).toBe(0)
    expect(state.endIndex).toBe(0)
    return
  }
  const maxVisibleStart = Math.max(0, state.totalCount - state.visibleCount)
  const visibleStart = Math.min(
    maxVisibleStart,
    Math.max(0, Math.floor(state.offset / Math.max(1, rowHeight))),
  )
  const visibleEnd = Math.min(state.totalCount, visibleStart + state.visibleCount)

  expect(state.startIndex).toBeLessThanOrEqual(visibleStart)
  expect(state.endIndex).toBeGreaterThanOrEqual(visibleEnd)
}

function buildColumns(count: number): ColumnSizeLike[] {
  return Array.from({ length: count }, (_unused, index) => ({
    width: 80 + (index % 5) * 16,
    minWidth: 64,
    maxWidth: 200,
  }))
}

function buildFractionalColumns(count: number): ColumnSizeLike[] {
  return Array.from({ length: count }, (_unused, index) => ({
    width: 88.25 + (index % 7) * 9.5,
    minWidth: 63.5,
    maxWidth: 220.75,
  }))
}

function createHorizontalMeta(columns: readonly ColumnSizeLike[], options: {
  containerWidthForColumns?: number
  pinnedLeftWidth?: number
  pinnedRightWidth?: number
  nativeScrollLimit?: number
  zoom?: number
  buffer?: number
  scrollDirection?: number
  scrollVelocity?: number
} = {}) {
  return {
    scrollableColumns: columns,
    scrollableIndices: columns.map((_column, index) => index),
    metrics: accumulateColumnWidths(columns, options.zoom ?? 1),
    pinnedLeftWidth: options.pinnedLeftWidth ?? 0,
    pinnedRightWidth: options.pinnedRightWidth ?? 0,
    containerWidthForColumns: options.containerWidthForColumns ?? 640,
    nativeScrollLimit: options.nativeScrollLimit ?? 20_000,
    zoom: options.zoom ?? 1,
    buffer: options.buffer ?? 2,
    scrollDirection: options.scrollDirection ?? 0,
    scrollVelocity: options.scrollVelocity ?? 0,
  }
}

function expectHorizontalViewportCovered(
  state: AxisVirtualizerState<HorizontalVirtualizerPayload>,
): void {
  expect(state.payload.visibleStart).toBeGreaterThanOrEqual(0)
  expect(state.payload.visibleEnd).toBeGreaterThanOrEqual(state.payload.visibleStart)
  expect(state.payload.visibleEnd).toBeLessThanOrEqual(state.totalCount)
  expect(state.startIndex).toBeLessThanOrEqual(state.payload.visibleStart)
  expect(state.endIndex).toBeGreaterThanOrEqual(state.payload.visibleEnd)
  expect(state.payload.leftPadding).toBeGreaterThanOrEqual(0)
  expect(state.payload.rightPadding).toBeGreaterThanOrEqual(0)
}

describe("core virtualization range invariants", () => {
  it("keeps vertical ranges bounded, monotonic, and viewport-covering", () => {
    const cases = [
      { totalCount: 0, viewportSize: 320, scrollOffset: 0, rowHeight: 32, overscan: 4, virtualizationEnabled: true },
      { totalCount: 1, viewportSize: 320, scrollOffset: 0, rowHeight: 32, overscan: 4, virtualizationEnabled: true },
      { totalCount: 8, viewportSize: 256, scrollOffset: 0, rowHeight: 32, overscan: 4, virtualizationEnabled: true },
      { totalCount: 100, viewportSize: 128, scrollOffset: 0, rowHeight: 32, overscan: 8, virtualizationEnabled: true },
      { totalCount: 100, viewportSize: 128, scrollOffset: 96, rowHeight: 32, overscan: 8, virtualizationEnabled: true },
      { totalCount: 100, viewportSize: 128, scrollOffset: 3_200, rowHeight: 32, overscan: 8, virtualizationEnabled: true },
      { totalCount: 100, viewportSize: 128, scrollOffset: 96, rowHeight: 32, overscan: 60, virtualizationEnabled: true },
      { totalCount: 100, viewportSize: 128, scrollOffset: -400, rowHeight: 32, overscan: 8, virtualizationEnabled: true },
      { totalCount: 100, viewportSize: 128, scrollOffset: Number.NaN, rowHeight: 32, overscan: 8, virtualizationEnabled: true },
      { totalCount: 100, viewportSize: 128, scrollOffset: 96, rowHeight: 32, overscan: 8, virtualizationEnabled: false },
    ]

    for (const entry of cases) {
      const virtualizer = createVerticalAxisVirtualizer()
      const state = virtualizer.update({
        axis: "vertical",
        viewportSize: entry.viewportSize,
        scrollOffset: entry.scrollOffset,
        virtualizationEnabled: entry.virtualizationEnabled,
        estimatedItemSize: entry.rowHeight,
        totalCount: entry.totalCount,
        overscan: entry.overscan,
        meta: {
          zoom: 1,
          scrollDirection: entry.scrollOffset > 0 ? 1 : 0,
        },
      })

      expectRangeInvariants(state, entry.totalCount)
      expectVerticalViewportCovered(state, entry.rowHeight)
    }
  })

  it("keeps vertical reverse-direction overscan bounded near edges", () => {
    const virtualizer = createVerticalAxisVirtualizer()
    const state = virtualizer.update({
      axis: "vertical",
      viewportSize: 240,
      scrollOffset: 1_280,
      virtualizationEnabled: true,
      estimatedItemSize: 24,
      totalCount: 240,
      overscan: 96,
      meta: {
        zoom: 1,
        scrollDirection: -1,
      },
    })

    expectRangeInvariants(state, 240)
    expectVerticalViewportCovered(state, 24)
    expect(state.overscanLeading).toBeGreaterThan(state.overscanTrailing)
  })

  it("keeps vertical ranges covered with fractional row heights and zoom", () => {
    const cases = [
      { totalCount: 10_000, viewportSize: 433.5, scrollOffset: 12_345.75, rowHeight: 27.5, zoom: 1.25 },
      { totalCount: 10_000, viewportSize: 517.25, scrollOffset: 241_002.4, rowHeight: 31.75, zoom: 0.8 },
      { totalCount: 10_000, viewportSize: 389.5, scrollOffset: 999_999.9, rowHeight: 22.25, zoom: 1.5 },
    ]

    for (const entry of cases) {
      const virtualizer = createVerticalAxisVirtualizer()
      const state = virtualizer.update({
        axis: "vertical",
        viewportSize: entry.viewportSize,
        scrollOffset: entry.scrollOffset,
        virtualizationEnabled: true,
        estimatedItemSize: entry.rowHeight,
        totalCount: entry.totalCount,
        overscan: 9,
        meta: {
          zoom: entry.zoom,
          scrollDirection: 1,
        },
      })

      expectRangeInvariants(state, entry.totalCount)
      expectVerticalViewportCovered(state, entry.rowHeight)
    }
  })

  it("keeps horizontal ranges bounded, monotonic, and viewport-covering", () => {
    const cases = [
      { columnCount: 0, scrollOffset: 0, virtualizationEnabled: true },
      { columnCount: 1, scrollOffset: 0, virtualizationEnabled: true },
      { columnCount: 4, scrollOffset: 0, virtualizationEnabled: true, containerWidthForColumns: 1_200 },
      { columnCount: 120, scrollOffset: 0, virtualizationEnabled: true },
      { columnCount: 120, scrollOffset: 480, virtualizationEnabled: true },
      { columnCount: 120, scrollOffset: 999_999, virtualizationEnabled: true },
      { columnCount: 120, scrollOffset: -400, virtualizationEnabled: true },
      { columnCount: 120, scrollOffset: Number.NaN, virtualizationEnabled: true },
      { columnCount: 120, scrollOffset: 480, virtualizationEnabled: false },
    ]

    for (const entry of cases) {
      const columns = buildColumns(entry.columnCount)
      const virtualizer = createHorizontalAxisVirtualizer()
      const state = virtualizer.update({
        axis: "horizontal",
        viewportSize: entry.containerWidthForColumns ?? 640,
        scrollOffset: entry.scrollOffset,
        virtualizationEnabled: entry.virtualizationEnabled,
        estimatedItemSize: 120,
        totalCount: entry.columnCount,
        overscan: 6,
        meta: createHorizontalMeta(columns, {
          containerWidthForColumns: entry.containerWidthForColumns,
          scrollDirection: entry.scrollOffset > 0 ? 1 : 0,
        }),
      })

      expectRangeInvariants(state, entry.columnCount)
      expectHorizontalViewportCovered(state)
    }
  })

  it("keeps pinned-width horizontal math covered near max scroll", () => {
    const columns = buildColumns(240)
    const virtualizer = createHorizontalAxisVirtualizer()
    const state = virtualizer.update({
      axis: "horizontal",
      viewportSize: 720,
      scrollOffset: 40_000,
      virtualizationEnabled: true,
      estimatedItemSize: 120,
      totalCount: columns.length,
      overscan: 12,
      meta: createHorizontalMeta(columns, {
        containerWidthForColumns: 720,
        pinnedLeftWidth: 180,
        pinnedRightWidth: 160,
        nativeScrollLimit: 18_000,
        scrollDirection: 1,
        scrollVelocity: 2_400,
      }),
    })

    expectRangeInvariants(state, columns.length)
    expectHorizontalViewportCovered(state)
    expect(state.payload.effectiveViewport).toBe(380)
    expect(state.endIndex).toBe(columns.length)
  })

  it("keeps horizontal ranges covered with fractional widths, zoom, and max scroll", () => {
    const columns = buildFractionalColumns(1_000)
    const meta = createHorizontalMeta(columns, {
      containerWidthForColumns: 913.5,
      pinnedLeftWidth: 147.25,
      pinnedRightWidth: 133.75,
      nativeScrollLimit: 180_000.5,
      zoom: 1.25,
      scrollDirection: 1,
      scrollVelocity: 3_200.5,
    })
    const virtualizer = createHorizontalAxisVirtualizer()
    const state = virtualizer.update({
      axis: "horizontal",
      viewportSize: 913.5,
      scrollOffset: meta.metrics.totalWidth + 999.4,
      virtualizationEnabled: true,
      estimatedItemSize: 118.5,
      totalCount: columns.length,
      overscan: 11,
      meta,
    })

    expectRangeInvariants(state, columns.length)
    expectHorizontalViewportCovered(state)
    expect(state.payload.effectiveViewport).toBeCloseTo(632.5, 5)
    expect(state.endIndex).toBe(columns.length)
  })
})
