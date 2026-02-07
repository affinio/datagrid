import { describe, expect, it } from "vitest"
import type { UiTableColumn } from "../../types"
import { createEmptyColumnSnapshot } from "../../virtualization/columnSnapshot"
import { createHorizontalOverscanController } from "../../virtualization/dynamicOverscan"
import { createAxisVirtualizer } from "../../virtualization/axisVirtualizer"
import { createHorizontalAxisStrategy } from "../../virtualization/horizontalVirtualizer"
import { buildHorizontalMeta } from "../tableViewportHorizontalMeta"
import { prepareHorizontalViewport } from "../tableViewportHorizontalUpdate"

function createColumns(): UiTableColumn[] {
  return [
    { key: "id", label: "ID", pin: "left", width: 80 },
    { key: "name", label: "Name", width: 180 },
    { key: "region", label: "Region", width: 160 },
    { key: "updatedAt", label: "Updated", width: 220 },
    { key: "actions", label: "Actions", pin: "right", width: 120 },
  ]
}

describe("horizontal update contract", () => {
  it("does not mutate input meta in prepare phase", () => {
    const columns = createColumns()
    const horizontalMeta = buildHorizontalMeta({
      columns,
      layoutScale: 1,
      resolvePinMode: column => (column.isSystem ? "left" : column.pin === "left" || column.pin === "right" ? column.pin : "none"),
      viewportWidth: 900,
      cachedNativeScrollWidth: 2200,
      cachedContainerWidth: 900,
      lastScrollDirection: 0,
      smoothedHorizontalVelocity: 0,
      lastSignature: "",
      version: 0,
    }).meta

    const originalDirection = horizontalMeta.scrollDirection
    const originalVelocity = horizontalMeta.scrollVelocity

    const horizontalVirtualizer = createAxisVirtualizer(
      "horizontal",
      createHorizontalAxisStrategy<UiTableColumn>(),
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

    const overscanController = createHorizontalOverscanController({
      minOverscan: 2,
      velocityRatio: 0.9,
      viewportRatio: 0.75,
      decay: 0.58,
      maxViewportMultiplier: 3,
      teleportMultiplier: 2.5,
      frameDurationMs: 16.7,
      minSampleMs: 8,
    })

    const prepared = prepareHorizontalViewport({
      columnMeta: horizontalMeta,
      horizontalVirtualizer,
      horizontalOverscanController: overscanController,
      callbacks: {
        applyColumnSnapshot: () => {},
      },
      columnSnapshot: createEmptyColumnSnapshot<UiTableColumn>(),
      layoutScale: 1,
      viewportWidth: 900,
      nowTs: 32,
      frameTimeValue: 16.7,
      averageColumnWidth: 180,
      scrollDirection: 1,
      horizontalVirtualizationEnabled: true,
      horizontalUpdateForced: true,
      currentPendingLeft: 320,
      previousScrollLeftSample: 0,
      deltaLeft: 320,
      horizontalScrollEpsilon: 2,
      pendingScrollLeftRequest: null,
      measuredScrollLeftFromPending: false,
      currentScrollLeftMeasurement: 0,
      smoothedHorizontalVelocity: 0,
      lastHorizontalSampleTime: 0,
      horizontalOverscan: 2,
      lastAppliedHorizontalMetaVersion: -1,
    })

    expect(prepared.shouldUpdate).toBe(true)
    expect(horizontalMeta.scrollDirection).toBe(originalDirection)
    expect(horizontalMeta.scrollVelocity).toBe(originalVelocity)
  })
})
