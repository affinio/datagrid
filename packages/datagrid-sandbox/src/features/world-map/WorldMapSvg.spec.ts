// @vitest-environment jsdom

import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import WorldMapSvg from "./WorldMapSvg.vue"
import type { WorldMapPathFeature } from "@affino/world-map-core"

const paths: WorldMapPathFeature[] = [
  {
    id: "AA",
    name: "Country A",
    path: "M 0 0 L 100 100 Z",
  },
  {
    id: "BB",
    name: "Country B",
    path: "M 100 100 L 200 200 Z",
  },
]

function dispatchPointerLikeEvent(
  element: Element,
  type: string,
  init: Pick<PointerEvent, "button" | "clientX" | "clientY" | "pointerId">,
): void {
  const event = new Event(type, { bubbles: true, cancelable: true })
  for (const [key, value] of Object.entries(init)) {
    Object.defineProperty(event, key, { value })
  }
  element.dispatchEvent(event)
}

function latestSelectedEmission(wrapper: ReturnType<typeof mount>): unknown {
  const emissions = wrapper.emitted("update:selectedCountryId")
  return emissions === undefined ? undefined : emissions[emissions.length - 1]?.[0]
}

describe("WorldMapSvg", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("emits selection updates for country, selected country, background, and Escape", async () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        selectedCountryId: null,
      },
    })
    const firstPath = wrapper.find('[data-country-id="AA"]')

    await firstPath.trigger("click")
    expect(latestSelectedEmission(wrapper)).toBe("AA")
    await wrapper.setProps({ selectedCountryId: "AA" })

    await firstPath.trigger("click")
    expect(latestSelectedEmission(wrapper)).toBeNull()
    await wrapper.setProps({ selectedCountryId: "AA" })

    await wrapper.find(".world-map-svg__svg").trigger("click")
    expect(latestSelectedEmission(wrapper)).toBeNull()

    await wrapper.setProps({ selectedCountryId: "AA" })
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    await nextTick()
    expect(latestSelectedEmission(wrapper)).toBeNull()
  })

  it("resets view after zooming", async () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        width: 960,
        height: 480,
      },
    })
    const mapLayer = wrapper.find(".world-map-svg__map-layer")

    await wrapper.findAll("button").find((button) => button.text() === "Zoom in")?.trigger("click")
    await nextTick()
    expect(mapLayer.attributes("transform")).toBe("translate(-120 -60) scale(1.25)")

    await wrapper.findAll("button").find((button) => button.text() === "Reset view")?.trigger("click")
    await nextTick()
    expect(mapLayer.attributes("transform")).toBe("translate(0 0) scale(1)")
  })

  it("selects a country on short pointer interaction after zoom", async () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        selectedCountryId: null,
      },
    })
    const firstPath = wrapper.find('[data-country-id="AA"]')

    await wrapper.findAll("button").find((button) => button.text() === "Zoom in")?.trigger("click")
    dispatchPointerLikeEvent(firstPath.element, "pointerdown", {
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    })
    dispatchPointerLikeEvent(wrapper.find(".world-map-svg__svg").element, "pointerup", {
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    })
    await nextTick()

    expect(latestSelectedEmission(wrapper)).toBe("AA")
  })
})
