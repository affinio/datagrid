import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { AffinoHistogram } from "../index"
import type { ChartDatum } from "@affino/charts-core"
import type { AffinoHistogramBinEvent } from "../index"

const rows: ChartDatum[] = [
  { loadTimeMs: 120 },
  { loadTimeMs: 180 },
  { loadTimeMs: 220 },
  { loadTimeMs: 360 },
]

function mountHistogram(props: Partial<InstanceType<typeof AffinoHistogram>["$props"]> = {}) {
  return mount(AffinoHistogram, {
    props: {
      rows,
      valueField: "loadTimeMs",
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

describe("AffinoHistogram", () => {
  it("renders bins for valid rows", () => {
    const wrapper = mountHistogram({
      binCount: 4,
    })
    const bins = wrapper.findAll(".affino-histogram__bin")

    expect(bins).toHaveLength(4)
    expect(bins[0]?.attributes("data-bin-index")).toBe("0")
    expect(Number(bins[0]?.attributes("width"))).toBeGreaterThan(0)
  })

  it("renders empty state when no values are counted", () => {
    const wrapper = mountHistogram({
      rows: [{ loadTimeMs: null }],
      emptyText: "Nothing to chart",
    })

    expect(wrapper.find("[data-state='empty']").text()).toBe("Nothing to chart")
    expect(wrapper.findAll(".affino-histogram__bin")).toHaveLength(0)
  })

  it("supports binCount", () => {
    const wrapper = mountHistogram({
      binCount: 6,
    })

    expect(wrapper.findAll(".affino-histogram__bin")).toHaveLength(6)
  })

  it("supports valueMin and valueMax", () => {
    const wrapper = mountHistogram({
      binCount: 2,
      valueMin: 0,
      valueMax: 400,
    })
    const bins = wrapper.findAll(".affino-histogram__bin")

    expect(bins[0]?.attributes("data-bin-min")).toBe("0")
    expect(bins[0]?.attributes("data-bin-max")).toBe("200")
    expect(bins[1]?.attributes("data-bin-min")).toBe("200")
    expect(bins[1]?.attributes("data-bin-max")).toBe("400")
  })

  it("emits bin-click with item, anchorRect, and clientPoint", async () => {
    const wrapper = mountHistogram({
      binCount: 2,
      valueMin: 0,
      valueMax: 400,
    })
    const firstBin = wrapper.find(".affino-histogram__bin")
    mockElementRect(firstBin.element)

    await firstBin.trigger("click")

    const payload = wrapper.emitted<AffinoHistogramBinEvent[]>("bin-click")?.[0]?.[0]
    expect(payload?.index).toBe(0)
    expect(payload?.min).toBe(0)
    expect(payload?.max).toBe(200)
    expect(payload?.count).toBe(2)
    expect(payload?.values).toEqual([120, 180])
    expect(payload?.item).toBe(payload?.bin)
    expect(payload?.anchorRect).toEqual({ x: 10, y: 20, width: 30, height: 40 })
    expect(payload?.clientPoint).toEqual({ x: 25, y: 40 })
  })

  it("hides axes when showAxes is false", () => {
    const wrapper = mountHistogram({
      showAxes: false,
    })

    expect(wrapper.find(".affino-histogram__axes").exists()).toBe(false)
  })

  it("hides grid when showGrid is false", () => {
    const wrapper = mountHistogram({
      showGrid: false,
    })

    expect(wrapper.find(".affino-histogram__grid").exists()).toBe(false)
  })
})
