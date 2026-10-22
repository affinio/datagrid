import { describe, expect, it } from "vitest"
import {
  DATAGRID_GANTT_MIN_INLINE_LABEL_WIDTH_PX,
  resolveDataGridGanttInlineLabel,
} from "../gantt/dataGridGanttLabel"

function measureTextWidth(text: string): number {
  return text.length * 7
}

describe("dataGridGanttLabel", () => {
  it("returns the full label when it fits", () => {
    expect(resolveDataGridGanttInlineLabel("Task 123", 80, measureTextWidth)).toBe("Task 123")
  })

  it("returns an ellipsized label when space is limited", () => {
    expect(resolveDataGridGanttInlineLabel("Very long task label", 70, measureTextWidth)).toBe("Very lo...")
  })

  it("returns null when the bar is too narrow", () => {
    expect(
      resolveDataGridGanttInlineLabel("Task 123", DATAGRID_GANTT_MIN_INLINE_LABEL_WIDTH_PX - 1, measureTextWidth),
    ).toBeNull()
  })
})
