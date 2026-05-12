import { describe, expect, it } from "vitest"
import { createAxisVirtualizer } from "../../virtualization/axisVirtualizer"
import { createVerticalOverscanController } from "../../virtualization/dynamicOverscan"
import { createVerticalAxisStrategy } from "../../virtualization/verticalVirtualizer"

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
})
