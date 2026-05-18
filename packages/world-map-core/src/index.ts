export type {
  CreateWorldMapPathOptions,
  ProjectWorldMapPositionOptions,
  WorldMapCountryFeature,
  WorldMapCountryId,
  WorldMapGeometry,
  WorldMapMultiPolygonGeometry,
  WorldMapPathFeature,
  WorldMapPolygonGeometry,
  WorldMapPosition,
  WorldMapProjectionType,
  WorldMapScreenPoint,
  WorldMapViewport,
} from "./types"
export { createWorldMapPath, createWorldMapPaths } from "./path"
export { projectWorldMapPosition } from "./projection"

export function createWorldMapCore(): { version: string } {
  return { version: "0.1.0" }
}
