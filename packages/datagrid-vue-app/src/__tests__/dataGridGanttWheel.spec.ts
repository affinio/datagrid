import { describe, expect, it } from "vitest"
import { resolveDataGridGanttWheelIntent } from "../gantt/dataGridGanttWheel"

describe("dataGridGanttWheel", () => {
  it("treats dominant Y-wheel gestures as vertical scrolling", () => {
    expect(resolveDataGridGanttWheelIntent({
      deltaX: 0.2,
      deltaY: 18,
      shiftKey: false,
    })).toEqual({
      horizontalDelta: 0,
      verticalDelta: 18,
    })
  })

  it("treats dominant X-wheel gestures as horizontal scrolling", () => {
    expect(resolveDataGridGanttWheelIntent({
      deltaX: 24,
      deltaY: 6,
      shiftKey: false,
    })).toEqual({
      horizontalDelta: 24,
      verticalDelta: 0,
    })
  })

  it("maps shift-wheel gestures into horizontal scrolling", () => {
    expect(resolveDataGridGanttWheelIntent({
      deltaX: 0,
      deltaY: 14,
      shiftKey: true,
    })).toEqual({
      horizontalDelta: 14,
      verticalDelta: 0,
    })
  })

  it("ignores sub-pixel wheel noise", () => {
    expect(resolveDataGridGanttWheelIntent({
      deltaX: 0.1,
      deltaY: 0.2,
      shiftKey: false,
    })).toEqual({
      horizontalDelta: 0,
      verticalDelta: 0,
    })
  })
})
