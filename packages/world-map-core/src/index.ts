export type {
  ProjectWorldMapPositionOptions,
  WorldMapCountryFeature,
  WorldMapCountryId,
  WorldMapGeometry,
  WorldMapMultiPolygonGeometry,
  WorldMapPolygonGeometry,
  WorldMapPosition,
  WorldMapProjectionType,
  WorldMapScreenPoint,
  WorldMapViewport,
} from "./types"
export { projectWorldMapPosition } from "./projection"

export function createWorldMapCore(): { version: string } {
  return { version: "0.1.0" }
}
