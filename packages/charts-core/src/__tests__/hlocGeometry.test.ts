import { describe, expect, it } from "vitest"
import { createHlocChartGeometry, validateHlocData } from "../index"
import type { HlocPoint } from "../index"

const data: HlocPoint[] = [
  { time: Date.UTC(2026, 0, 1), open: 10, high: 14, low: 8, close: 12 },
  { time: Date.UTC(2026, 0, 2), open: 12, high: 13, low: 9, close: 11 },
]

describe("HLOC geometry", () => {
  it("maps timestamps and OHLC values to range and tick geometry", () => {
    const geometry = createHlocChartGeometry({ data, size: { width: 640, height: 360 }, tickWidth: 5 })
    const first = geometry.points[0]

    expect(geometry.points).toHaveLength(2)
    expect(first?.direction).toBe("up")
    expect(first?.highY).toBeLessThan(first?.lowY ?? Infinity)
    expect(first?.openX).toBe((first?.x ?? 0) - 5)
    expect(first?.closeX).toBe((first?.x ?? 0) + 5)
    expect(geometry.valueDomain).toEqual({ min: 8, max: 14 })
    expect(geometry.timeTicks.length).toBeGreaterThan(0)
  })

  it("preserves flat direction and supports empty input", () => {
    const geometry = createHlocChartGeometry({
      data: [{ time: 1, open: 5, high: 5, low: 5, close: 5 }],
      size: { width: 320, height: 200 },
    })
    expect(geometry.points[0]?.direction).toBe("flat")
    expect(createHlocChartGeometry({ data: [], size: { width: 320, height: 200 } }).points).toEqual([])
  })

  it("rejects invalid ordering, values, and OHLC bounds", () => {
    expect(() => validateHlocData([{ ...data[0]!, high: 9 }])).toThrow("inconsistent")
    expect(() => validateHlocData([{ ...data[0]!, time: Number.NaN }])).toThrow("non-finite")
    expect(() => validateHlocData([data[1]!, data[0]!])).toThrow("unsorted")
  })
})
