import { describe, expect, it, vi } from "vitest"
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

  it("uses constant-time math when there are no row height overrides", () => {
    const resolveRowHeightOverride = vi.fn(() => null)

    const metrics = createDataGridAppRowHeightMetrics({
      totalRows: () => 200000,
      resolveBaseRowHeight: () => 31,
      resolveRowHeightOverride,
      resolveRowHeightVersion: () => 0,
      hasRowHeightOverrides: () => false,
    })

    expect(metrics.resolveRowHeight(123)).toBe(31)
    expect(metrics.resolveRowOffset(1000)).toBe(31000)
    expect(metrics.resolveRowIndexAtOffset(31000)).toBe(1000)
    expect(metrics.resolveViewportRange(31000, 310, 2)).toEqual({
      start: 998,
      end: 1011,
    })
    expect(metrics.resolveTotalHeight()).toBe(6200000)
    expect(resolveRowHeightOverride).not.toHaveBeenCalled()
  })

  it("applies sparse row-height mutations without rescanning every row when snapshots are available", () => {
    let version = 1
    let lastMutation = null as {
      version: number
      kind: "set" | "clear" | "clear-all"
      rowIndex: number | null
      previousHeight: number | null
      nextHeight: number | null
    } | null
    const overrides = new Map<number, number>([
      [1, 60],
      [3, 45],
    ])
    const resolveRowHeightOverride = vi.fn((rowIndex: number) => overrides.get(rowIndex) ?? null)

    const metrics = createDataGridAppRowHeightMetrics({
      totalRows: () => 200000,
      resolveBaseRowHeight: () => 30,
      resolveRowHeightOverride,
      resolveRowHeightVersion: () => version,
      hasRowHeightOverrides: () => overrides.size > 0,
      resolveRowHeightOverridesSnapshot: () => overrides,
      resolveLastRowHeightMutation: () => lastMutation,
    })

    expect(metrics.resolveRowOffset(4)).toBe(165)
    expect(metrics.resolveViewportRange(85, 70, 1)).toEqual({
      start: 0,
      end: 4,
    })
    expect(resolveRowHeightOverride).not.toHaveBeenCalled()

    const previousHeight = overrides.get(1) ?? null
    overrides.set(1, 90)
    version = 2
    lastMutation = {
      version,
      kind: "set",
      rowIndex: 1,
      previousHeight,
      nextHeight: 90,
    }

    expect(metrics.resolveRowHeight(1)).toBe(90)
    expect(metrics.resolveRowOffset(2)).toBe(120)
    expect(metrics.resolveTotalHeight()).toBe((200000 * 30) + 75)
    expect(resolveRowHeightOverride).not.toHaveBeenCalled()
  })
})
