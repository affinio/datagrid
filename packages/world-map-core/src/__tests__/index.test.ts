import { describe, expect, it } from "vitest"
import { createWorldMapCore } from "@affino/world-map-core"
import type {
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
})
