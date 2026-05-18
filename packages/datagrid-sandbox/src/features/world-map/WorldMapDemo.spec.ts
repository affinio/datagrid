// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import WorldMapDemo from "./WorldMapDemo.vue"
import type { WorldMapCountryFeature } from "@affino/world-map-core"

async function flushUi(): Promise<void> {
  await nextTick()
  await Promise.resolve()
  await flushPromises()
  await nextTick()
}

function findButtonByText(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll("button").find((button) => button.text() === label)
}

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

describe("WorldMapDemo", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders loaded country paths and updates hover and selection debug state", async () => {
    const countries: WorldMapCountryFeature[] = [
      {
        id: "AA",
        name: "Country A",
        geometry: {
          type: "Polygon",
          coordinates: [[
            { lon: -180, lat: 90 },
            { lon: 0, lat: 0 },
            { lon: 180, lat: -90 },
          ]],
        },
      },
      {
        id: "010",
        name: "Antarctica",
        iso3: "ATA",
        geometry: {
          type: "Polygon",
          coordinates: [[
            { lon: -180, lat: -90 },
            { lon: 180, lat: -90 },
          ]],
        },
      },
      {
        id: "BB",
        name: "Country B",
        geometry: {
          type: "Polygon",
          coordinates: [[
            { lon: -90, lat: 45 },
            { lon: -80, lat: 40 },
          ]],
        },
      },
    ]
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => countries,
    })) as unknown as typeof fetch
    vi.stubGlobal("fetch", fetchMock)

    const wrapper = mount(WorldMapDemo)
    await flushUi()

    const paths = wrapper.findAll(".world-map-svg__country")
    const firstPath = wrapper.find('[data-country-id="AA"]')
    const secondPath = wrapper.find('[data-country-id="BB"]')
    const mapLayer = wrapper.find(".world-map-svg__map-layer")

    expect(firstPath.exists()).toBe(true)
    expect(paths).toHaveLength(2)
    expect(firstPath.attributes("d")).toBe("M 0 0 L 480 240 L 960 480 Z")
    expect(mapLayer.attributes("transform")).toBe("translate(0 0) scale(1)")
    expect(wrapper.text()).toContain("Zoom")
    expect(wrapper.text()).toContain("1.00")
    expect(wrapper.text()).toContain("Pan")
    expect(wrapper.text()).toContain("0, 0")
    expect(wrapper.findAll(".world-map-svg__marker")).toHaveLength(3)

    await wrapper.find('[data-marker-id="london"]').trigger("click")
    await nextTick()
    expect(wrapper.text()).toContain("Marker")
    expect(wrapper.text()).toContain("London (london)")
    expect(wrapper.find(".world-map-demo__geo-tag").text()).toContain("Geo tag")
    expect(wrapper.find(".world-map-demo__geo-tag").text()).toContain("London")

    await findButtonByText(wrapper, "Zoom in")?.trigger("click")
    await nextTick()
    expect(mapLayer.attributes("transform")).toBe("translate(-120 -60) scale(1.25)")
    expect(wrapper.text()).toContain("1.25")

    await findButtonByText(wrapper, "Zoom out")?.trigger("click")
    await nextTick()
    expect(mapLayer.attributes("transform")).toBe("translate(0 0) scale(1)")

    await findButtonByText(wrapper, "Zoom in")?.trigger("click")
    await findButtonByText(wrapper, "Reset view")?.trigger("click")
    await nextTick()
    expect(mapLayer.attributes("transform")).toBe("translate(0 0) scale(1)")

    await findButtonByText(wrapper, "Zoom in")?.trigger("click")
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
    expect(wrapper.text()).toContain("Selected")
    expect(wrapper.text()).toContain("Country A (AA)")

    await findButtonByText(wrapper, "Reset view")?.trigger("click")
    await nextTick()

    await firstPath.trigger("mouseenter")
    expect(wrapper.text()).toContain("Hovered")
    expect(wrapper.text()).toContain("Country A (AA)")

    await firstPath.trigger("click")
    expect(wrapper.text()).toContain("Selected")
    expect(wrapper.text()).toContain("Country A (AA)")

    await firstPath.trigger("click")
    expect(wrapper.text()).toContain("Selected")
    expect(wrapper.text()).toContain("none")

    await firstPath.trigger("click")
    await secondPath.trigger("click")
    expect(wrapper.text()).toContain("Country B (BB)")

    await wrapper.find(".world-map-svg__svg").trigger("click")
    expect(wrapper.text()).toContain("Selected")
    expect(wrapper.text()).toContain("none")

    await firstPath.trigger("click")
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    await nextTick()
    expect(wrapper.text()).toContain("Selected")
    expect(wrapper.text()).toContain("none")
  })
})
