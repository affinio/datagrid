import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { AffinoMetricCard } from "../index"
import type { MetricModel } from "@affino/charts-core"

describe("AffinoMetricCard", () => {
  it("renders formatted value and label", () => {
    const wrapper = mount(AffinoMetricCard, {
      props: {
        label: "Revenue",
        value: 1234.5,
        format: "currency",
        currency: "GBP",
        precision: 2,
      },
    })

    expect(wrapper.find(".affino-metric-card__label").text()).toBe("Revenue")
    expect(wrapper.find(".affino-metric-card__value").text()).toBe("£1,234.50")
  })

  it("renders unit when provided", () => {
    const wrapper = mount(AffinoMetricCard, {
      props: {
        label: "Latency",
        value: 120,
        unit: "ms",
      },
    })

    expect(wrapper.find(".affino-metric-card__unit").text()).toBe("ms")
  })

  it("renders delta up, down, and flat when previousValue is provided", () => {
    const up = mount(AffinoMetricCard, {
      props: {
        label: "Revenue",
        value: 120,
        previousValue: 100,
      },
    })
    const down = mount(AffinoMetricCard, {
      props: {
        label: "Revenue",
        value: 80,
        previousValue: 100,
      },
    })
    const flat = mount(AffinoMetricCard, {
      props: {
        label: "Revenue",
        value: 100,
        previousValue: 100,
      },
    })

    expect(up.find(".affino-metric-card__delta--up").text()).toContain("20 (20%)")
    expect(down.find(".affino-metric-card__delta--down").text()).toContain("20 (20%)")
    expect(flat.find(".affino-metric-card__delta--flat").text()).toContain("0 (0%)")
  })

  it("renders sub-unit delta values without rounding to zero", () => {
    const wrapper = mount(AffinoMetricCard, {
      props: {
        label: "Conversion",
        value: 0.128,
        previousValue: 0.119,
        format: "percent",
      },
    })

    expect(wrapper.find(".affino-metric-card__delta").text()).toContain("0.009")
  })

  it("hides delta when showDelta is false", () => {
    const wrapper = mount(AffinoMetricCard, {
      props: {
        label: "Revenue",
        value: 120,
        previousValue: 100,
        showDelta: false,
      },
    })

    expect(wrapper.find(".affino-metric-card__delta").exists()).toBe(false)
  })

  it("renders sparkline when trend exists and showTrend is true", () => {
    const wrapper = mount(AffinoMetricCard, {
      props: {
        label: "Revenue",
        value: 120,
        trend: [1, 2, 3],
      },
    })

    expect(wrapper.find(".affino-metric-card__sparkline").exists()).toBe(true)
    expect(wrapper.find("polyline").attributes("points")).toContain(",")
  })

  it("hides sparkline when showTrend is false", () => {
    const wrapper = mount(AffinoMetricCard, {
      props: {
        label: "Revenue",
        value: 120,
        trend: [1, 2, 3],
        showTrend: false,
      },
    })

    expect(wrapper.find(".affino-metric-card__sparkline").exists()).toBe(false)
  })

  it("emits metric-click with the metric model", async () => {
    const wrapper = mount(AffinoMetricCard, {
      props: {
        label: "Revenue",
        value: 120,
      },
    })

    await wrapper.trigger("click")

    const payload = wrapper.emitted<{ model: MetricModel }[]>("metric-click")?.[0]?.[0]
    expect(payload?.model.label).toBe("Revenue")
    expect(payload?.model.displayValue).toBe("120")
  })
})
