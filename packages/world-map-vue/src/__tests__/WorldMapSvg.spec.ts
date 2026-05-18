// @vitest-environment jsdom

import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import { WorldMapSvg } from "../index"
import type { WorldMapMarker } from "../index"
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

const markers: WorldMapMarker[] = [
  {
    id: "london",
    lon: -0.1276,
    lat: 51.5072,
    label: "London",
    variant: "success",
  },
  {
    id: "paris",
    lon: 2.3522,
    lat: 48.8566,
    label: "Paris",
    variant: "warning",
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

function selectedEmissionCount(wrapper: ReturnType<typeof mount>): number {
  return wrapper.emitted("update:selectedCountryId")?.length ?? 0
}

function latestSelectedMarkerEmission(wrapper: ReturnType<typeof mount>): unknown {
  const emissions = wrapper.emitted("update:selectedMarkerId")
  return emissions === undefined ? undefined : emissions[emissions.length - 1]?.[0]
}

function findButtonByText(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll("button").find((button) => button.text() === label)
}

describe("WorldMapSvg", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders countries and markers inside explicit svg layers", () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        markers,
      },
    })

    expect(wrapper.find(".world-map-svg__ocean-layer .world-map-svg__ocean").exists()).toBe(true)

    const viewportLayer = wrapper.find(".world-map-svg__viewport-layer")
    expect(viewportLayer.exists()).toBe(true)
    expect(viewportLayer.classes()).toContain("world-map-svg__map-layer")

    const countryLayer = wrapper.find(".world-map-svg__country-layer")
    expect(countryLayer.exists()).toBe(true)
    expect(countryLayer.classes()).toContain("world-map-svg__country-fill-layer")
    expect(countryLayer.findAll(".world-map-svg__country")).toHaveLength(2)

    expect(wrapper.find(".world-map-svg__country-border-layer").attributes("pointer-events")).toBe("none")
    expect(wrapper.find(".world-map-svg__track-layer").attributes("pointer-events")).toBe("none")
    expect(wrapper.find(".world-map-svg__overlay-layer").attributes("pointer-events")).toBe("none")
    expect(wrapper.find(".world-map-svg__label-layer").attributes("pointer-events")).toBe("none")

    const markerLayer = wrapper.find(".world-map-svg__marker-layer")
    expect(markerLayer.exists()).toBe(true)
    expect(markerLayer.findAll(".world-map-svg__marker")).toHaveLength(2)
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
    expect(selectedEmissionCount(wrapper)).toBe(1)
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

    const zoomOutButton = findButtonByText(wrapper, "Zoom out")
    const zoomInButton = findButtonByText(wrapper, "Zoom in")
    const resetButton = findButtonByText(wrapper, "Reset view")

    expect(zoomOutButton?.attributes("disabled")).toBeDefined()
    expect(resetButton?.attributes("disabled")).toBeDefined()

    await zoomInButton?.trigger("click")
    await nextTick()
    expect(mapLayer.attributes("transform")).toBe("translate(-120 -60) scale(1.25)")
    expect(zoomOutButton?.attributes("disabled")).toBeUndefined()
    expect(resetButton?.attributes("disabled")).toBeUndefined()

    await resetButton?.trigger("click")
    await nextTick()
    expect(mapLayer.attributes("transform")).toBe("translate(0 0) scale(1)")
    expect(resetButton?.attributes("disabled")).toBeDefined()
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

  it("does not select or clear selection after dragging from a selected country", async () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        selectedCountryId: "AA",
      },
    })
    const firstPath = wrapper.find('[data-country-id="AA"]')
    const svg = wrapper.find(".world-map-svg__svg")

    dispatchPointerLikeEvent(firstPath.element, "pointerdown", {
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    })
    dispatchPointerLikeEvent(svg.element, "pointermove", {
      button: 0,
      pointerId: 1,
      clientX: 140,
      clientY: 140,
    })
    dispatchPointerLikeEvent(svg.element, "pointerup", {
      button: 0,
      pointerId: 1,
      clientX: 140,
      clientY: 140,
    })
    await nextTick()

    expect(selectedEmissionCount(wrapper)).toBe(0)

    await svg.trigger("click")
    expect(selectedEmissionCount(wrapper)).toBe(0)
  })

  it("uses default cursor when panning is disabled", () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        enablePan: false,
      },
    })

    expect(wrapper.classes()).not.toContain("world-map-svg--pan-enabled")
  })

  it("renders projected markers when provided", () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        markers,
        width: 360,
        height: 180,
      },
    })

    const markerElements = wrapper.findAll(".world-map-svg__marker")
    expect(markerElements).toHaveLength(2)
    expect(markerElements[0]?.attributes("data-marker-id")).toBe("london")
    expect(markerElements[0]?.attributes("data-marker-variant")).toBe("success")
    expect(markerElements[0]?.classes()).toContain("world-map-svg__marker--variant-success")
    expect(markerElements[0]?.attributes("cx")).toBe("179.8724")
    expect(markerElements[0]?.attributes("cy")).toBe("38.4928")
  })

  it("does not render markers when marker rendering is disabled", () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        markers,
        enableMarkers: false,
      },
    })

    expect(wrapper.findAll(".world-map-svg__marker")).toHaveLength(0)
  })

  it("emits marker interaction events without clearing selected country", async () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        markers,
        selectedCountryId: "AA",
      },
    })
    const marker = wrapper.find('[data-marker-id="london"]')
    vi.spyOn(marker.element, "getBoundingClientRect").mockReturnValue({
      x: 10,
      y: 20,
      width: 8,
      height: 8,
      top: 20,
      right: 18,
      bottom: 28,
      left: 10,
      toJSON: () => ({}),
    } as DOMRect)

    await marker.trigger("mouseenter")
    const hoverPayload = wrapper.emitted("marker-hover")?.[0]?.[0]
    expect(hoverPayload?.marker).toEqual(markers[0])
    expect(hoverPayload?.clientPoint).toEqual({ x: 14, y: 24 })
    expect(hoverPayload?.anchorRect).toEqual({ x: 10, y: 20, width: 8, height: 8 })

    await marker.trigger("click")
    const clickPayload = wrapper.emitted("marker-click")?.[0]?.[0]
    expect(clickPayload?.marker).toEqual(markers[0])
    expect(clickPayload?.svgPoint.x).toBeCloseTo(479.65973333333336)
    expect(clickPayload?.svgPoint.y).toBeCloseTo(102.64746666666666)
    expect(clickPayload?.clientPoint).toEqual({ x: 14, y: 24 })
    expect(clickPayload?.anchorRect).toEqual({ x: 10, y: 20, width: 8, height: 8 })
    expect(wrapper.emitted("update:selectedCountryId")).toBeUndefined()
    expect(latestSelectedMarkerEmission(wrapper)).toBe("london")

    await marker.trigger("mouseleave")
    expect(wrapper.emitted("marker-leave")?.[0]?.[0]?.marker).toEqual(markers[0])
  })

  it("toggles selected marker and clears marker selection from background and Escape", async () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        markers,
        selectedMarkerId: null,
      },
    })
    const marker = wrapper.find('[data-marker-id="london"]')

    await marker.trigger("click")
    expect(latestSelectedMarkerEmission(wrapper)).toBe("london")
    await wrapper.setProps({ selectedMarkerId: "london" })

    await marker.trigger("click")
    expect(latestSelectedMarkerEmission(wrapper)).toBeNull()
    await wrapper.setProps({ selectedMarkerId: "london" })

    await wrapper.find(".world-map-svg__svg").trigger("click")
    expect(latestSelectedMarkerEmission(wrapper)).toBeNull()
    await wrapper.setProps({ selectedMarkerId: "london" })

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    await nextTick()
    expect(latestSelectedMarkerEmission(wrapper)).toBeNull()
  })

  it("marks selected markers with a selected class", () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        markers,
        selectedMarkerId: "london",
      },
    })

    expect(wrapper.find('[data-marker-id="london"]').classes()).toContain("world-map-svg__marker--selected")
  })

  it("keeps marker radius stable in screen scale mode while zooming", async () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        markers,
        markerRadius: 4,
        markerScaleMode: "screen",
      },
    })
    const marker = wrapper.find('[data-marker-id="london"]')

    expect(marker.attributes("r")).toBe("4")

    await findButtonByText(wrapper, "Zoom in")?.trigger("click")
    await nextTick()

    expect(marker.attributes("r")).toBe("3.2")
  })

  it("scales marker radius with the map in map scale mode", async () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        markers,
        markerRadius: 4,
        markerScaleMode: "map",
      },
    })
    const marker = wrapper.find('[data-marker-id="london"]')

    await findButtonByText(wrapper, "Zoom in")?.trigger("click")
    await nextTick()

    expect(marker.attributes("r")).toBe("4")
  })

  it("applies choropleth value fill only to countries with finite values", () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        enableChoropleth: true,
        countryValues: {
          AA: 10,
          BB: Number.NaN,
        },
      },
    })

    const firstPath = wrapper.find('[data-country-id="AA"]')
    const secondPath = wrapper.find('[data-country-id="BB"]')

    expect(firstPath.classes()).toContain("world-map-svg__country--valued")
    expect(firstPath.attributes("style")).toContain("--affino-world-map-country-value-fill")
    expect(secondPath.classes()).not.toContain("world-map-svg__country--valued")
    expect(secondPath.attributes("style")).toBeUndefined()
  })

  it("preserves normal styling when choropleth rendering is disabled", () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        enableChoropleth: false,
        countryValues: {
          AA: 10,
        },
      },
    })

    const firstPath = wrapper.find('[data-country-id="AA"]')
    expect(firstPath.classes()).not.toContain("world-map-svg__country--valued")
    expect(firstPath.attributes("style")).toBeUndefined()
  })

  it("keeps selected country state separate from choropleth fill", () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        selectedCountryId: "AA",
        enableChoropleth: true,
        countryValues: {
          AA: 10,
        },
      },
    })

    const firstPath = wrapper.find('[data-country-id="AA"]')
    expect(firstPath.classes()).toContain("world-map-svg__country--valued")
    expect(firstPath.classes()).toContain("world-map-svg__country--selected")
    expect(firstPath.attributes("style")).not.toMatch(/(^|;)\s*fill\s*:/)
  })

  it("uses a stable mid intensity when country value domain has matching min and max", () => {
    const wrapper = mount(WorldMapSvg, {
      props: {
        paths,
        enableChoropleth: true,
        countryValues: {
          AA: 5,
          BB: 5,
        },
      },
    })

    const firstPath = wrapper.find('[data-country-id="AA"]')
    expect(firstPath.attributes("style")).toContain("50%")
  })
})
