import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { AffinoPieChart } from "../index"
import type { ChartDatum } from "@affino/charts-core"
import type { AffinoPieChartSliceEvent } from "../index"

const rows: ChartDatum[] = [
  { category: "Alpha", value: 10 },
  { category: "Beta", value: 30 },
  { category: "Gamma", value: 20 },
]

function mountChart(props: Partial<InstanceType<typeof AffinoPieChart>["$props"]> = {}) {
  return mount(AffinoPieChart, {
    props: {
      rows,
      categoryField: "category",
      valueField: "value",
      ...props,
    },
  })
}

function mockElementRect(element: Element, rect = { x: 10, y: 20, width: 30, height: 40 }): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => rect,
  })
}

describe("AffinoPieChart", () => {
  it("renders slice paths for valid rows", () => {
    const wrapper = mountChart()
    const slices = wrapper.findAll(".affino-pie-chart__slice")

    expect(slices).toHaveLength(3)
    expect(slices[0]?.attributes("data-slice-category")).toBe("Alpha")
    expect(slices[0]?.attributes("d")).toContain("A")
  })

  it("renders empty state when no valid rows exist", () => {
    const wrapper = mountChart({
      rows: [{ category: "Alpha", value: null }],
      emptyText: "Nothing to chart",
    })

    expect(wrapper.find("[data-state='empty']").text()).toBe("Nothing to chart")
    expect(wrapper.findAll(".affino-pie-chart__slice")).toHaveLength(0)
  })

  it("renders donut paths when innerRadiusRatio is greater than zero", () => {
    const wrapper = mountChart({
      rows: [{ category: "Alpha", value: 10 }],
      width: 100,
      height: 100,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
      innerRadiusRatio: 0.5,
    })

    const path = wrapper.find(".affino-pie-chart__slice").attributes("d") ?? ""
    expect(path.match(/ A /g)?.length).toBe(4)
  })

  it("emits slice-click with the expected payload", async () => {
    const wrapper = mountChart()
    const firstSlice = wrapper.find(".affino-pie-chart__slice")
    mockElementRect(firstSlice.element)

    await firstSlice.trigger("click")

    const payload = wrapper.emitted<AffinoPieChartSliceEvent[]>("slice-click")?.[0]?.[0]
    expect(payload?.index).toBe(0)
    expect(payload?.category).toBe("Alpha")
    expect(payload?.value).toBe(10)
    expect(payload?.percentage).toBeCloseTo(10 / 60)
    expect(payload?.row).toEqual(rows[0])
    expect(payload?.item).toBe(payload?.slice)
    expect(payload?.slice.category).toBe("Alpha")
    expect(payload?.anchorRect).toEqual({ x: 10, y: 20, width: 30, height: 40 })
    expect(payload?.clientPoint).toEqual({ x: 25, y: 40 })
  })

  it("renders legend when showLegend is true", () => {
    const wrapper = mountChart()

    expect(wrapper.find(".affino-chart-legend").exists()).toBe(true)
    expect(wrapper.findAll(".affino-chart-legend__item")).toHaveLength(3)
  })

  it("hides legend when showLegend is false", () => {
    const wrapper = mountChart({
      showLegend: false,
    })

    expect(wrapper.find(".affino-chart-legend").exists()).toBe(false)
  })

  it("skips invalid, zero, and negative values through core geometry behavior", () => {
    const wrapper = mountChart({
      rows: [
        { category: "Alpha", value: 10 },
        { category: "Beta", value: 0 },
        { category: "Gamma", value: -5 },
        { category: "Delta", value: Number.NaN },
      ],
    })

    const slices = wrapper.findAll(".affino-pie-chart__slice")
    expect(slices).toHaveLength(1)
    expect(slices[0]?.attributes("data-slice-category")).toBe("Alpha")
  })
})
