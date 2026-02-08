import { describe, expect, it } from "vitest"
import {
  hasMeaningfulFillPreview,
  selectionAreasEqual,
  selectionPointsEqual,
  shouldProcessFillPreviewUpdate,
  shouldProcessFillTargetUpdate,
  shouldProcessSelectionDragUpdate,
} from "../selectionFillOrchestration"

describe("selectionFillOrchestration", () => {
  it("treats drag point with same rowId+column as identical", () => {
    const previous = { rowId: "r-12", rowIndex: 12, colIndex: 3 }
    const next = { rowId: "r-12", rowIndex: 38, colIndex: 3 }
    expect(selectionPointsEqual(previous, next)).toBe(true)
    expect(shouldProcessSelectionDragUpdate(previous, next)).toBe(false)
  })

  it("detects fill-target updates when point changes", () => {
    const previous = { rowId: "r-1", rowIndex: 1, colIndex: 2 }
    const next = { rowId: "r-2", rowIndex: 2, colIndex: 2 }
    expect(selectionPointsEqual(previous, next)).toBe(false)
    expect(shouldProcessFillTargetUpdate(previous, next)).toBe(true)
  })

  it("compares fill-preview areas deterministically", () => {
    const a = { startRow: 4, endRow: 7, startCol: 1, endCol: 3 }
    const b = { startRow: 4, endRow: 7, startCol: 1, endCol: 3 }
    const c = { startRow: 4, endRow: 8, startCol: 1, endCol: 3 }
    expect(selectionAreasEqual(a, b)).toBe(true)
    expect(shouldProcessFillPreviewUpdate(a, b)).toBe(false)
    expect(selectionAreasEqual(a, c)).toBe(false)
    expect(shouldProcessFillPreviewUpdate(a, c)).toBe(true)
  })

  it("commits fill only when preview diverges from origin area", () => {
    const origin = { startRow: 2, endRow: 3, startCol: 1, endCol: 1 }
    const identicalPreview = { startRow: 2, endRow: 3, startCol: 1, endCol: 1 }
    const extendedPreview = { startRow: 2, endRow: 6, startCol: 1, endCol: 1 }
    expect(hasMeaningfulFillPreview(origin, null)).toBe(false)
    expect(hasMeaningfulFillPreview(origin, identicalPreview)).toBe(false)
    expect(hasMeaningfulFillPreview(origin, extendedPreview)).toBe(true)
  })
})
