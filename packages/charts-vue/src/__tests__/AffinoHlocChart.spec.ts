import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { AffinoHlocChart } from "../index"
import { createHlocChartGeometry } from "@affino/charts-core"
import type { HlocPoint, TimeSeries } from "@affino/charts-core"

const data: HlocPoint[] = [
  { time: Date.UTC(2026, 0, 1), open: 10, high: 14, low: 8, close: 12 },
  { time: Date.UTC(2026, 0, 2), open: 12, high: 13, low: 9, close: 11 },
]

describe("AffinoHlocChart", () => {
  it("renders one vertical range and two directional ticks per datum", () => {
    const wrapper = mount(AffinoHlocChart, { props: { data } })
    expect(wrapper.findAll(".affino-hloc-chart__point")).toHaveLength(2)
    expect(wrapper.findAll(".affino-hloc-chart__range")).toHaveLength(2)
    expect(wrapper.findAll(".affino-hloc-chart__open")).toHaveLength(2)
    expect(wrapper.findAll(".affino-hloc-chart__close")).toHaveLength(2)
    expect(wrapper.find(".affino-hloc-chart__point--up").exists()).toBe(true)
    expect(wrapper.find(".affino-hloc-chart__point--down").exists()).toBe(true)
  })

  it("renders the public empty state and respects axes/grid options", () => {
    const wrapper = mount(AffinoHlocChart, {
      props: { data: [], emptyText: "Nothing to chart", showAxes: false, showGrid: false },
    })
    expect(wrapper.find("[data-state='empty']").text()).toBe("Nothing to chart")
    expect(wrapper.find(".affino-hloc-chart__axes").exists()).toBe(false)
    expect(wrapper.find(".affino-hloc-chart__grid").exists()).toBe(false)
  })

  it("renders public overlay series and markers from shared HLOC geometry", () => {
    const overlays: TimeSeries[] = [{
      id: "indicator",
      label: "Indicator",
      data: data.map((point) => ({ time: point.time, value: point.close })),
    }]
    const markers = [{ id: "entry", label: "Entry", time: data[0]!.time, value: data[0]!.close }]
    const wrapper = mount(AffinoHlocChart, {
      props: {
        data,
        overlays,
        markers,
      },
    })
    const expected = createHlocChartGeometry({ data, overlays, markers, size: { width: 640, height: 360 } })

    expect(wrapper.findAll(".affino-hloc-chart__overlay-line")).toHaveLength(1)
    expect(wrapper.findAll(".affino-hloc-chart__marker")).toHaveLength(1)
    expect(wrapper.find(".affino-hloc-chart__overlay-line").attributes("d")).toBe(expected.overlays[0]?.linePath)
    expect(wrapper.find(".affino-hloc-chart__marker").attributes("cx")).toBe(String(expected.markers[0]?.x))
    expect(wrapper.find("[data-series-id='indicator']").attributes("aria-label")).toBe("Indicator overlay")
    expect(wrapper.find("[data-marker-id='entry']").attributes("aria-label")).toContain("Entry")
  })
})
