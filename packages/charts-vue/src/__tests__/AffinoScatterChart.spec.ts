import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { AffinoScatterChart } from "../index"
import type { ChartDatum } from "@affino/charts-core"
import type { AffinoScatterChartPointEvent } from "../index"

const rows: ChartDatum[] = [
  { discount: 4, value: 120, lotCount: 6 },
  { discount: 12, value: 180, lotCount: 16 },
  { discount: 20, value: 140, lotCount: 10 },
]

function mountChart(props: Partial<InstanceType<typeof AffinoScatterChart>["$props"]> = {}) {
  return mount(AffinoScatterChart, {
    props: {
      rows,
      xField: "discount",
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

describe("AffinoScatterChart", () => {
  it("renders circles for valid rows", () => {
    const wrapper = mountChart()
    const points = wrapper.findAll(".affino-scatter-chart__point")

    expect(points).toHaveLength(3)
    expect(points[0]?.attributes("data-point-index")).toBe("0")
    expect(points[0]?.attributes("data-point-x-value")).toBe("4")
    expect(points[0]?.attributes("data-point-y-value")).toBe("120")
    expect(Number(points[0]?.attributes("r"))).toBeGreaterThan(0)
  })

  it("skips invalid x and y rows through core geometry", () => {
    const wrapper = mountChart({
      rows: [
        { discount: 4, value: 120 },
        { discount: null, value: 160 },
        { discount: 12, value: "bad" },
        { discount: 20, value: 140 },
      ],
    })

    const points = wrapper.findAll(".affino-scatter-chart__point")
    expect(points).toHaveLength(2)
    expect(points.map((point) => point.attributes("data-point-x-value"))).toEqual(["4", "20"])
  })

  it("supports radiusField for bubble radius", () => {
    const wrapper = mountChart({
      radiusField: "lotCount",
      minRadius: 4,
      maxRadius: 20,
    })

    const points = wrapper.findAll(".affino-scatter-chart__point")
    expect(points[0]?.attributes("data-point-radius-value")).toBe("6")
    expect(Number(points[0]?.attributes("r"))).toBe(4)
    expect(Number(points[1]?.attributes("r"))).toBe(20)
  })

  it("renders empty state when no valid rows exist", () => {
    const wrapper = mountChart({
      rows: [{ discount: null, value: null }],
      emptyText: "Nothing to chart",
    })

    expect(wrapper.find("[data-state='empty']").text()).toBe("Nothing to chart")
    expect(wrapper.findAll(".affino-scatter-chart__point")).toHaveLength(0)
  })

  it("emits point-click with item, anchorRect, and clientPoint", async () => {
    const wrapper = mountChart({
      radiusField: "lotCount",
    })
    const firstPoint = wrapper.find(".affino-scatter-chart__point")
    mockElementRect(firstPoint.element)

    await firstPoint.trigger("click")

    const payload = wrapper.emitted<AffinoScatterChartPointEvent[]>("point-click")?.[0]?.[0]
    expect(payload?.index).toBe(0)
    expect(payload?.xValue).toBe(4)
    expect(payload?.yValue).toBe(120)
    expect(payload?.radiusValue).toBe(6)
    expect(payload?.row).toEqual(rows[0])
    expect(payload?.item).toBe(payload?.point)
    expect(payload?.anchorRect).toEqual({ x: 10, y: 20, width: 30, height: 40 })
    expect(payload?.clientPoint).toEqual({ x: 25, y: 40 })
  })

  it("hides axes when showAxes is false", () => {
    const wrapper = mountChart({
      showAxes: false,
    })

    expect(wrapper.find(".affino-scatter-chart__axes").exists()).toBe(false)
  })

  it("hides grid when showGrid is false", () => {
    const wrapper = mountChart({
      showGrid: false,
    })

    expect(wrapper.find(".affino-scatter-chart__grid").exists()).toBe(false)
  })
})
