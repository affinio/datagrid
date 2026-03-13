import { describe, expect, it } from "vitest"
import type { DataGridRowNode } from "@affino/datagrid-core"
import {
  applyDataGridGanttDragDelta,
  buildDataGridGanttDependencyPaths,
  buildDataGridGanttRowEditPatch,
  buildDataGridGanttVisibleBars,
  hitTestDataGridGanttBar,
  normalizeDataGridGanttOptions,
  resolveDataGridGanttRangeFrame,
  resolveDataGridGanttTimelineState,
} from "../index"

interface DemoRow {
  id: string
  task: string
  start: Date
  end: Date
  progress: number
  dependencies?: string[]
}

function buildRow(rowId: string, row: DemoRow): DataGridRowNode<DemoRow> {
  return {
    rowId,
    row,
  } as unknown as DataGridRowNode<DemoRow>
}

describe("datagrid-gantt runtime", () => {
  it("normalizes gantt options with readable defaults", () => {
    expect(normalizeDataGridGanttOptions(true)).toMatchObject({
      startKey: "start",
      endKey: "end",
      progressKey: "progress",
      dependencyKey: "dependencies",
      paneWidth: 520,
      pixelsPerDay: 24,
      zoomLevel: "day",
    })

    expect(normalizeDataGridGanttOptions({
      zoomLevel: "week",
      paneWidth: 640,
      pixelsPerDay: 10,
    })).toMatchObject({
      zoomLevel: "week",
      paneWidth: 640,
      pixelsPerDay: 10,
    })
  })

  it("derives timeline bounds from the current row model when explicit bounds are absent", () => {
    const options = normalizeDataGridGanttOptions(true)
    expect(options).toBeTruthy()

    const rows = [
      buildRow("task-a", {
        id: "task-a",
        task: "Task A",
        start: new Date("2026-03-10T00:00:00.000Z"),
        end: new Date("2026-03-15T00:00:00.000Z"),
        progress: 0.25,
      }),
      buildRow("task-b", {
        id: "task-b",
        task: "Task B",
        start: new Date("2026-03-04T00:00:00.000Z"),
        end: new Date("2026-03-20T00:00:00.000Z"),
        progress: 0.5,
      }),
    ]

    const timeline = resolveDataGridGanttTimelineState({
      getCount: () => rows.length,
      get: index => rows[index],
    }, options!)

    expect(new Date(timeline.startMs).toISOString()).toBe("2026-03-04T00:00:00.000Z")
    expect(new Date(timeline.endMs).toISOString()).toBe("2026-03-20T00:00:00.000Z")
    expect(timeline.totalWidth).toBeGreaterThan(0)
  })

  it("builds visible bars from rendered rows only and aligns them to scroll offset", () => {
    const options = normalizeDataGridGanttOptions({
      rowBarHeight: 16,
      minBarWidth: 4,
    })
    expect(options).toBeTruthy()

    const rows = [
      buildRow("task-a", {
        id: "task-a",
        task: "Task A",
        start: new Date("2026-03-10T00:00:00.000Z"),
        end: new Date("2026-03-12T00:00:00.000Z"),
        progress: 0.4,
      }),
      buildRow("task-b", {
        id: "task-b",
        task: "Task B",
        start: new Date("2026-03-11T00:00:00.000Z"),
        end: new Date("2026-03-15T00:00:00.000Z"),
        progress: 0.6,
        dependencies: ["task-a"],
      }),
    ]

    const timeline = resolveDataGridGanttTimelineState({
      getCount: () => rows.length,
      get: index => rows[index],
    }, options!)

    const bars = buildDataGridGanttVisibleBars({
      rows,
      viewportRowStart: 40,
      scrollTop: 124,
      topSpacerHeight: 120,
      viewportHeight: 120,
      baseRowHeight: 32,
      resolveRowHeight: () => 32,
      timeline,
      options: options!,
    })

    expect(bars).toHaveLength(2)
    expect(Math.round(bars[0]!.y)).toBe(4)
    expect(bars[1]!.dependencies).toEqual(["task-a"])
    expect(bars[1]!.x).toBeGreaterThan(bars[0]!.x)
  })

  it("builds dependency paths from visible bars without requiring DOM nodes", () => {
    const options = normalizeDataGridGanttOptions(true)!
    const timeline = resolveDataGridGanttTimelineState({
      getCount: () => 2,
      get: index => index === 0
        ? buildRow("task-a", {
            id: "task-a",
            task: "Task A",
            start: new Date("2026-03-10T00:00:00.000Z"),
            end: new Date("2026-03-12T00:00:00.000Z"),
            progress: 0.4,
          })
        : buildRow("task-b", {
            id: "task-b",
            task: "Task B",
            start: new Date("2026-03-13T00:00:00.000Z"),
            end: new Date("2026-03-15T00:00:00.000Z"),
            progress: 0.6,
            dependencies: ["task-a"],
          }),
    }, options)

    const bars = buildDataGridGanttVisibleBars({
      rows: [
        buildRow("task-a", {
          id: "task-a",
          task: "Task A",
          start: new Date("2026-03-10T00:00:00.000Z"),
          end: new Date("2026-03-12T00:00:00.000Z"),
          progress: 0.4,
        }),
        buildRow("task-b", {
          id: "task-b",
          task: "Task B",
          start: new Date("2026-03-13T00:00:00.000Z"),
          end: new Date("2026-03-15T00:00:00.000Z"),
          progress: 0.6,
          dependencies: ["task-a"],
        }),
      ],
      viewportRowStart: 0,
      scrollTop: 0,
      topSpacerHeight: 0,
      viewportHeight: 120,
      baseRowHeight: 32,
      resolveRowHeight: () => 32,
      timeline,
      options,
    })

    const paths = buildDataGridGanttDependencyPaths({
      bars,
      resolveFrame: bar => ({
        x: bar.x + 10,
        width: bar.width,
        y: bar.y,
        height: bar.height,
      }),
    })

    expect(paths).toHaveLength(1)
    expect(paths[0]!.dependencyTaskId).toBe("task-a")
    expect(paths[0]!.points).toHaveLength(4)
    expect(paths[0]!.points[0]!.x).toBeGreaterThan(bars[0]!.x)
  })

  it("resolves bar frames and row edit patches from drag ranges", () => {
    const timeline = {
      startMs: Date.parse("2026-03-01T00:00:00.000Z"),
      endMs: Date.parse("2026-03-31T00:00:00.000Z"),
      pixelsPerDay: 8,
      totalWidth: 240,
      zoomLevel: "week" as const,
    }

    expect(resolveDataGridGanttRangeFrame({
      startMs: Date.parse("2026-03-05T00:00:00.000Z"),
      endMs: Date.parse("2026-03-08T00:00:00.000Z"),
    }, timeline, 6)).toEqual({
      x: 32,
      width: 24,
    })

    const patch = buildDataGridGanttRowEditPatch("task-a", {
      startMs: Date.parse("2026-03-09T00:00:00.000Z"),
      endMs: Date.parse("2026-03-11T00:00:00.000Z"),
    }, {
      startKey: "start",
      endKey: "end",
    })

    expect(patch.rowId).toBe("task-a")
    expect(patch.data.start.toISOString()).toBe("2026-03-09T00:00:00.000Z")
    expect(patch.data.end.toISOString()).toBe("2026-03-11T00:00:00.000Z")
  })

  it("snaps drag deltas to whole-day move and resize semantics", () => {
    const range = {
      startMs: Date.parse("2026-03-10T00:00:00.000Z"),
      endMs: Date.parse("2026-03-14T00:00:00.000Z"),
    }

    expect(applyDataGridGanttDragDelta(range, "move", 2)).toEqual({
      startMs: Date.parse("2026-03-12T00:00:00.000Z"),
      endMs: Date.parse("2026-03-16T00:00:00.000Z"),
    })

    expect(applyDataGridGanttDragDelta(range, "resize-start", 5)).toEqual({
      startMs: Date.parse("2026-03-13T00:00:00.000Z"),
      endMs: Date.parse("2026-03-14T00:00:00.000Z"),
    })

    expect(applyDataGridGanttDragDelta(range, "resize-end", -10)).toEqual({
      startMs: Date.parse("2026-03-10T00:00:00.000Z"),
      endMs: Date.parse("2026-03-11T00:00:00.000Z"),
    })
  })

  it("hit-tests move and resize handles without DOM task nodes", () => {
    const bars = [{
      row: buildRow("task-a", {
        id: "task-a",
        task: "Task A",
        start: new Date("2026-03-10T00:00:00.000Z"),
        end: new Date("2026-03-12T00:00:00.000Z"),
        progress: 0.4,
      }),
      rowId: "task-a",
      rowUpdateId: "task-a",
      taskId: "task-a",
      rowIndex: 0,
      label: "Task A",
      dependencies: [],
      critical: false,
      progress: 0.4,
      startMs: Date.parse("2026-03-10T00:00:00.000Z"),
      endMs: Date.parse("2026-03-12T00:00:00.000Z"),
      x: 100,
      width: 48,
      y: 20,
      height: 16,
    }] as const

    expect(hitTestDataGridGanttBar(bars, { x: 102, y: 28 }, 8)?.mode).toBe("resize-start")
    expect(hitTestDataGridGanttBar(bars, { x: 146, y: 28 }, 8)?.mode).toBe("resize-end")
    expect(hitTestDataGridGanttBar(bars, { x: 124, y: 28 }, 8)?.mode).toBe("move")
    expect(hitTestDataGridGanttBar(bars, { x: 20, y: 20 }, 8)).toBeNull()
  })
})
