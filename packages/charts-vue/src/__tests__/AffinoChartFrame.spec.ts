import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { AffinoChartFrame } from "../index"

describe("AffinoChartFrame", () => {
  it("renders an SVG with the default size", () => {
    const wrapper = mount(AffinoChartFrame)
    const svg = wrapper.find("svg")

    expect(svg.attributes("width")).toBe("640")
    expect(svg.attributes("height")).toBe("360")
    expect(svg.attributes("viewBox")).toBe("0 0 640 360")
  })

  it("applies custom width and height to the SVG viewBox", () => {
    const wrapper = mount(AffinoChartFrame, {
      props: {
        width: 320,
        height: 180,
      },
    })

    expect(wrapper.find("svg").attributes("viewBox")).toBe("0 0 320 180")
  })

  it("renders title and description", () => {
    const wrapper = mount(AffinoChartFrame, {
      props: {
        title: "Revenue",
        description: "Monthly revenue trend",
      },
    })

    expect(wrapper.find(".affino-chart-frame__title").text()).toBe("Revenue")
    expect(wrapper.find(".affino-chart-frame__description").text()).toBe("Monthly revenue trend")
    expect(wrapper.find("title").text()).toBe("Revenue")
    expect(wrapper.find("desc").text()).toBe("Monthly revenue trend")
  })

  it("uses ariaLabel for the SVG accessible label", () => {
    const wrapper = mount(AffinoChartFrame, {
      props: {
        ariaLabel: "Revenue chart",
        title: "Revenue",
      },
    })

    const svg = wrapper.find("svg")
    expect(svg.attributes("aria-label")).toBe("Revenue chart")
    expect(svg.attributes("aria-labelledby")).toBeUndefined()
  })

  it("renders empty, loading, and error states", () => {
    const emptyWrapper = mount(AffinoChartFrame, {
      props: {
        empty: true,
      },
    })
    const loadingWrapper = mount(AffinoChartFrame, {
      props: {
        loading: true,
      },
    })
    const errorWrapper = mount(AffinoChartFrame, {
      props: {
        error: "Could not load chart",
      },
    })

    expect(emptyWrapper.find("[data-state='empty']").text()).toBe("No chart data")
    expect(loadingWrapper.find("[data-state='loading']").text()).toBe("Loading chart")
    expect(errorWrapper.find("[data-state='error']").text()).toBe("Could not load chart")
    expect(errorWrapper.find("[data-state='error']").attributes("role")).toBe("alert")
  })

  it("renders default slot content inside the SVG", () => {
    const wrapper = mount(AffinoChartFrame, {
      slots: {
        default: "<circle data-test-id=\"series-point\" cx=\"16\" cy=\"24\" r=\"4\" />",
      },
    })

    expect(wrapper.find("svg [data-test-id='series-point']").exists()).toBe(true)
  })
})
