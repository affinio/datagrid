import { describe, expect, it } from "vitest"
import type { DataGridRowNode } from "@affino/datagrid-core"
import {
  applyDataGridGanttDragDelta,
  buildDataGridGanttDependencyPaths,
  buildDataGridGanttRowEditPatch,
  buildDataGridGanttVisibleBars,
  clampDataGridGanttScrollLeft,
  hitTestDataGridGanttBar,
  normalizeDataGridGanttOptions,
  resolveDataGridWorkingCalendar,
  resolveDataGridGanttDateOffset,
  resolveDataGridGanttCriticalTaskIds,
  resolveDataGridGanttDependencyRefs,
  resolveDataGridGanttRangeFrame,
  resolveDataGridGanttSnapDays,
  resolveDataGridGanttScrollLeftForDate,
  resolveDataGridGanttTimelineState,
  snapDataGridGanttDateMs,
  snapDataGridGanttDayDelta,
} from "../index"

interface DemoRow {
  id: string
  task: string
  start: Date
  end: Date
  progress: number
  dependencies?: string[]
  baselineStart?: Date
  baselineEnd?: Date
  critical?: boolean
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
      baselineStartKey: null,
      baselineEndKey: null,
      progressKey: "progress",
      dependencyKey: "dependencies",
      computedCriticalPath: false,
      paneWidth: 520,
      pixelsPerDay: 24,
      rangePaddingDays: 0,
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

  it("applies configured range padding days when deriving timeline bounds", () => {
    const options = normalizeDataGridGanttOptions({
      rangePaddingDays: 2,
    })
    expect(options).toBeTruthy()

    const rows = [
      buildRow("task-a", {
        id: "task-a",
        task: "Task A",
        start: new Date("2026-03-10T12:00:00.000Z"),
        end: new Date("2026-03-12T18:00:00.000Z"),
        progress: 0.25,
      }),
    ]

    const timeline = resolveDataGridGanttTimelineState({
      getCount: () => rows.length,
      get: index => rows[index],
    }, options!)

    expect(new Date(timeline.startMs).toISOString()).toBe("2026-03-08T00:00:00.000Z")
    expect(new Date(timeline.endMs).toISOString()).toBe("2026-03-15T00:00:00.000Z")
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
    expect(bars[0]!.milestone).toBe(false)
    expect(bars[0]!.summary).toBe(false)
    expect(bars[0]!.baselineStartMs).toBeNull()
    expect(bars[0]!.criticalSource).toBeNull()
    expect(bars[1]!.dependencies).toEqual(["task-a"])
    expect(bars[1]!.dependencyRefs).toEqual([
      { taskId: "task-a", type: "FS", raw: "task-a" },
    ])
    expect(bars[1]!.x).toBeGreaterThan(bars[0]!.x)
  })

  it("parses typed dependency references with FS as the default", () => {
    expect(resolveDataGridGanttDependencyRefs("task-a, task-b:SS, 12FF")).toEqual([
      { taskId: "task-a", type: "FS", raw: "task-a" },
      { taskId: "task-b", type: "SS", raw: "task-b:SS" },
      { taskId: "12", type: "FF", raw: "12FF" },
    ])
  })

  it("renders same-day tasks as milestone layouts", () => {
    const options = normalizeDataGridGanttOptions({
      rowBarHeight: 16,
      minBarWidth: 4,
    })
    expect(options).toBeTruthy()

    const rows = [
      buildRow("milestone", {
        id: "milestone",
        task: "Launch",
        start: new Date("2026-03-10T00:00:00.000Z"),
        end: new Date("2026-03-10T00:00:00.000Z"),
        progress: 0,
      }),
    ]

    const timeline = resolveDataGridGanttTimelineState({
      getCount: () => rows.length,
      get: index => rows[index],
    }, options!)

    const bars = buildDataGridGanttVisibleBars({
      rows,
      viewportRowStart: 0,
      scrollTop: 0,
      topSpacerHeight: 0,
      viewportHeight: 60,
      baseRowHeight: 32,
      resolveRowHeight: () => 32,
      timeline,
      options: options!,
    })

    expect(bars).toHaveLength(1)
    expect(bars[0]!.milestone).toBe(true)
    expect(bars[0]!.summary).toBe(false)
    expect(bars[0]!.baselineStartMs).toBeNull()
    expect(bars[0]!.width).toBe(16)
  })

