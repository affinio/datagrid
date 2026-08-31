import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import { AffinoTimeSeriesChart } from "../index"
import type { TimeSeries } from "@affino/charts-core"

const first = Date.UTC(2026, 0, 1)
const second = Date.UTC(2026, 0, 2)
const series: TimeSeries[] = [
  { id: "balance", label: "Balance", data: [{ time: first, value: 100 }, { time: second, value: 110 }] },
  { id: "equity", label: "Equity", data: [{ time: first, value: 98 }, { time: second, value: 112 }] },
]

afterEach(() => vi.unstubAllGlobals())

describe("AffinoTimeSeriesChart", () => {
  it("renders multiple series with one shared plot and legend", () => {
    const wrapper = mount(AffinoTimeSeriesChart, { props: { series, responsive: false } })

    expect(wrapper.findAll(".affino-time-series-chart__line")).toHaveLength(2)
    expect(wrapper.findAll(".affino-chart-legend__item")).toHaveLength(2)
    expect(wrapper.findAll("svg")).toHaveLength(1)
  })

  it("renders and emits a public all-series tooltip with configurable formatting", async () => {
    const wrapper = mount(AffinoTimeSeriesChart, {
      props: {
        series,
        responsive: false,
        tooltip: {
          formatTime: (timestamp) => new Date(timestamp).toISOString().slice(0, 10),
          formatValue: (value) => `$${value.toFixed(2)}`,
        },
      },
    })
    const interaction = wrapper.find(".affino-time-series-chart__interaction")
    Object.defineProperty(interaction.element, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, width: 100, top: 0, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }),
    })

    await interaction.trigger("mousemove", { clientX: 0 })

    expect(wrapper.findAll(".affino-time-series-chart__tooltip-entry")).toHaveLength(2)
    expect(wrapper.find(".affino-time-series-chart__tooltip").text()).toContain("2026-01-01")
    expect(wrapper.find(".affino-time-series-chart__tooltip").text()).toContain("$100.00")
    expect(wrapper.emitted("tooltip-change")?.[0]?.[0]).toMatchObject({
      timestamp: first,
      entries: [{ seriesId: "balance", value: 100 }, { seriesId: "equity", value: 98 }],
    })
  })

  it("supports keyboard tooltip focus and a public crosshair", async () => {
    const wrapper = mount(AffinoTimeSeriesChart, { props: { series, responsive: false } })
    const interaction = wrapper.find(".affino-time-series-chart__interaction")

    await interaction.trigger("focus")
    expect(wrapper.find(".affino-time-series-chart__crosshair").exists()).toBe(true)
    await interaction.trigger("keydown", { key: "End" })
    expect(wrapper.emitted("tooltip-change")?.at(-1)?.[0]).toMatchObject({ timestamp: second })
  })

  it("toggles series visibility through the native legend", async () => {
    const wrapper = mount(AffinoTimeSeriesChart, { props: { series, responsive: false } })

    await wrapper.find(".affino-chart-legend__item").trigger("click")

    expect(wrapper.findAll(".affino-time-series-chart__line")).toHaveLength(1)
    expect(wrapper.emitted("series-visibility-change")?.[0]?.[0]).toEqual({ seriesId: "balance", visible: false })
  })

  it("reacts to data and theme changes without recreating canonical data", async () => {
    const wrapper = mount(AffinoTimeSeriesChart, { props: { series, responsive: false, theme: "light" } })
    const initialPath = wrapper.find("[data-series-id='balance']").attributes("d")

    await wrapper.setProps({
      series: [{ ...series[0]!, data: [{ time: first, value: 100 }, { time: second, value: 130 }] }, series[1]!],
      theme: { mode: "dark", background: "#010203", seriesColors: ["#abcdef"] },
    })

    expect(wrapper.find("[data-series-id='balance']").attributes("d")).not.toBe(initialPath)
    expect(wrapper.classes()).toContain("affino-chart-theme--dark")
    expect(wrapper.attributes("style")).toContain("--affino-chart-background: #010203")
    expect(series[0]?.data[1]?.value).toBe(110)
  })

  it("owns responsive width updates through ResizeObserver", async () => {
    class ResizeObserverMock {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void {
        this.callback([{ contentRect: { width: 480 } } as ResizeObserverEntry], this as unknown as ResizeObserver)
      }
      disconnect(): void {}
      unobserve(): void {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock)

    const wrapper = mount(AffinoTimeSeriesChart, { props: { series } })
    await nextTick()

    expect(wrapper.find("svg").attributes("width")).toBe("480")
  })
})
