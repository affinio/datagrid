import { describe, expect, it } from "vitest"
import { createAxisVirtualizer } from "../../virtualization/axisVirtualizer"
import {
  createHorizontalOverscanController,
  createVerticalOverscanController,
} from "../../virtualization/dynamicOverscan"
import { createHorizontalAxisVirtualizer } from "../../virtualization/horizontalVirtualizer"
import { createVerticalAxisStrategy } from "../../virtualization/verticalVirtualizer"
import { accumulateColumnWidths, type ColumnSizeLike } from "../../virtualization/columnSizing"

describe("vertical velocity overscan contract", () => {
  it("keeps base overscan for idle or slow scroll samples", () => {
    const controller = createVerticalOverscanController({
      minOverscan: 8,
      velocityRatio: 0.85,
      viewportRatio: 0.55,
      decay: 0.58,
      maxViewportMultiplier: 3,
      frameDurationMs: 16.7,
      minSampleMs: 8,
    })

    expect(controller.update({
      timestamp: 16,
      delta: 0,
      viewportSize: 400,
      itemSize: 20,
      virtualizationEnabled: true,
    }).overscan).toBe(8)
  })

  it("increases overscan for fast scroll samples and respects the viewport cap", () => {
    const controller = createVerticalOverscanController({
      minOverscan: 8,
      velocityRatio: 0.85,
      viewportRatio: 0.55,
      decay: 0.58,
      maxViewportMultiplier: 3,
      frameDurationMs: 16.7,
      minSampleMs: 8,
    })

    const fast = controller.update({
      timestamp: 16,
      delta: 400,
      viewportSize: 400,
      itemSize: 20,
      virtualizationEnabled: true,
    }).overscan

    expect(fast).toBeGreaterThan(8)

    let capped = fast
    for (let index = 0; index < 10; index += 1) {
      capped = controller.update({
        timestamp: 32 + index * 16,
        delta: 900,
        viewportSize: 400,
        itemSize: 20,
        virtualizationEnabled: true,
      }).overscan
    }

    expect(capped).toBeLessThanOrEqual(68)
  })

  it("distributes overscan toward the active scroll direction", () => {
    const virtualizer = createAxisVirtualizer("vertical", createVerticalAxisStrategy(), undefined)

    const down = { ...virtualizer.update({
      axis: "vertical",
      viewportSize: 400,
      scrollOffset: 1_000,
      virtualizationEnabled: true,
      estimatedItemSize: 20,
      totalCount: 10_000,
      overscan: 20,
      meta: {
        zoom: 1,
        scrollDirection: 1,
      },
    }) }

    const up = { ...virtualizer.update({
      axis: "vertical",
      viewportSize: 400,
      scrollOffset: 1_000,
      virtualizationEnabled: true,
      estimatedItemSize: 20,
      totalCount: 10_000,
      overscan: 20,
      meta: {
        zoom: 1,
        scrollDirection: -1,
      },
    }) }

    expect(down.overscanTrailing).toBeGreaterThan(down.overscanLeading)
    expect(up.overscanLeading).toBeGreaterThan(up.overscanTrailing)
  })

  it("returns zero overscan when virtualization is disabled", () => {
    const controller = createVerticalOverscanController({
      minOverscan: 8,
    })

    expect(controller.update({
      timestamp: 16,
      delta: 400,
      viewportSize: 400,
      itemSize: 20,
      virtualizationEnabled: false,
    }).overscan).toBe(0)
  })

  it("resets adaptive overscan to the base budget after idle", () => {
    const controller = createVerticalOverscanController({
      minOverscan: 8,
      velocityRatio: 0.85,
      viewportRatio: 0.55,
      decay: 0.58,
      maxViewportMultiplier: 3,
      frameDurationMs: 16.7,
      minSampleMs: 8,
    })

    const active = controller.update({
      timestamp: 16,
      delta: 360,
      viewportSize: 400,
      itemSize: 20,
      virtualizationEnabled: true,
    }).overscan
    expect(active).toBeGreaterThan(8)

    controller.reset(160)
    expect(controller.getState().lastOverscan).toBe(8)
    expect(controller.update({
      timestamp: 176,
      delta: 0,
      viewportSize: 400,
      itemSize: 20,
      virtualizationEnabled: true,
    }).overscan).toBe(8)
  })

  it("treats jump scroll samples as bounded and non-inflating", () => {
    const controller = createVerticalOverscanController({
      minOverscan: 8,
      velocityRatio: 0.85,
      viewportRatio: 0.55,
      decay: 0.58,
      maxViewportMultiplier: 3,
      teleportMultiplier: 2.5,
      frameDurationMs: 16.7,
      minSampleMs: 8,
    })

    const jump = controller.update({
      timestamp: 16,
      delta: 4_000,
      viewportSize: 400,
      itemSize: 20,
      virtualizationEnabled: true,
    }).overscan

    expect(jump).toBe(8)
  })

  it("supports the Vue app immediate lookahead profile through the shared controller", () => {
    const frameMs = 16.7
    const controller = createVerticalOverscanController({
      minOverscan: 1,
      velocityRatio: 160 / frameMs,
      viewportRatio: 0,
      decay: 0,
      maxViewportMultiplier: 3,
      teleportMultiplier: Number.POSITIVE_INFINITY,
      frameDurationMs: frameMs,
      minSampleMs: 1,
    })
    controller.reset(0)

    const burst = controller.update({
      timestamp: 16,
      delta: 400,
      viewportSize: 100,
      itemSize: 20,
      virtualizationEnabled: true,
    }).overscan

    expect(burst).toBe(16)
  })

  it("keeps horizontal adaptive overscan bounded near the scrollable edges", () => {
    const columns: ColumnSizeLike[] = Array.from({ length: 120 }, () => ({
      width: 100,
      minWidth: 64,
      maxWidth: 200,
    }))
    const overscanController = createHorizontalOverscanController({
      minOverscan: 2,
      velocityRatio: 0.9,
      viewportRatio: 0.75,
      decay: 0.58,
      maxViewportMultiplier: 3,
      frameDurationMs: 16.7,
      minSampleMs: 8,
    })
    const overscan = overscanController.update({
      timestamp: 16,
      delta: 1_200,
      viewportSize: 620,
      itemSize: 100,
      totalItems: columns.length,
      virtualizationEnabled: true,
    }).overscan
    const virtualizer = createHorizontalAxisVirtualizer()
    const state = virtualizer.update({
      axis: "horizontal",
      viewportSize: 620,
      scrollOffset: 999_999,
      virtualizationEnabled: true,
      estimatedItemSize: 100,
      totalCount: columns.length,
      overscan,
      meta: {
        scrollableColumns: columns,
        scrollableIndices: columns.map((_column, index) => index),
        metrics: accumulateColumnWidths(columns, 1),
        pinnedLeftWidth: 0,
        pinnedRightWidth: 0,
        containerWidthForColumns: 620,
        nativeScrollLimit: 20_000,
        zoom: 1,
        buffer: 2,
        scrollDirection: 1,
        scrollVelocity: 1_200,
      },
    })

    expect(overscan).toBeGreaterThanOrEqual(2)
    expect(overscan).toBeLessThanOrEqual(21)
    expect(state.startIndex).toBeGreaterThanOrEqual(0)
    expect(state.endIndex).toBe(columns.length)
    expect(state.payload.visibleEnd).toBe(columns.length)
    expect(state.payload.rightPadding).toBe(0)
  })
})
