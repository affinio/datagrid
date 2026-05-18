import { describe, expect, it } from "vitest"
import {
  createWorldMapPath,
  createWorldMapPaths,
  createWorldMapCore,
  projectWorldMapPosition,
} from "@affino/world-map-core"
import type {
  CreateWorldMapPathOptions,
  ProjectWorldMapPositionOptions,
  WorldMapCountryFeature,
  WorldMapCountryId,
  WorldMapGeometry,
  WorldMapPathFeature,
  WorldMapPosition,
} from "@affino/world-map-core"

describe("world-map-core", () => {
  it("creates a versioned core instance", () => {
    expect(createWorldMapCore()).toEqual({ version: "0.1.0" })
  })

  it("exports public world map types from the package entrypoint", () => {
    const id: WorldMapCountryId = "US"
    const position: WorldMapPosition = { lon: -77.0365, lat: 38.8977 }
    const geometry: WorldMapGeometry = {
      type: "Polygon",
      coordinates: [[position]],
    }

    expect(id).toBe("US")
    expect(geometry.coordinates[0]?.[0]).toEqual(position)
  })

  it("type-checks a sample country feature", () => {
    const feature: WorldMapCountryFeature = {
      id: "CA",
      name: "Canada",
      iso2: "CA",
      iso3: "CAN",
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              { lon: -123.1207, lat: 49.2827 },
              { lon: -79.3832, lat: 43.6532 },
              { lon: -73.5673, lat: 45.5017 },
            ],
          ],
        ],
      },
      properties: {
        region: "North America",
      },
    }

    expect(feature.geometry.type).toBe("MultiPolygon")
    expect(feature.properties?.region).toBe("North America")
  })

  it("projects the center point with equirectangular projection", () => {
    expect(projectWorldMapPosition(
      { lon: 0, lat: 0 },
      { viewport: { width: 360, height: 180 }, projection: "equirectangular" },
    )).toEqual({ x: 180, y: 90 })
  })

  it("projects top-left world bounds with equirectangular projection", () => {
    expect(projectWorldMapPosition(
      { lon: -180, lat: 90 },
      { viewport: { width: 360, height: 180 }, projection: "equirectangular" },
    )).toEqual({ x: 0, y: 0 })
  })

  it("projects bottom-right world bounds with equirectangular projection", () => {
    expect(projectWorldMapPosition(
      { lon: 180, lat: -90 },
      { viewport: { width: 360, height: 180 }, projection: "equirectangular" },
    )).toEqual({ x: 360, y: 180 })
  })

  it("defaults to equirectangular projection", () => {
    expect(projectWorldMapPosition(
      { lon: 0, lat: 0 },
      { viewport: { width: 1024, height: 512 } },
    )).toEqual({ x: 512, y: 256 })
  })

  it("does not mutate input position or options", () => {
    const position = Object.freeze({ lon: 45, lat: -45 })
    const options: ProjectWorldMapPositionOptions = Object.freeze({
      viewport: Object.freeze({ width: 720, height: 360 }),
      projection: "equirectangular",
    })

    expect(projectWorldMapPosition(position, options)).toEqual({ x: 450, y: 270 })
    expect(position).toEqual({ lon: 45, lat: -45 })
    expect(options).toEqual({
      viewport: { width: 720, height: 360 },
      projection: "equirectangular",
    })
  })

  it("creates SVG path data for polygon geometry", () => {
    const feature: WorldMapCountryFeature = {
      id: "polygon",
      name: "Polygon",
      geometry: {
        type: "Polygon",
        coordinates: [[
          { lon: -180, lat: 90 },
          { lon: 0, lat: 0 },
          { lon: 180, lat: -90 },
        ]],
      },
    }

    expect(createWorldMapPath(feature, {
      viewport: { width: 360, height: 180 },
    }).path).toBe("M 0 0 L 180 90 L 360 180 Z")
  })

  it("creates SVG path data for multipolygon geometry", () => {
    const feature: WorldMapCountryFeature = {
      id: "multipolygon",
      name: "MultiPolygon",
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [[
            { lon: -180, lat: 90 },
            { lon: 0, lat: 0 },
          ]],
          [[
            { lon: 0, lat: 0 },
            { lon: 180, lat: -90 },
          ]],
        ],
      },
    }

    expect(createWorldMapPath(feature, {
      viewport: { width: 360, height: 180 },
    }).path).toBe("M 0 0 L 180 90 Z M 180 90 L 360 180 Z")
  })

  it("rounds projected path coordinates to the requested precision", () => {
    const feature: WorldMapCountryFeature = {
      id: "precision",
      name: "Precision",
      geometry: {
        type: "Polygon",
        coordinates: [[{ lon: 1, lat: 1 }]],
      },
    }

    expect(createWorldMapPath(feature, {
      viewport: { width: 100, height: 100 },
      precision: 2,
    }).path).toBe("M 50.28 49.44 Z")

    expect(createWorldMapPath(feature, {
      viewport: { width: 100, height: 100 },
      precision: 0,
    }).path).toBe("M 50 49 Z")
  })

  it("skips empty rings", () => {
    const feature: WorldMapCountryFeature = {
      id: "empty",
      name: "Empty",
      geometry: {
        type: "Polygon",
        coordinates: [
          [],
          [{ lon: 0, lat: 0 }],
        ],
      },
    }

    expect(createWorldMapPath(feature, {
      viewport: { width: 360, height: 180 },
    }).path).toBe("M 180 90 Z")

    expect(createWorldMapPath({
      ...feature,
      geometry: {
        type: "Polygon",
        coordinates: [[]],
      },
    }, {
      viewport: { width: 360, height: 180 },
    }).path).toBe("")
  })

  it("preserves feature metadata on path features", () => {
    const properties = { region: "Europe" }
    const feature: WorldMapCountryFeature = {
      id: "FR",
      name: "France",
      iso2: "FR",
      iso3: "FRA",
      properties,
      geometry: {
        type: "Polygon",
        coordinates: [[{ lon: 0, lat: 0 }]],
      },
    }

    const pathFeature: WorldMapPathFeature = createWorldMapPath(feature, {
      viewport: { width: 360, height: 180 },
    })

    expect(pathFeature).toEqual({
      id: "FR",
      name: "France",
      iso2: "FR",
      iso3: "FRA",
      path: "M 180 90 Z",
      properties,
    })
  })

  it("does not mutate input features or path options", () => {
    const feature: WorldMapCountryFeature = {
      id: "immutable",
      name: "Immutable",
      geometry: {
        type: "Polygon",
        coordinates: [[{ lon: 0, lat: 0 }]],
      },
      properties: { stable: true },
    }
    const options: CreateWorldMapPathOptions = {
      viewport: { width: 360, height: 180 },
      projection: "equirectangular",
      precision: 0,
    }

    expect(createWorldMapPath(feature, options).path).toBe("M 180 90 Z")
    expect(feature).toEqual({
      id: "immutable",
      name: "Immutable",
      geometry: {
        type: "Polygon",
        coordinates: [[{ lon: 0, lat: 0 }]],
      },
      properties: { stable: true },
    })
    expect(options).toEqual({
      viewport: { width: 360, height: 180 },
      projection: "equirectangular",
      precision: 0,
    })
  })

  it("unwraps and copies a ring when adjacent points jump across the antimeridian", () => {
    const feature: WorldMapCountryFeature = {
      id: "seam",
      name: "Seam",
      geometry: {
        type: "Polygon",
        coordinates: [[
          { lon: 179, lat: 10 },
          { lon: -179, lat: 10 },
          { lon: -178, lat: 9 },
        ]],
      },
    }

    expect(createWorldMapPath(feature, {
      viewport: { width: 360, height: 180 },
      precision: 0,
    }).path).toBe("M -1 80 L 1 80 L 2 81 Z M 359 80 L 361 80 L 362 81 Z")
  })

  it("keeps antimeridian-crossing ring segments local to the map edge", () => {
    const feature: WorldMapCountryFeature = {
      id: "seam-regression",
      name: "Seam Regression",
      geometry: {
        type: "Polygon",
        coordinates: [[
          { lon: 170, lat: 10 },
          { lon: -170, lat: 10 },
          { lon: -160, lat: 0 },
        ]],
      },
    }

    expect(createWorldMapPath(feature, {
      viewport: { width: 360, height: 180 },
      precision: 0,
    }).path).toBe("M -10 80 L 10 80 L 20 90 Z M 350 80 L 370 80 L 380 90 Z")
  })

  it("does not create a filled diagonal closing segment across the map edge", () => {
    const feature: WorldMapCountryFeature = {
      id: "seam-filled-diagonal",
      name: "Seam Filled Diagonal",
      geometry: {
        type: "Polygon",
        coordinates: [[
          { lon: 170, lat: 20 },
          { lon: -170, lat: 20 },
          { lon: -160, lat: 10 },
          { lon: 170, lat: 20 },
        ]],
      },
    }

    expect(createWorldMapPath(feature, {
      viewport: { width: 360, height: 180 },
      precision: 0,
    }).path).toBe("M -10 70 L 10 70 L 20 80 L -10 70 Z M 350 70 L 370 70 L 380 80 L 350 70 Z")
  })

  it("does not duplicate large antimeridian-crossing mainland rings at the opposite edge", () => {
    const feature: WorldMapCountryFeature = {
      id: "mainland-seam",
      name: "Mainland Seam",
      geometry: {
        type: "Polygon",
        coordinates: [[
          { lon: 25, lat: 70 },
          { lon: 170, lat: 70 },
          { lon: -170, lat: 60 },
          { lon: -160, lat: 50 },
          { lon: 25, lat: 70 },
        ]],
      },
    }

    expect(createWorldMapPath(feature, {
      viewport: { width: 360, height: 180 },
      precision: 0,
    }).path).toBe("M 205 20 L 350 20 L 370 30 L 380 40 L 205 20 Z")
  })

  it("can preserve antimeridian-crossing line commands when antimeridian strategy is none", () => {
    const feature: WorldMapCountryFeature = {
      id: "seam-none",
      name: "Seam None",
      geometry: {
        type: "Polygon",
        coordinates: [[
          { lon: 170, lat: 10 },
          { lon: -170, lat: 10 },
          { lon: -160, lat: 0 },
        ]],
      },
    }

    expect(createWorldMapPath(feature, {
      viewport: { width: 360, height: 180 },
      precision: 0,
      antimeridianStrategy: "none",
    }).path).toBe("M 350 80 L 10 80 L 20 90 Z")
  })

  it("keeps normal adjacent projected points connected with line commands", () => {
    const feature: WorldMapCountryFeature = {
      id: "adjacent",
      name: "Adjacent",
      geometry: {
        type: "Polygon",
        coordinates: [[
          { lon: 10, lat: 10 },
          { lon: 20, lat: 10 },
          { lon: 30, lat: 9 },
        ]],
      },
    }

    expect(createWorldMapPath(feature, {
      viewport: { width: 360, height: 180 },
      precision: 0,
    }).path).toBe("M 190 80 L 200 80 L 210 81 Z")
  })

  it("creates path features in input order", () => {
    const features: WorldMapCountryFeature[] = [
      {
        id: "first",
        name: "First",
        geometry: {
          type: "Polygon",
          coordinates: [[{ lon: -180, lat: 90 }]],
        },
      },
      {
        id: "second",
        name: "Second",
        geometry: {
          type: "Polygon",
          coordinates: [[{ lon: 180, lat: -90 }]],
        },
      },
    ]

    expect(createWorldMapPaths(features, {
      viewport: { width: 360, height: 180 },
    }).map((feature) => feature.id)).toEqual(["first", "second"])
  })
})
