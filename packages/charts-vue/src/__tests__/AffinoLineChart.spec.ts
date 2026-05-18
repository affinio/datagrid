import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { AffinoLineChart } from "../index"
import type { ChartDatum } from "@affino/charts-core"
import type { AffinoLineChartPointEvent } from "../index"

const rows: ChartDatum[] = [
  { label: "Jan", value: 10 },
  { label: "Feb", value: 24 },
  { label: "Mar", value: 16 },
]

function mountChart(props: Partial<InstanceType<typeof AffinoLineChart>["$props"]> = {}) {
  return mount(AffinoLineChart, {
    props: {
      rows,
      yField: "value",
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

describe("AffinoLineChart", () => {
  it("renders a line path for valid rows", () => {
    const wrapper = mountChart()
    const path = wrapper.find(".affino-line-chart__line")

    expect(path.exists()).toBe(true)
    expect(path.attributes("d")).toContain("M ")
    expect(path.attributes("d")).toContain(" L ")
  })

  it("renders point circles when showPoints is true", () => {
    const wrapper = mountChart()
    const points = wrapper.findAll(".affino-line-chart__point")

    expect(points).toHaveLength(3)
    expect(points[0]?.attributes("data-point-index")).toBe("0")
    expect(points[0]?.attributes("data-point-y-value")).toBe("10")
  })

  it("hides points when showPoints is false", () => {
    const wrapper = mountChart({
      showPoints: false,
    })

    expect(wrapper.findAll(".affino-line-chart__point")).toHaveLength(0)
    expect(wrapper.find(".affino-line-chart__line").exists()).toBe(true)
  })

  it("renders empty state when no valid rows exist", () => {
    const wrapper = mountChart({
      rows: [{ label: "Jan", value: null }],
      emptyText: "Nothing to chart",
    })

    expect(wrapper.find("[data-state='empty']").text()).toBe("Nothing to chart")
    expect(wrapper.find(".affino-line-chart__line").exists()).toBe(false)
  })

  it("emits point-click with the expected payload", async () => {
    const wrapper = mountChart()
    const firstPoint = wrapper.find(".affino-line-chart__point")
    mockElementRect(firstPoint.element)

    await firstPoint.trigger("click")

    const payload = wrapper.emitted<AffinoLineChartPointEvent[]>("point-click")?.[0]?.[0]
    expect(payload?.index).toBe(0)
    expect(payload?.xValue).toBe(0)
    expect(payload?.yValue).toBe(10)
    expect(payload?.row).toEqual(rows[0])
    expect(payload?.item).toBe(payload?.point)
    expect(payload?.point.yValue).toBe(10)
    expect(payload?.anchorRect).toEqual({ x: 10, y: 20, width: 30, height: 40 })
    expect(payload?.clientPoint).toEqual({ x: 25, y: 40 })
  })

  it("passes xScaleType number through to core geometry", () => {
    const wrapper = mountChart({
      rows: [
        { x: 10, y: 100 },
        { x: 20, y: 200 },
      ],
      xField: "x",
      yField: "y",
      xScaleType: "number",
      width: 100,
      height: 100,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
    })

    expect(wrapper.find(".affino-line-chart__line").attributes("d")).toBe("M 0 100 L 100 0")
    expect(wrapper.findAll(".affino-line-chart__point").map((point) => point.attributes("data-point-x-value")))
      .toEqual(["10", "20"])
  })

  it("hides axes when showAxes is false", () => {
    const wrapper = mountChart({
      showAxes: false,
    })

    expect(wrapper.find(".affino-line-chart__axes").exists()).toBe(false)
  })

  it("hides grid when showGrid is false", () => {
    const wrapper = mountChart({
      showGrid: false,
    })

    expect(wrapper.find(".affino-line-chart__grid").exists()).toBe(false)
  })
})