  it("reads baseline ranges directly from row cells", () => {
    const options = normalizeDataGridGanttOptions({
      baselineStartKey: "baselineStart",
      baselineEndKey: "baselineEnd",
    })
    expect(options).toBeTruthy()

    const rows = [
      buildRow("task-a", {
        id: "task-a",
        task: "Task A",
        start: new Date("2026-03-10T00:00:00.000Z"),
        end: new Date("2026-03-12T00:00:00.000Z"),
        progress: 0.4,
        baselineStart: new Date("2026-03-09T00:00:00.000Z"),
        baselineEnd: new Date("2026-03-11T00:00:00.000Z"),
      }),
    ]

    const timeline = resolveDataGridGanttTimelineState({
      getCount: () => rows.length,
      get: index => rows[index],
    }, options!)

    const bars = buildDataGridGanttVisibleBars({
      rows,
      viewportRowStart: 0,
      scrollTop: 0,
      topSpacerHeight: 0,
      viewportHeight: 120,
      baseRowHeight: 32,
      resolveRowHeight: () => 32,
      timeline,
      options: options!,
    })

    expect(bars).toHaveLength(1)
    expect(bars[0]!.baselineStartMs).toBe(Date.parse("2026-03-09T00:00:00.000Z"))
    expect(bars[0]!.baselineEndMs).toBe(Date.parse("2026-03-11T00:00:00.000Z"))
  })

  it("derives summary bars from visible group descendants", () => {
    const options = normalizeDataGridGanttOptions({
      rowBarHeight: 16,
      minBarWidth: 4,
    })
    expect(options).toBeTruthy()

    const rows = [
      {
        rowId: "group-a",
        rowKey: "group-a",
        sourceIndex: -1,
        originalIndex: -1,
        displayIndex: 0,
        kind: "group" as const,
        row: {} as DemoRow,
        data: {} as DemoRow,
        state: { selected: false, group: true, pinned: "none", expanded: true },
        groupMeta: {
          groupKey: "region:A",
          groupField: "region",
          groupValue: "A",
          level: 0,
          childrenCount: 2,
        },
      } as unknown as DataGridRowNode<DemoRow>,
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
        start: new Date("2026-03-15T00:00:00.000Z"),
        end: new Date("2026-03-18T00:00:00.000Z"),
        progress: 0.6,
      }),
    ]

    const timeline = resolveDataGridGanttTimelineState({
      getCount: () => rows.length,
      get: index => rows[index],
    }, options!)

    const bars = buildDataGridGanttVisibleBars({
      rows,
      viewportRowStart: 0,
      scrollTop: 0,
      topSpacerHeight: 0,
      viewportHeight: 160,
      baseRowHeight: 32,
      resolveRowHeight: () => 32,
      timeline,
      options: options!,
    })

