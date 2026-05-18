import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { AffinoChartLegend } from "../index"
import type { ChartLegendItem } from "../index"

const items: ChartLegendItem[] = [
  { id: "alpha", label: "Alpha", color: "#2563eb", value: "40%" },
  { id: "beta", label: "Beta", value: 12 },
]

function mockElementRect(element: Element, rect = { x: 10, y: 20, width: 30, height: 40 }): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => rect,
  })
}

describe("AffinoChartLegend", () => {
  it("renders items, values, and colors", () => {
    const wrapper = mount(AffinoChartLegend, {
      props: {
        items,
      },
    })
    const legendItems = wrapper.findAll(".affino-chart-legend__item")

    expect(legendItems).toHaveLength(2)
    expect(legendItems[0]?.text()).toContain("Alpha")
    expect(legendItems[0]?.text()).toContain("40%")
    expect(legendItems[0]?.find(".affino-chart-legend__swatch").attributes("style"))
      .toContain("rgb(37, 99, 235)")
    expect(legendItems[1]?.find(".affino-chart-legend__swatch").attributes("style"))
      .toContain("var(--affino-chart-series-2)")
  })

  it("emits interactive item click payload with anchorRect and clientPoint", async () => {
    const wrapper = mount(AffinoChartLegend, {
      props: {
        items,
        interactive: true,
      },
    })
    const firstItem = wrapper.find(".affino-chart-legend__item")
    mockElementRect(firstItem.element)

    await firstItem.trigger("click")

    const payload = wrapper.emitted("item-click")?.[0]?.[0]
    expect(payload).toMatchObject({
      item: items[0],
      index: 0,
      anchorRect: { x: 10, y: 20, width: 30, height: 40 },
      clientPoint: { x: 25, y: 40 },
    })
  })

  it("does not emit click when non-interactive", async () => {
    const wrapper = mount(AffinoChartLegend, {
      props: {
        items,
      },
    })

    await wrapper.find(".affino-chart-legend__item").trigger("click")

    expect(wrapper.emitted("item-click")).toBeUndefined()
  })
})
