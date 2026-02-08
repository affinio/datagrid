import { describe, expect, it } from "vitest"
import type { DataGridColumn } from "../../types"
import { createHorizontalAxisVirtualizer } from "../../virtualization/horizontalVirtualizer"
import { buildHorizontalMeta } from "../tableViewportHorizontalMeta"
import { clampHorizontalOffset } from "../tableViewportHorizontalClamp"

function createColumns(count: number): DataGridColumn[] {
  const columns: DataGridColumn[] = []
  for (let index = 0; index < count; index += 1) {
    const pin = index < 2 ? "left" : index >= count - 2 ? "right" : "none"
    columns.push({
      key: `col-${index}`,
      label: `Col ${index}`,
      pin,
      width: 90 + (index % 5) * 10,
      minWidth: 60,
      maxWidth: 240,
      visible: true,
    })
  }
  return columns
}

describe("horizontal virtualization and pinning coupling contract", () => {
  it("expands visible range when overscan grows at the same offset", () => {
    const columns = createColumns(240)
    const { meta } = buildHorizontalMeta({
      columns,
      layoutScale: 1,
      resolvePinMode: column => (column.pin === "left" || column.pin === "right" ? column.pin : "none"),
      viewportWidth: 1280,
      cachedNativeScrollWidth: 96_000,
      cachedContainerWidth: 1280,
      lastScrollDirection: 1,
      smoothedHorizontalVelocity: 0,
      lastSignature: "",
      version: 0,
      scrollWidth: 96_000,
    })

    const virtualizer = createHorizontalAxisVirtualizer<DataGridColumn>()

    const first = virtualizer.update({
      axis: "horizontal",
      viewportSize: meta.effectiveViewport,
      scrollOffset: 14_000,
      virtualizationEnabled: true,
      estimatedItemSize: 100,
      totalCount: meta.scrollableColumns.length,
      overscan: 2,
      meta,
    })

    const second = virtualizer.update({
      axis: "horizontal",
      viewportSize: meta.effectiveViewport,
      scrollOffset: 14_000,
      virtualizationEnabled: true,
      estimatedItemSize: 100,
      totalCount: meta.scrollableColumns.length,
      overscan: 80,
      meta,
    })

    expect(second.startIndex).toBeLessThanOrEqual(first.startIndex)
    expect(second.endIndex).toBeGreaterThanOrEqual(first.endIndex)
    expect(second.poolSize).toBeGreaterThanOrEqual(first.poolSize)
  })

  it("keeps clamp envelope stable when native scroll limit drifts far above virtualization limit", () => {
    const requested = 1_000_000
    const baseContext = {
      totalScrollableWidth: 28_000,
      containerWidthForColumns: 1400,
      pinnedLeftWidth: 220,
      pinnedRightWidth: 180,
      averageColumnWidth: 100,
      virtualizationEnabled: true,
      bufferColumns: 2,
    }

    const virtualOnly = clampHorizontalOffset(requested, {
      ...baseContext,
      nativeScrollLimit: null,
    })

    const driftedNative = clampHorizontalOffset(requested, {
      ...baseContext,
      nativeScrollLimit: 120_000,
    })

    expect(driftedNative.maxScroll).toBeGreaterThanOrEqual(virtualOnly.maxScroll)
    expect(driftedNative.maxScroll).toBeLessThanOrEqual(virtualOnly.maxScroll + 101)
    expect(driftedNative.normalized).toBeLessThanOrEqual(driftedNative.maxScroll)
  })
})
