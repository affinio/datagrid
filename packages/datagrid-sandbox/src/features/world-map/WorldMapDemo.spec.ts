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
    ]
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => countries,
    })) as unknown as typeof fetch
    vi.stubGlobal("fetch", fetchMock)

    const wrapper = mount(WorldMapDemo)
    await flushUi()

    const path = wrapper.find(".world-map-demo__country")
    expect(path.exists()).toBe(true)
    expect(wrapper.findAll(".world-map-demo__country")).toHaveLength(1)
    expect(path.attributes("d")).toBe("M 0 0 L 480 240 L 960 480 Z")

    await path.trigger("mouseenter")
    expect(wrapper.text()).toContain("Hovered")
    expect(wrapper.text()).toContain("Country A (AA)")

    await path.trigger("click")
    expect(wrapper.text()).toContain("Selected")
    expect(wrapper.text()).toContain("Country A (AA)")
  })
})
