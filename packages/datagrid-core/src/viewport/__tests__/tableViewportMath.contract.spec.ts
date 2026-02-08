import { describe, expect, it } from "vitest"
import {
  computePinnedWidth,
  resolveHorizontalSizing,
  resolvePendingScroll,
  resolveViewportDimensions,
  shouldNotifyNearBottom,
  shouldUseFastPath,
} from "../tableViewportMath"

describe("viewport math engine contracts", () => {
  it("resolves viewport dimensions deterministically with fallback guards", () => {
    const input = {
      viewportMetrics: null,
      layoutMeasurement: null,
      cachedContainerHeight: 720,
      cachedContainerWidth: 1280,
      cachedHeaderHeight: 48,
      resolvedRowHeight: 32,
      fallbackColumnWidth: 960,
    } as const

    const first = resolveViewportDimensions(input)
    const second = resolveViewportDimensions(input)

    expect(first).toEqual(second)
    expect(first.viewportHeight).toBe(672)
    expect(first.viewportWidth).toBe(1280)
  })

  it("normalizes pending scroll and keeps fast-path decision pure", () => {
    const pending = resolvePendingScroll({
      pendingScrollTopRequest: null,
      pendingScrollLeftRequest: null,
      measuredScrollTop: 140,
      measuredScrollLeft: 64,
      lastScrollTopSample: 140,
      lastScrollLeftSample: 64,
    })

    expect(pending.pendingTop).toBe(140)
    expect(pending.pendingLeft).toBe(64)

    expect(
      shouldUseFastPath({
        force: false,
        pendingHorizontalSettle: false,
        measuredScrollTopFromPending: pending.measuredScrollTopFromPending,
        measuredScrollLeftFromPending: pending.measuredScrollLeftFromPending,
        hadPendingScrollTop: pending.hadPendingScrollTop,
        hadPendingScrollLeft: pending.hadPendingScrollLeft,
        scrollTopDelta: 0,
        scrollLeftDelta: 0,
        verticalScrollEpsilon: 0.5,
        horizontalScrollEpsilon: 0.5,
      }),
    ).toBe(true)
  })

  it("produces deterministic horizontal sizing contracts", () => {
    const columnMeta = {
      scrollableColumns: [],
      scrollableIndices: [],
      metrics: {
        widths: [120, 140, 160],
        starts: [],
        ends: [],
        totalWidth: 420,
      },
      pinnedLeft: [{ width: 96 }],
      pinnedRight: [{ width: 104 }],
      pinnedLeftWidth: 96,
      pinnedRightWidth: 104,
      zoom: 1,
      containerWidthForColumns: 800,
      scrollDirection: 1,
      nativeScrollLimit: 500,
      buffer: 2,
      indexColumnWidth: 0,
      effectiveViewport: 600,
      version: 1,
      scrollVelocity: 0,
    } as any

    const input = {
      columnMeta,
      viewportWidth: 800,
      totalRowCount: 10_000,
      resolvedRowHeight: 28,
      viewportHeight: 640,
    } as const

    const first = resolveHorizontalSizing(input)
    const second = resolveHorizontalSizing(input)

    expect(first).toEqual(second)
    expect(first.averageColumnWidth).toBeGreaterThan(0)
    expect(first.contentWidthEstimate).toBeGreaterThanOrEqual(800)
    expect(first.contentHeightEstimate).toBeGreaterThanOrEqual(640)
    expect(first.horizontalClampContext.nativeScrollLimit).toBe(500)
  })

  it("keeps pinned-width and near-bottom checks deterministic", () => {
    expect(computePinnedWidth([{ width: 120 }, { width: 80 }, { width: Number.NaN }])).toBe(200)

    const shouldFire = shouldNotifyNearBottom({
      nextScrollTop: 900,
      totalContentHeight: 1200,
      viewportHeight: 200,
      totalRowCount: 100,
      loading: false,
    })
    const shouldSkip = shouldNotifyNearBottom({
      nextScrollTop: 100,
      totalContentHeight: 1200,
      viewportHeight: 200,
      totalRowCount: 100,
      loading: false,
    })

    expect(shouldFire).toBe(true)
    expect(shouldSkip).toBe(false)
  })
})
