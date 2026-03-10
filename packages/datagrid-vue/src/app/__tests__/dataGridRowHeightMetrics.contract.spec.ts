import { describe, expect, it } from "vitest"
import { createDataGridAppRowHeightMetrics } from "../dataGridRowHeightMetrics"

describe("createDataGridAppRowHeightMetrics contract", () => {
  it("builds offsets and viewport ranges using per-row overrides", () => {
    let version = 0
    const overrides = new Map<number, number>([
      [1, 60],
      [3, 45],
    ])

    const metrics = createDataGridAppRowHeightMetrics({
      totalRows: () => 5,
      resolveBaseRowHeight: () => 30,
      resolveRowHeightOverride: rowIndex => overrides.get(rowIndex) ?? null,
      resolveRowHeightVersion: () => version,
    })

    expect(metrics.resolveRowHeight(0)).toBe(30)
    expect(metrics.resolveRowHeight(1)).toBe(60)
    expect(metrics.resolveRowOffset(0)).toBe(0)
    expect(metrics.resolveRowOffset(1)).toBe(30)
    expect(metrics.resolveRowOffset(2)).toBe(90)
    expect(metrics.resolveRowOffset(4)).toBe(165)
    expect(metrics.resolveRowIndexAtOffset(0)).toBe(0)
    expect(metrics.resolveRowIndexAtOffset(29)).toBe(0)
    expect(metrics.resolveRowIndexAtOffset(30)).toBe(1)
    expect(metrics.resolveRowIndexAtOffset(89)).toBe(1)
    expect(metrics.resolveRowIndexAtOffset(90)).toBe(2)
    expect(metrics.resolveRowIndexAtOffset(164)).toBe(3)
    expect(metrics.resolveRowIndexAtOffset(165)).toBe(4)
    expect(metrics.resolveViewportRange(85, 70, 1)).toEqual({
      start: 0,
      end: 4,
    })
    expect(metrics.resolveTotalHeight()).toBe(195)

    overrides.set(1, 90)
    version += 1

    expect(metrics.resolveRowHeight(1)).toBe(90)
    expect(metrics.resolveRowOffset(2)).toBe(120)
    expect(metrics.resolveTotalHeight()).toBe(225)
  })
})
