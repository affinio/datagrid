import type { DataGridGanttDependencyPath } from "./dataGridGantt"

export const DATAGRID_GANTT_DEPENDENCY_HIT_SLOP_PX = 6

export function resolveDataGridGanttDependencyPathKey<TRow>(
  path: Pick<DataGridGanttDependencyPath<TRow>, "dependencyTaskId" | "dependencyType" | "sourceBar" | "targetBar">,
): string {
  return [
    path.dependencyTaskId,
    path.dependencyType,
    path.sourceBar.rowId,
    path.targetBar.rowId,
  ].join("::")
}

function resolveSquaredDistanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) {
    const distanceX = point.x - start.x
    const distanceY = point.y - start.y
    return (distanceX * distanceX) + (distanceY * distanceY)
  }
  const projection = (
    ((point.x - start.x) * dx) + ((point.y - start.y) * dy)
  ) / ((dx * dx) + (dy * dy))
  const clampedProjection = Math.max(0, Math.min(1, projection))
  const closestX = start.x + (dx * clampedProjection)
  const closestY = start.y + (dy * clampedProjection)
  const distanceX = point.x - closestX
  const distanceY = point.y - closestY
  return (distanceX * distanceX) + (distanceY * distanceY)
}

export function hitTestDataGridGanttDependencyPath<TRow>(
  paths: readonly DataGridGanttDependencyPath<TRow>[],
  point: { x: number; y: number },
  hitSlopPx: number = DATAGRID_GANTT_DEPENDENCY_HIT_SLOP_PX,
): DataGridGanttDependencyPath<TRow> | null {
  const maxDistanceSquared = Math.max(1, hitSlopPx) ** 2
  let bestPath: DataGridGanttDependencyPath<TRow> | null = null
  let bestDistanceSquared = Number.POSITIVE_INFINITY

  for (const path of paths) {
    for (let pointIndex = 1; pointIndex < path.points.length; pointIndex += 1) {
      const start = path.points[pointIndex - 1]
      const end = path.points[pointIndex]
      if (!start || !end) {
        continue
      }
      const distanceSquared = resolveSquaredDistanceToSegment(point, start, end)
      if (distanceSquared > maxDistanceSquared || distanceSquared >= bestDistanceSquared) {
        continue
      }
      bestDistanceSquared = distanceSquared
      bestPath = path
    }
  }

  return bestPath
}
