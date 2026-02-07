import { describe, expect, it } from "vitest"
import { reconcileSelectionState, syncSelectionFromControllerState } from "../selectionStateSync"

function createState(input?: {
  ranges?: Array<{
    startRow: number
    endRow: number
    startCol: number
    endCol: number
    anchor: { rowIndex: number; colIndex: number; rowId?: string | null }
    focus: { rowIndex: number; colIndex: number; rowId?: string | null }
  }>
  selectedPoint?: { rowIndex: number; colIndex: number; rowId?: string | null } | null
}) {
  return {
    ranges: input?.ranges ?? [],
    areas: [],
    activeRangeIndex: 0,
    selectedPoint: input?.selectedPoint ?? null,
    anchorPoint: null,
    dragAnchorPoint: null,
  }
}

describe("selectionStateSync", () => {
  it("syncs headless selection state into shared state container", () => {
    const calls: Array<Record<string, unknown>> = []
    const sharedState = {
      patch(payload: Record<string, unknown>) {
        calls.push(payload)
      },
    }
    const state = createState({
      selectedPoint: { rowIndex: 2, colIndex: 3, rowId: "r-2" },
    })

    syncSelectionFromControllerState(sharedState, state)

    expect(calls.length).toBe(1)
    expect(calls[0]?.selectedCell).toEqual({ rowIndex: 2, colIndex: 3, rowId: "r-2" })
  })

  it("sets full-column state when one full-height column range is selected", () => {
    let selectedColumn: { column: number; anchorRow: number | null } | null = null

    reconcileSelectionState({
      state: createState({
        ranges: [{
          startRow: 0,
          endRow: 9,
          startCol: 2,
          endCol: 2,
          anchor: { rowIndex: 4, colIndex: 2, rowId: null },
          focus: { rowIndex: 7, colIndex: 2, rowId: null },
        }],
        selectedPoint: { rowIndex: 4, colIndex: 2, rowId: null },
      }),
      grid: { rowCount: 10, colCount: 5 },
      existingColumnSelection: null,
      selectedPointRowIndex: 4,
      setColumnSelectionState: (column, anchorRow) => {
        selectedColumn = { column, anchorRow }
      },
      clearColumnSelectionState: () => {},
      setSelectionDragSession: () => {},
      setFillSession: () => {},
      setFillDragging: () => {},
    })

    expect(selectedColumn).toEqual({ column: 2, anchorRow: 4 })
  })

  it("resets drag/fill state when ranges become empty", () => {
    const calls: string[] = []

    reconcileSelectionState({
      state: createState(),
      grid: { rowCount: 10, colCount: 5 },
      existingColumnSelection: null,
      selectedPointRowIndex: null,
      setColumnSelectionState: () => {},
      clearColumnSelectionState: () => {},
      setSelectionDragSession: () => calls.push("drag:null"),
      setFillSession: () => calls.push("fill:null"),
      setFillDragging: value => calls.push(`fillDragging:${value ? "1" : "0"}`),
    })

    expect(calls).toEqual(["drag:null", "fill:null", "fillDragging:0"])
  })
})