    expect(bars).toHaveLength(3)
    expect(bars[0]!.summary).toBe(true)
    expect(bars[0]!.label).toBe("A")
    expect(bars[0]!.startMs).toBe(Date.parse("2026-03-10T00:00:00.000Z"))
    expect(bars[0]!.endMs).toBe(Date.parse("2026-03-18T00:00:00.000Z"))
    expect(bars[0]!.progress).toBe(0)
    expect(bars[0]!.dependencies).toEqual([])
    expect(bars[0]!.height).toBe(bars[1]!.height)
    expect(bars[0]!.baselineStartMs).toBeNull()
  })

  it("computes critical tasks from finish-to-start dependencies", () => {
    const options = normalizeDataGridGanttOptions({
      computedCriticalPath: true,
    })
    expect(options).toBeTruthy()

    const rows = [
      buildRow("task-a", {
        id: "task-a",
        task: "Task A",
        start: new Date("2026-03-01T00:00:00.000Z"),
        end: new Date("2026-03-03T00:00:00.000Z"),
        progress: 0,
      }),
      buildRow("task-b", {
        id: "task-b",
        task: "Task B",
        start: new Date("2026-03-03T00:00:00.000Z"),
        end: new Date("2026-03-06T00:00:00.000Z"),
        progress: 0,
        dependencies: ["task-a"],
      }),
      buildRow("task-c", {
        id: "task-c",
        task: "Task C",
        start: new Date("2026-03-04T00:00:00.000Z"),
        end: new Date("2026-03-05T00:00:00.000Z"),
        progress: 0,
      }),
    ]

    const criticalTaskIds = resolveDataGridGanttCriticalTaskIds({
      getCount: () => rows.length,
      get: index => rows[index],
    }, options!)

    expect(Array.from(criticalTaskIds).sort()).toEqual(["task-a", "task-b"])
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
    expect(paths[0]!.points).toHaveLength(6)
    expect(paths[0]!.points[0]!.x).toBeGreaterThan(bars[0]!.x)
    expect(paths[0]!.points[1]!.x).toBeGreaterThan(paths[0]!.points[0]!.x)
    expect(paths[0]!.points[4]!.x).toBeLessThan(paths[0]!.points[5]!.x)
  })

  it("routes backward dependencies with a right-side detour", () => {
    const source = {
      row: buildRow("source", {
        id: "source",
        task: "Source",
        start: new Date("2026-03-14T00:00:00.000Z"),
        end: new Date("2026-03-16T00:00:00.000Z"),
        progress: 0.4,
      }),
      rowId: "source",
      rowUpdateId: "source",
      taskId: "source",
      rowIndex: 0,
      label: "Source",
      dependencies: [],
      dependencyRefs: [],
      critical: false,
      criticalSource: null,
      milestone: false,
      summary: false,
      progress: 0.4,
      startMs: Date.parse("2026-03-14T00:00:00.000Z"),
      endMs: Date.parse("2026-03-16T00:00:00.000Z"),
      baselineStartMs: null,
      baselineEndMs: null,
      x: 180,
      width: 48,
      y: 20,
      height: 16,
    }

    const target = {
      row: buildRow("target", {
        id: "target",
        task: "Target",
        start: new Date("2026-03-10T00:00:00.000Z"),
        end: new Date("2026-03-12T00:00:00.000Z"),
        progress: 0.6,
        dependencies: ["source"],
      }),
      rowId: "target",
      rowUpdateId: "target",
      taskId: "target",
      rowIndex: 1,
      label: "Target",
      dependencies: ["source"],
      dependencyRefs: [{ taskId: "source", type: "FS", raw: "source" }],
      critical: false,
      criticalSource: null,
      milestone: false,
      summary: false,
      progress: 0.6,
      startMs: Date.parse("2026-03-10T00:00:00.000Z"),
      endMs: Date.parse("2026-03-12T00:00:00.000Z"),
      baselineStartMs: null,
      baselineEndMs: null,
      x: 60,
      width: 48,
      y: 52,
      height: 16,
    }

    const paths = buildDataGridGanttDependencyPaths({
      bars: [source, target],
      minBendPx: 12,
    })

    expect(paths).toHaveLength(1)
    expect(paths[0]!.points).toHaveLength(7)
    expect(paths[0]!.dependencyType).toBe("FS")
    expect(paths[0]!.points[1]!.x).toBeGreaterThan(source.x + source.width)
    expect(paths[0]!.points[4]!.x).toBeLessThan(target.x)
    expect(paths[0]!.points[4]!.y).not.toBe(target.y + (target.height / 2))
    expect(paths[0]!.points[5]).toEqual({
      x: target.x - 6,
      y: target.y + (target.height / 2),
    })
    expect(paths[0]!.points[6]).toEqual({
      x: target.x,
      y: target.y + (target.height / 2),
    })
  })

  it("uses a compact symmetric route for tightly adjacent bars", () => {
    const source = {
      row: buildRow("source-tight", {
        id: "source-tight",
        task: "Source tight",
        start: new Date("2026-03-10T00:00:00.000Z"),
        end: new Date("2026-03-11T00:00:00.000Z"),
      }),
      rowId: "source-tight",
      rowUpdateId: "source-tight",
      taskId: "source-tight",
      rowIndex: 0,
      label: "Source tight",
      dependencies: [],
      dependencyRefs: [],
      critical: false,
      criticalSource: null,
      milestone: false,
      summary: false,
      progress: 0,
      startMs: Date.parse("2026-03-10T00:00:00.000Z"),
      endMs: Date.parse("2026-03-11T00:00:00.000Z"),
      baselineStartMs: null,
      baselineEndMs: null,
      x: 100,
      width: 40,
      y: 20,
      height: 16,
    }

    const target = {
      row: buildRow("target-tight", {
        id: "target-tight",
        task: "Target tight",
        start: new Date("2026-03-11T00:00:00.000Z"),
        end: new Date("2026-03-12T00:00:00.000Z"),
        dependencies: ["source-tight"],
      }),
      rowId: "target-tight",
      rowUpdateId: "target-tight",
      taskId: "target-tight",
      rowIndex: 1,
      label: "Target tight",
      dependencies: ["source-tight"],
      dependencyRefs: [{ taskId: "source-tight", type: "FS", raw: "source-tight" }],
      critical: false,
      criticalSource: null,
      milestone: false,
      summary: false,
      progress: 0,
      startMs: Date.parse("2026-03-11T00:00:00.000Z"),
      endMs: Date.parse("2026-03-12T00:00:00.000Z"),
      baselineStartMs: null,
      baselineEndMs: null,
      x: 156,
      width: 44,
      y: 52,
      height: 16,
    }

    const paths = buildDataGridGanttDependencyPaths({
      bars: [source, target],
      minBendPx: 12,
    })

    expect(paths).toHaveLength(1)
    expect(paths[0]!.points).toHaveLength(6)
    expect(paths[0]!.points[1]).toEqual({
      x: source.x + source.width + 6,
      y: source.y + (source.height / 2),
    })
    expect(paths[0]!.points[2]).toEqual(paths[0]!.points[1])
    expect(paths[0]!.points[4]).toEqual({
      x: target.x - 6,
      y: target.y + (target.height / 2),
    })
  })

  it("anchors finish-to-finish dependencies on the right edge of both bars", () => {
    const source = {
      row: buildRow("source-ff", {
        id: "source-ff",
        task: "Source FF",
        start: new Date("2026-03-10T00:00:00.000Z"),
        end: new Date("2026-03-13T00:00:00.000Z"),
        progress: 0,
      }),
      rowId: "source-ff",
      rowUpdateId: "source-ff",
      taskId: "source-ff",
      rowIndex: 0,
      label: "Source FF",
      dependencies: [],
      dependencyRefs: [],
      critical: false,
      criticalSource: null,
      milestone: false,
      summary: false,
      progress: 0,
      startMs: Date.parse("2026-03-10T00:00:00.000Z"),
      endMs: Date.parse("2026-03-13T00:00:00.000Z"),
      baselineStartMs: null,
      baselineEndMs: null,
      x: 100,
      width: 48,
      y: 20,
      height: 16,
    }

    const target = {
      row: buildRow("target-ff", {
        id: "target-ff",
        task: "Target FF",
        start: new Date("2026-03-14T00:00:00.000Z"),
        end: new Date("2026-03-18T00:00:00.000Z"),
        dependencies: ["source-ff:FF"],
        progress: 0,
      }),
      rowId: "target-ff",
      rowUpdateId: "target-ff",
      taskId: "target-ff",
      rowIndex: 1,
      label: "Target FF",
      dependencies: ["source-ff:FF"],
      dependencyRefs: [{ taskId: "source-ff", type: "FF", raw: "source-ff:FF" }],
      critical: false,
      criticalSource: null,
      milestone: false,
      summary: false,
      progress: 0,
      startMs: Date.parse("2026-03-14T00:00:00.000Z"),
      endMs: Date.parse("2026-03-18T00:00:00.000Z"),
      baselineStartMs: null,
      baselineEndMs: null,
      x: 180,
      width: 56,
      y: 52,
      height: 16,
    }

    const paths = buildDataGridGanttDependencyPaths({
      bars: [source, target],
      minBendPx: 12,
    })

    expect(paths).toHaveLength(1)
    expect(paths[0]!.dependencyType).toBe("FF")
    expect(paths[0]!.points[0]).toEqual({
      x: source.x + source.width,
      y: source.y + (source.height / 2),
    })
    expect(paths[0]!.points[4]).toEqual({
      x: target.x + target.width + 6,
      y: target.y + (target.height / 2),
    })
    expect(paths[0]!.points[5]).toEqual({
      x: target.x + target.width,
      y: target.y + (target.height / 2),
    })
  })

  it("prefers task ids over row ids when dependency keys overlap", () => {
    const sourceByTaskId = {
      row: buildRow("10", {
        id: "task-10",
        task: "Source by task id",
        start: new Date("2026-03-10T00:00:00.000Z"),
        end: new Date("2026-03-12T00:00:00.000Z"),
        progress: 0.4,
      }),
      rowId: "10",
      rowUpdateId: "10",
      taskId: "task-10",
      rowIndex: 0,
      label: "Source by task id",
      dependencies: [],
      dependencyRefs: [],
      critical: false,
      criticalSource: null,
      milestone: false,
      summary: false,
      progress: 0.4,
      startMs: Date.parse("2026-03-10T00:00:00.000Z"),
      endMs: Date.parse("2026-03-12T00:00:00.000Z"),
      baselineStartMs: null,
      baselineEndMs: null,
      x: 100,
      width: 48,
      y: 20,
      height: 16,
    }

    const sourceByRowId = {
      row: buildRow("task-10", {
        id: "",
        task: "Source by row id",
        start: new Date("2026-03-08T00:00:00.000Z"),
        end: new Date("2026-03-09T00:00:00.000Z"),
        progress: 0.2,
      }),
      rowId: "task-10",
      rowUpdateId: "task-10",
      taskId: "",
      rowIndex: 1,
      label: "Source by row id",
      dependencies: [],
      dependencyRefs: [],
      critical: false,
      criticalSource: null,
      milestone: false,
      summary: false,
      progress: 0.2,
      startMs: Date.parse("2026-03-08T00:00:00.000Z"),
      endMs: Date.parse("2026-03-09T00:00:00.000Z"),
      baselineStartMs: null,
      baselineEndMs: null,
      x: 40,
      width: 24,
      y: 52,
      height: 16,
    }

    const target = {
      row: buildRow("target", {
        id: "target",
        task: "Target",
        start: new Date("2026-03-13T00:00:00.000Z"),
        end: new Date("2026-03-15T00:00:00.000Z"),
        progress: 0.6,
        dependencies: ["task-10"],
      }),
      rowId: "target",
      rowUpdateId: "target",
      taskId: "target",
      rowIndex: 2,
      label: "Target",
      dependencies: ["task-10"],
      dependencyRefs: [{ taskId: "task-10", type: "FS", raw: "task-10" }],
      critical: false,
      criticalSource: null,
      milestone: false,
      summary: false,
      progress: 0.6,
      startMs: Date.parse("2026-03-13T00:00:00.000Z"),
      endMs: Date.parse("2026-03-15T00:00:00.000Z"),
      baselineStartMs: null,
      baselineEndMs: null,
      x: 180,
      width: 48,
      y: 84,
      height: 16,
    }

    const paths = buildDataGridGanttDependencyPaths({
      bars: [sourceByTaskId, sourceByRowId, target],
    })

    expect(paths).toHaveLength(1)
    expect(paths[0]!.dependencyTaskId).toBe("task-10")
    expect(paths[0]!.sourceBar.taskId).toBe("task-10")
    expect(paths[0]!.sourceBar.rowId).toBe("10")
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

    expect(resolveDataGridGanttRangeFrame({
      startMs: Date.parse("2026-03-05T00:00:00.000Z"),
      endMs: Date.parse("2026-03-05T00:00:00.000Z"),
    }, timeline, 6, 16)).toEqual({
      x: 32 - 8,
      width: 16,
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

  it("maps timeline dates into horizontal offsets and clamps scroll bounds", () => {
    const timeline = {
      startMs: Date.parse("2026-03-01T00:00:00.000Z"),
      endMs: Date.parse("2026-03-31T00:00:00.000Z"),
      pixelsPerDay: 10,
      totalWidth: 300,
      zoomLevel: "day" as const,
    }

    expect(resolveDataGridGanttDateOffset(
      Date.parse("2026-03-06T00:00:00.000Z"),
      timeline,
    )).toBe(50)

    expect(clampDataGridGanttScrollLeft(-20, timeline.totalWidth, 120)).toBe(0)
    expect(clampDataGridGanttScrollLeft(999, timeline.totalWidth, 120)).toBe(180)
    expect(clampDataGridGanttScrollLeft(40, timeline.totalWidth, 120)).toBe(40)
  })

  it("resolves horizontal auto-focus scroll positions for dates", () => {
    const timeline = {
      startMs: Date.parse("2026-03-01T00:00:00.000Z"),
      endMs: Date.parse("2026-03-31T00:00:00.000Z"),
      pixelsPerDay: 10,
      totalWidth: 300,
      zoomLevel: "day" as const,
    }

    expect(resolveDataGridGanttScrollLeftForDate({
      dateMs: Date.parse("2026-03-16T00:00:00.000Z"),
      timeline,
      viewportWidth: 100,
      align: "center",
    })).toBe(100)

    expect(resolveDataGridGanttScrollLeftForDate({
      dateMs: Date.parse("2026-03-02T00:00:00.000Z"),
      timeline,
      viewportWidth: 100,
      align: "center",
    })).toBe(0)

    expect(resolveDataGridGanttScrollLeftForDate({
      dateMs: Date.parse("2026-03-30T00:00:00.000Z"),
      timeline,
      viewportWidth: 100,
      align: "center",
    })).toBe(200)
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

    expect(resolveDataGridGanttSnapDays("day")).toBe(1)
    expect(resolveDataGridGanttSnapDays("week")).toBe(7)
    expect(snapDataGridGanttDateMs(Date.parse("2026-03-12T13:47:00.000Z"), "day"))
      .toBe(Date.parse("2026-03-12T00:00:00.000Z"))
    expect(snapDataGridGanttDateMs(Date.parse("2026-03-12T13:47:00.000Z"), "week"))
      .toBe(Date.parse("2026-03-09T00:00:00.000Z"))
    expect(snapDataGridGanttDayDelta(9, "week")).toBe(7)
    expect(applyDataGridGanttDragDelta(range, "move", 9, "week")).toEqual({
      startMs: Date.parse("2026-03-16T00:00:00.000Z"),
      endMs: Date.parse("2026-03-20T00:00:00.000Z"),
    })
  })

  it("snaps day-level drag interactions through the working calendar", () => {
    const range = {
      startMs: Date.parse("2026-03-06T00:00:00.000Z"),
      endMs: Date.parse("2026-03-09T00:00:00.000Z"),
    }
    const calendar = resolveDataGridWorkingCalendar({
      workingWeekdays: [1, 2, 3, 4, 5],
      holidays: ["2026-03-10T00:00:00.000Z"],
    })

    expect(snapDataGridGanttDateMs(
      Date.parse("2026-03-07T13:47:00.000Z"),
      "day",
      calendar,
    )).toBe(Date.parse("2026-03-09T00:00:00.000Z"))

    expect(applyDataGridGanttDragDelta(range, "move", 1, "day", calendar)).toEqual({
      startMs: Date.parse("2026-03-09T00:00:00.000Z"),
      endMs: Date.parse("2026-03-11T00:00:00.000Z"),
    })

    expect(applyDataGridGanttDragDelta(range, "resize-end", 1, "day", calendar)).toEqual({
      startMs: Date.parse("2026-03-06T00:00:00.000Z"),
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
      dependencyRefs: [],
      critical: false,
      criticalSource: null,
      milestone: false,
      summary: false,
      progress: 0.4,
      startMs: Date.parse("2026-03-10T00:00:00.000Z"),
      endMs: Date.parse("2026-03-12T00:00:00.000Z"),
      baselineStartMs: null,
      baselineEndMs: null,
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

  it("treats milestones as move-only hit targets", () => {
    const bars = [{
      row: buildRow("milestone", {
        id: "milestone",
        task: "Launch",
        start: new Date("2026-03-10T00:00:00.000Z"),
        end: new Date("2026-03-10T00:00:00.000Z"),
        progress: 0,
      }),
      rowId: "milestone",
      rowUpdateId: "milestone",
      taskId: "milestone",
      rowIndex: 0,
      label: "Launch",
      dependencies: [],
      dependencyRefs: [],
      critical: false,
      criticalSource: null,
      milestone: true,
      summary: false,
      progress: 0,
      startMs: Date.parse("2026-03-10T00:00:00.000Z"),
      endMs: Date.parse("2026-03-10T00:00:00.000Z"),
      baselineStartMs: null,
      baselineEndMs: null,
      x: 92,
      width: 16,
      y: 20,
      height: 16,
    }] as const

    expect(hitTestDataGridGanttBar(bars, { x: 100, y: 28 }, 8)?.mode).toBe("move")
  })

  it("does not expose summary bars as draggable gantt targets", () => {
    const bars = [{
      row: {
        rowId: "group-a",
        rowKey: "group-a",
        sourceIndex: -1,
        originalIndex: -1,
        displayIndex: 0,
        kind: "group" as const,
        row: {} as DemoRow,
        data: {} as DemoRow,
        state: { selected: false, group: true, pinned: "none", expanded: true },
        groupMeta: {
          groupKey: "region:A",
          groupField: "region",
          groupValue: "A",
          level: 0,
          childrenCount: 2,
        },
      } as unknown as DataGridRowNode<DemoRow>,
      rowId: "group-a",
      rowUpdateId: "group-a",
      taskId: "group-a",
      rowIndex: 0,
      label: "A",
      dependencies: [],
      dependencyRefs: [],
      critical: false,
      criticalSource: null,
      milestone: false,
      summary: true,
      progress: 0,
      startMs: Date.parse("2026-03-10T00:00:00.000Z"),
      endMs: Date.parse("2026-03-18T00:00:00.000Z"),
      baselineStartMs: null,
      baselineEndMs: null,
      x: 100,
      width: 64,
      y: 20,
      height: 20,
    }] as const

    expect(hitTestDataGridGanttBar(bars, { x: 120, y: 28 }, 8)).toBeNull()
  })
})
