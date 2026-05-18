export type {
  WorldMapCountryFeature,
  WorldMapCountryId,
  WorldMapGeometry,
  WorldMapMultiPolygonGeometry,
  WorldMapPolygonGeometry,
  WorldMapPosition,
} from "./types"

export function createWorldMapCore(): { version: string } {
  return { version: "0.1.0" }
}
