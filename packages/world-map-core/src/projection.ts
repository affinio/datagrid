import type {
  ProjectWorldMapPositionOptions,
  WorldMapPosition,
  WorldMapScreenPoint,
} from "./types"

export function projectWorldMapPosition(
  position: WorldMapPosition,
  options: ProjectWorldMapPositionOptions,
): WorldMapScreenPoint {
  const projection = options.projection ?? "equirectangular"

  switch (projection) {
    case "equirectangular":
      return {
        x: ((position.lon + 180) / 360) * options.viewport.width,
        y: ((90 - position.lat) / 180) * options.viewport.height,
      }
  }
}
