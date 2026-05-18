import { afterEach, describe, expect, it, vi } from "vitest"
import {
  geoJsonFeatureToWorldMapCountryFeature,
  geoJsonFeaturesToWorldMapCountryFeatures,
  geoJsonGeometryToWorldMapGeometry,
  loadNormalizedWorldCountries110m,
} from "./loadWorldCountries"

describe("world map country adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("converts GeoJSON polygon geometry to world map geometry", () => {
    expect(geoJsonGeometryToWorldMapGeometry({
      type: "Polygon",
      coordinates: [[
        [-180, 90],
        [0, 0],
        [180, -90],
      ]],
    })).toEqual({
      type: "Polygon",
      coordinates: [[
        { lon: -180, lat: 90 },
        { lon: 0, lat: 0 },
        { lon: 180, lat: -90 },
      ]],
    })
  })

  it("converts GeoJSON multipolygon geometry to world map geometry", () => {
    expect(geoJsonGeometryToWorldMapGeometry({
      type: "MultiPolygon",
      coordinates: [
        [[[-10, 10], [0, 0]]],
        [[[10, -10], [20, -20]]],
      ],
    })).toEqual({
      type: "MultiPolygon",
      coordinates: [
        [[{ lon: -10, lat: 10 }, { lon: 0, lat: 0 }]],
        [[{ lon: 10, lat: -10 }, { lon: 20, lat: -20 }]],
      ],
    })
  })

  it("skips unsupported and empty geometries safely", () => {
    expect(geoJsonGeometryToWorldMapGeometry({
      type: "Point",
      coordinates: [0, 0],
    } as never)).toBeNull()

    expect(geoJsonGeometryToWorldMapGeometry({
      type: "Polygon",
      coordinates: [[]],
    })).toBeNull()
  })

  it("maps id, name, iso fields, and properties by best effort", () => {
    const properties = {
      name: "France",
      iso_a2: "FR",
      adm0_a3: "FRA",
      region_un: "Europe",
    }

    expect(geoJsonFeatureToWorldMapCountryFeature({
      id: undefined,
      properties,
      geometry: {
        type: "Polygon",
        coordinates: [[[2, 46]]],
      },
    }, 3)).toEqual({
      id: "France",
      name: "France",
      iso2: "FR",
      iso3: "FRA",
      geometry: {
        type: "Polygon",
        coordinates: [[{ lon: 2, lat: 46 }]],
      },
      properties,
    })
  })

  it("falls back to feature id and feature index for identifiers", () => {
    expect(geoJsonFeatureToWorldMapCountryFeature({
      id: 840,
      properties: null,
      geometry: {
        type: "Polygon",
        coordinates: [[[-100, 40]]],
      },
    }, 7)?.id).toBe("840")

    expect(geoJsonFeatureToWorldMapCountryFeature({
      properties: null,
      geometry: {
        type: "Polygon",
        coordinates: [[[-100, 40]]],
      },
    }, 7)?.id).toBe("7")
  })

  it("preserves feature order and skips unsupported features", () => {
    expect(geoJsonFeaturesToWorldMapCountryFeatures({
      type: "FeatureCollection",
      features: [
        {
          properties: { name: "First" },
          geometry: {
            type: "Polygon",
            coordinates: [[[0, 0]]],
          },
        },
        {
          properties: { name: "Unsupported" },
          geometry: {
            type: "Point",
            coordinates: [0, 0],
          },
        },
        {
          properties: { name: "Second" },
          geometry: {
            type: "Polygon",
            coordinates: [[[1, 1]]],
          },
        },
      ],
    }).map((feature) => feature.name)).toEqual(["First", "Second"])
  })

  it("loads normalized world countries from the sandbox map asset", async () => {
    const countries = [{
      id: "US",
      name: "United States",
      geometry: {
        type: "Polygon",
        coordinates: [[{ lon: -100, lat: 40 }]],
      },
    }]
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => countries,
    })) as unknown as typeof fetch
    vi.stubGlobal("fetch", fetchMock)

    await expect(loadNormalizedWorldCountries110m()).resolves.toBe(countries)
    expect(fetchMock).toHaveBeenCalledWith("/maps/world-countries-110m.normalized.json")
  })
})
