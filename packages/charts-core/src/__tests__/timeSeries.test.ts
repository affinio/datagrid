import { describe, expect, it } from "vitest"
import {
  createTimeAxisTicks,
  createTimeSeriesChartGeometry,
  formatTimeAxisTick,
  resolveTimeSeriesTooltip,
  validateTimeSeries,
} from "../index"
import type { TimeSeries } from "../index"

const january = Date.UTC(2026, 0, 1)
const february = Date.UTC(2026, 1, 1)
const series: TimeSeries[] = [
  {
    id: "balance",
    label: "Balance",
    data: [{ time: january, value: 100 }, { time: february, value: 110 }],
  },
  {
    id: "equity",
    label: "Equity",
    data: [{ time: january, value: 98 }, { time: february, value: 114 }],
  },
]

describe("time-series public contracts", () => {
  it("creates shared-domain geometry for multiple series", () => {
    const geometry = createTimeSeriesChartGeometry({
      series,
      size: { width: 640, height: 360 },
      timeAxis: { format: (timestamp) => new Date(timestamp).toISOString().slice(0, 7) },
    })

    expect(geometry.series).toHaveLength(2)
    expect(geometry.series[0]?.linePath).toContain(" L ")
    expect(geometry.series[0]?.points[0]?.x).toBe(geometry.series[1]?.points[0]?.x)
    expect(geometry.timeTicks.every((tick) => /^2026-/.test(tick.label))).toBe(true)
  })

  it("supports negative area data and a zero baseline", () => {
    const geometry = createTimeSeriesChartGeometry({
      series: [{
        id: "drawdown",
        label: "Drawdown",
        presentation: { type: "area" },
        data: [{ time: january, value: 0 }, { time: february, value: -0.12 }],
      }],
      size: { width: 400, height: 240 },
      yAxis: { includeZero: true },
    })

    expect(geometry.valueDomain).toEqual({ min: -0.12, max: 0 })
    expect(geometry.zeroY).not.toBeNull()
    expect(geometry.series[0]?.areaPath).toContain(" Z")
  })

  it("returns every series value at the nearest shared timestamp", () => {
    expect(resolveTimeSeriesTooltip(series, january + 1_000)).toEqual({
      timestamp: january,
      entries: [
        { seriesId: "balance", seriesLabel: "Balance", value: 100 },
        { seriesId: "equity", seriesLabel: "Equity", value: 98 },
      ],
    })
  })

  it("uses responsive tick density and UTC formatting", () => {
    const narrow = createTimeAxisTicks({ min: january, max: Date.UTC(2028, 0, 1) }, { min: 0, max: 240 })
    const wide = createTimeAxisTicks({ min: january, max: Date.UTC(2028, 0, 1) }, { min: 0, max: 1_200 })

    expect(wide.length).toBeGreaterThan(narrow.length)
    expect(formatTimeAxisTick(Date.UTC(2026, 0, 1, 15, 30), {
      locale: "en-GB",
      formatOptions: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    }, 60_000)).toBe("15:30")
  })

  it("rejects non-finite, duplicate, and unsorted points without mutating input", () => {
    expect(() => validateTimeSeries([{ id: "x", label: "X", data: [{ time: january, value: Number.NaN }] }]))
      .toThrow("non-finite")
    expect(() => validateTimeSeries([{ id: "x", label: "X", data: [{ time: january, value: 1 }, { time: january, value: 2 }] }]))
      .toThrow("duplicate")
    expect(() => validateTimeSeries([{ id: "x", label: "X", data: [{ time: february, value: 1 }, { time: january, value: 2 }] }]))
      .toThrow("unsorted")
  })

  it("supports empty and single-point series without downsampling", () => {
    const empty = createTimeSeriesChartGeometry({ series: [], size: { width: 320, height: 200 } })
    const single = createTimeSeriesChartGeometry({
      series: [{ id: "one", label: "One", data: [{ time: january, value: 0.5 }] }],
      size: { width: 320, height: 200 },
    })

    expect(empty.series).toEqual([])
    expect(single.series[0]?.points).toHaveLength(1)
    expect(single.series[0]?.linePath).toMatch(/^M /)
  })
})
