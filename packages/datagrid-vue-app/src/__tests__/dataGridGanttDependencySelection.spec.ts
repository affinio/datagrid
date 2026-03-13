import { describe, expect, it } from "vitest"
import {
  DATAGRID_GANTT_DEPENDENCY_HIT_SLOP_PX,
  hitTestDataGridGanttDependencyPath,
  resolveDataGridGanttDependencyPathKey,
} from "../dataGridGanttDependencySelection"

describe("dataGridGanttDependencySelection", () => {
  const path = {
    dependencyTaskId: "task-a",
    dependencyType: "FS",
    sourceBar: { rowId: "row-a" },
    targetBar: { rowId: "row-b" },
    points: [
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 40, y: 30 },
      { x: 80, y: 30 },
    ],
  }

  it("builds a stable dependency selection key", () => {
    expect(resolveDataGridGanttDependencyPathKey(path as never)).toBe("task-a::FS::row-a::row-b")
  })

  it("hits a dependency polyline within the configured slop", () => {
    expect(
      hitTestDataGridGanttDependencyPath([path] as never, { x: 42, y: 14 }),
    ).toBe(path)
  })

  it("returns null when the pointer is outside the hit slop", () => {
    expect(
      hitTestDataGridGanttDependencyPath(
        [path] as never,
        { x: 42, y: 14 + DATAGRID_GANTT_DEPENDENCY_HIT_SLOP_PX + 4 },
      ),
    ).toBeNull()
  })
})
