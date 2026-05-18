import { describe, expect, it } from "vitest"
import {
  createWorldMapCore,
  projectWorldMapPosition,
} from "@affino/world-map-core"
import type {
  ProjectWorldMapPositionOptions,
  WorldMapCountryFeature,
  WorldMapCountryId,
  WorldMapGeometry,
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
})
