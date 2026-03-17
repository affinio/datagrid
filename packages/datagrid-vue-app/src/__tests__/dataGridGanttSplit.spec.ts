import { describe, expect, it } from "vitest"
import {
  DATAGRID_GANTT_MIN_TABLE_PANE_WIDTH_PX,
  clampDataGridGanttTablePaneWidth,
  resolveDataGridGanttTablePaneDragWidth,
} from "../gantt/dataGridGanttSplit"

describe("dataGridGanttSplit", () => {
  it("clamps table pane width to the minimum table width", () => {
    expect(clampDataGridGanttTablePaneWidth({
      requestedWidth: 120,
      stageWidth: 1200,
    })).toBe(DATAGRID_GANTT_MIN_TABLE_PANE_WIDTH_PX)
  })

  it("clamps table pane width so timeline keeps a visible minimum width", () => {
    expect(clampDataGridGanttTablePaneWidth({
      requestedWidth: 980,
      stageWidth: 1000,
      minTableWidth: 280,
      minTimelineWidth: 240,
    })).toBe(760)
  })

  it("respects an explicit maximum table width", () => {
    expect(clampDataGridGanttTablePaneWidth({
      requestedWidth: 900,
      stageWidth: 1600,
      maxTableWidth: 640,
    })).toBe(640)
  })

  it("resolves drag width from pointer delta", () => {
    expect(resolveDataGridGanttTablePaneDragWidth({
      originWidth: 520,
      deltaX: 80,
      stageWidth: 1200,
    })).toBe(600)
  })
})
