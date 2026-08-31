import { describe, expect, it } from "vitest"
import {
  createTimeSeriesTooltipResolver,
  resolveNearestTimeSeriesTimestamp,
} from "../index"
import type { TimeSeries } from "../index"

const t0 = Date.UTC(2026, 0, 1, 10, 0)
const t1 = Date.UTC(2026, 0, 1, 10, 5)
const t2 = Date.UTC(2026, 0, 1, 10, 10)

describe("time-series interaction contracts", () => {
  it("resolves exact, before, after, and between timestamps with earlier tie breaking", () => {
    const timestamps = [t0, t1, t2]
    expect(resolveNearestTimeSeriesTimestamp(timestamps, t1)).toBe(t1)
    expect(resolveNearestTimeSeriesTimestamp(timestamps, t0 - 1)).toBe(t0)
    expect(resolveNearestTimeSeriesTimestamp(timestamps, t2 + 1)).toBe(t2)
    expect(resolveNearestTimeSeriesTimestamp(timestamps, t1 + (t2 - t1) / 2)).toBe(t1)
  })

  it("uses actual irregular domain distances rather than index spacing", () => {
    const irregular = [t0, t0 + 60_000, t0 + 17 * 60_000, t0 + 100 * 60_000]
    expect(resolveNearestTimeSeriesTimestamp(irregular, t0 + 10 * 60_000)).toBe(t0 + 17 * 60_000)
  })

  it("resolves a shared visible domain once and omits missing exact series values", () => {
    const series: TimeSeries[] = [
      {
        id: "balance",
        label: "Balance",
        data: [{ time: t0, value: 100 }, { time: t2, value: 120 }],
      },
      {
        id: "equity",
        label: "Equity",
        data: [{ time: t1, value: 98 }, { time: t2, value: 118 }],
      },
      {
        id: "hidden",
        label: "Hidden",
        visible: false,
        data: [{ time: t0, value: 1 }],
      },
    ]
    const resolver = createTimeSeriesTooltipResolver(series)

    expect(resolver.timestamps).toEqual([t0, t1, t2])
    expect(resolver.resolve(t1)).toEqual({
      timestamp: t1,
      entries: [{ seriesId: "equity", seriesLabel: "Equity", value: 98 }],
    })
    expect(resolver.resolve(t2)?.entries).toHaveLength(2)
  })

  it("rejects duplicate X values before interaction can become ambiguous", () => {
    expect(() => createTimeSeriesTooltipResolver([{
      id: "duplicate",
      label: "Duplicate",
      data: [{ time: t0, value: 1 }, { time: t0, value: 2 }],
    }])).toThrow("duplicate")
  })
})
