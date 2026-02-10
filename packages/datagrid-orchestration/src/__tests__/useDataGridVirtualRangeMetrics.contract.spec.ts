import { describe, expect, it } from "vitest"
import {
  computeDataGridVirtualRange,
  useDataGridVirtualRangeMetrics,
} from "../useDataGridVirtualRangeMetrics"

describe("useDataGridVirtualRangeMetrics contract", () => {
  it("computes range from canonical virtualWindow", () => {
    const range = computeDataGridVirtualRange({
      virtualWindow: {
        rowStart: 8,
        rowEnd: 19,
        rowTotal: 100,
      },
      rowHeight: 40,
    })
    expect(range).toEqual({ start: 8, end: 19 })
  })

  it("uses canonical virtualWindow when provided", () => {
    const metrics = useDataGridVirtualRangeMetrics({
      virtualWindow: {
        rowStart: 24,
        rowEnd: 41,
        rowTotal: 240,
      },
      rowHeight: 36,
    })

    expect(metrics.virtualRange).toEqual({ start: 24, end: 41 })
    expect(metrics.rangeLabel).toBe("25-42")
    expect(metrics.spacerTopHeight).toBe(24 * 36)
    expect(metrics.spacerBottomHeight).toBe((240 - 42) * 36)
  })
})
