import { describe, expect, it } from "vitest"
import { createHlocChartGeometry, validateHlocData, validateHlocMarkers } from "../index"
import type { HlocMarker, HlocPoint, TimeSeries } from "../index"

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

  it("uses the candle scales for overlay series and marker coordinates", () => {
    const overlay: TimeSeries = {
      id: "indicator",
      label: "Indicator",
      data: [
        { time: data[0]!.time, value: data[0]!.close },
        { time: data[1]!.time, value: 20 },
        { time: data[1]!.time + 1, value: 999 },
      ],
    }
    const geometry = createHlocChartGeometry({
      data,
      overlays: [overlay],
      markers: [{ id: "signal", label: "Signal", time: data[0]!.time + 12 * 60 * 60 * 1_000, value: 20 }],
      size: { width: 640, height: 360 },
    })

    expect(geometry.overlays[0]?.points[0]?.x).toBe(geometry.points[0]?.x)
    expect(geometry.overlays[0]?.points[0]?.y).toBe(geometry.points[0]?.closeY)
    expect(geometry.overlays[0]?.points).toHaveLength(2)
    expect(geometry.overlays[0]?.points[1]?.x).toBeGreaterThan(geometry.points[0]?.x ?? 0)
    expect(geometry.overlays[0]?.points[1]?.x).toBeLessThanOrEqual(geometry.points[1]?.x ?? 0)
    expect(geometry.markers[0]?.x).toBeGreaterThan(geometry.points[0]?.x ?? 0)
    expect(geometry.markers[0]?.x).toBeLessThan(geometry.points[1]?.x ?? Infinity)
    expect(geometry.valueDomain).toEqual({ min: 8, max: 20 })
    expect(geometry.markers[0]?.y).toBe(geometry.overlays[0]?.points[1]?.y)
  })

  it("reuses the same plot area after resize and margin changes", () => {
    const first = createHlocChartGeometry({ data, size: { width: 640, height: 360 }, margin: { left: 40, right: 20 } })
    const resized = createHlocChartGeometry({ data, size: { width: 1_280, height: 720 }, margin: { left: 80, right: 40 } })
    const overlay: TimeSeries = { id: "x", label: "X", data: [{ time: data[0]!.time, value: 12 }] }
    const withOverlay = createHlocChartGeometry({ data, overlays: [overlay], size: { width: 1_280, height: 720 }, margin: { left: 80, right: 40 } })

    expect(resized.points[0]?.x).toBe(withOverlay.overlays[0]?.points[0]?.x)
    expect(resized.points[0]?.closeY).toBe(withOverlay.overlays[0]?.points[0]?.y)
    expect(resized.plotArea).toEqual({ x: 80, y: 16, width: 1_160, height: 672 })
    expect(resized.points[0]?.x).not.toBe(first.points[0]?.x)
  })

  it("keeps empty overlays and markers from changing HLOC geometry", () => {
    const base = createHlocChartGeometry({ data, size: { width: 640, height: 360 } })
    const empty = createHlocChartGeometry({ data, overlays: [], markers: [], size: { width: 640, height: 360 } })
    expect(empty).toEqual(base)
  })

  it("validates overlay and marker inputs while preserving supplied order", () => {
    const overlays: TimeSeries[] = [
      { id: "b", label: "B", data: [] },
      { id: "a", label: "A", data: [] },
    ]
    const markers: HlocMarker[] = [
      { id: "second", label: "Second", time: data[1]!.time, value: 11 },
      { id: "first", label: "First", time: data[0]!.time, value: 10 },
    ]
    const geometry = createHlocChartGeometry({ data, overlays, markers, size: { width: 640, height: 360 } })
    expect(geometry.overlays.map((series) => series.id)).toEqual(["b", "a"])
    expect(geometry.markers.map((marker) => marker.id)).toEqual(["second", "first"])
    expect(() => createHlocChartGeometry({ data, overlays: [{ id: "x", label: "X", data: [{ time: data[0]!.time, value: Number.NaN }] }], size: { width: 320, height: 200 } })).toThrow("non-finite")
    expect(() => createHlocChartGeometry({ data, overlays: [{ id: "x", label: "X", data: [{ time: data[1]!.time, value: 1 }, { time: data[0]!.time, value: 2 }] }], size: { width: 320, height: 200 } })).toThrow("unsorted")
    expect(() => validateHlocMarkers([{ id: "same", label: "A", time: 1, value: 1 }, { id: "same", label: "B", time: 2, value: 2 }])).toThrow("Duplicate")
    expect(() => validateHlocMarkers([{ id: "bad", label: "", time: 1, value: 1 }])).toThrow("label")
  })
})
