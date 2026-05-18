import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { AffinoBarChart } from "../index"
import type { ChartDatum } from "@affino/charts-core"
import type { AffinoBarChartBarEvent } from "../index"

const rows: ChartDatum[] = [
  { category: "Alpha", value: 10 },
  { category: "Beta", value: 24 },
  { category: "Gamma", value: 16 },
]

function mountChart(props: Partial<InstanceType<typeof AffinoBarChart>["$props"]> = {}) {
  return mount(AffinoBarChart, {
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

describe("AffinoBarChart", () => {
  it("renders bars for valid rows", () => {
    const wrapper = mountChart()
    const bars = wrapper.findAll(".affino-bar-chart__bar")

    expect(bars).toHaveLength(3)
    expect(bars[0]?.attributes("data-bar-category")).toBe("Alpha")
    expect(bars[1]?.attributes("data-bar-category")).toBe("Beta")
    expect(Number(bars[0]?.attributes("width"))).toBeGreaterThan(0)
    expect(Number(bars[0]?.attributes("height"))).toBeGreaterThan(0)
  })

  it("renders empty state when no valid rows exist", () => {
    const wrapper = mountChart({
      rows: [{ category: "Alpha", value: null }],
      emptyText: "Nothing to chart",
    })

    expect(wrapper.find("[data-state='empty']").text()).toBe("Nothing to chart")
    expect(wrapper.findAll(".affino-bar-chart__bar")).toHaveLength(0)
  })

  it("emits bar-click with the expected payload", async () => {
    const wrapper = mountChart()
    const firstBar = wrapper.find(".affino-bar-chart__bar")
    mockElementRect(firstBar.element)

    await firstBar.trigger("click")

    const payload = wrapper.emitted<AffinoBarChartBarEvent[]>("bar-click")?.[0]?.[0]
    expect(payload?.index).toBe(0)
    expect(payload?.category).toBe("Alpha")
    expect(payload?.value).toBe(10)
    expect(payload?.row).toEqual(rows[0])
    expect(payload?.item).toBe(payload?.bar)
    expect(payload?.bar.category).toBe("Alpha")
    expect(payload?.anchorRect).toEqual({ x: 10, y: 20, width: 30, height: 40 })
    expect(payload?.clientPoint).toEqual({ x: 25, y: 40 })
  })

  it("respects maxBars", () => {
    const wrapper = mountChart({
      maxBars: 2,
    })

    expect(wrapper.findAll(".affino-bar-chart__bar")).toHaveLength(2)
  })

  it("hides axes when showAxes is false", () => {
    const wrapper = mountChart({
      showAxes: false,
    })

    expect(wrapper.find(".affino-bar-chart__axes").exists()).toBe(false)
  })

  it("hides grid when showGrid is false", () => {
    const wrapper = mountChart({
      showGrid: false,
    })

    expect(wrapper.find(".affino-bar-chart__grid").exists()).toBe(false)
  })
})
