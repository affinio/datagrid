import { describe, expect, it } from "vitest"
import type { UiTableColumn } from "../../types"
import { buildHorizontalMeta } from "../tableViewportHorizontalMeta"

function resolvePinMode(column: UiTableColumn): "left" | "right" | "none" {
  return column.pin === "left" || column.pin === "right" ? column.pin : "none"
}

describe("horizontal meta pinning contract", () => {
  it("does not inject synthetic index inset into viewport width", () => {
    const columns: UiTableColumn[] = [
      { key: "name", label: "Name", width: 240 },
      { key: "status", label: "Status", width: 180 },
      { key: "updated", label: "Updated", width: 220 },
    ]

    const { meta } = buildHorizontalMeta({
      columns,
      layoutScale: 1,
      resolvePinMode,
      viewportWidth: 960,
      cachedNativeScrollWidth: 0,
      cachedContainerWidth: 0,
      lastScrollDirection: 0,
      smoothedHorizontalVelocity: 0,
      lastSignature: "",
      version: 0,
    })

    expect(meta.indexColumnWidth).toBe(0)
    expect(meta.containerWidthForColumns).toBe(960)
    expect(meta.effectiveViewport).toBe(960)
  })

  it("subtracts pinned widths exactly once from effective viewport", () => {
    const columns: UiTableColumn[] = [
      { key: "selection", label: "", width: 48, pin: "left", isSystem: true },
      { key: "name", label: "Name", width: 240, pin: "left" },
      { key: "status", label: "Status", width: 180 },
      { key: "owner", label: "Owner", width: 160 },
      { key: "actions", label: "Actions", width: 120, pin: "right" },
    ]

    const { meta } = buildHorizontalMeta({
      columns,
      layoutScale: 1,
      resolvePinMode,
      viewportWidth: 1000,
      cachedNativeScrollWidth: 0,
      cachedContainerWidth: 0,
      lastScrollDirection: 0,
      smoothedHorizontalVelocity: 0,
      lastSignature: "",
      version: 0,
    })

    expect(meta.indexColumnWidth).toBe(0)
    expect(meta.pinnedLeftWidth).toBe(288)
    expect(meta.pinnedRightWidth).toBe(120)
    expect(meta.containerWidthForColumns).toBe(1000)
    expect(meta.effectiveViewport).toBe(592)
  })
})
