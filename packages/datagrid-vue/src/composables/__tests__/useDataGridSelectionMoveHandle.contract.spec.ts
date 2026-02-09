import { describe, expect, it, vi } from "vitest"
import { useDataGridSelectionMoveHandle } from "../useDataGridSelectionMoveHandle"

interface Row {
  rowId: string
}

describe("useDataGridSelectionMoveHandle contract", () => {
  const row = { rowId: "r-1" }

  it("computes edge sides for cells inside selection range", () => {
    const handle = useDataGridSelectionMoveHandle<Row>({
      resolveSelectionRange: () => ({ startRow: 2, endRow: 4, startColumn: 3, endColumn: 5 }),
      resolveRowIndex: () => 2,
      resolveColumnIndex: () => 3,
      isCellWithinRange: () => true,
      resolveCellCoord: () => ({ rowIndex: 2, columnIndex: 3 }),
      startRangeMove: () => true,
      isRangeMoving: () => false,
      isFillDragging: () => false,
      isInlineEditorOpen: () => false,
    })

    expect(handle.getSelectionEdgeSides(row, "service")).toEqual({
      top: true,
      right: false,
      bottom: false,
      left: true,
    })
    expect(handle.shouldShowSelectionMoveHandle(row, "service", "top")).toBe(true)
    expect(handle.shouldShowSelectionMoveHandle(row, "service", "right")).toBe(false)
  })

  it("hides handles when move/fill/edit state is active", () => {
    const handle = useDataGridSelectionMoveHandle<Row>({
      resolveSelectionRange: () => ({ startRow: 1, endRow: 1, startColumn: 1, endColumn: 1 }),
      resolveRowIndex: () => 1,
      resolveColumnIndex: () => 1,
      isCellWithinRange: () => true,
      resolveCellCoord: () => ({ rowIndex: 1, columnIndex: 1 }),
      startRangeMove: () => true,
      isRangeMoving: () => true,
      isFillDragging: () => false,
      isInlineEditorOpen: () => false,
    })

    expect(handle.shouldShowSelectionMoveHandle(row, "service", "top")).toBe(false)
  })

  it("starts range move on primary button down with valid coord", () => {
    const startRangeMove = vi.fn(() => true)
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const handle = useDataGridSelectionMoveHandle<Row>({
      resolveSelectionRange: () => ({ startRow: 1, endRow: 1, startColumn: 1, endColumn: 1 }),
      resolveRowIndex: () => 1,
      resolveColumnIndex: () => 1,
      isCellWithinRange: () => true,
      resolveCellCoord: () => ({ rowIndex: 1, columnIndex: 1 }),
      startRangeMove,
      isRangeMoving: () => false,
      isFillDragging: () => false,
      isInlineEditorOpen: () => false,
    })

    const didStart = handle.onSelectionMoveHandleMouseDown(row, "service", {
      button: 0,
      clientX: 10,
      clientY: 20,
      preventDefault,
      stopPropagation,
    } as unknown as MouseEvent)

    expect(didStart).toBe(true)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(startRangeMove).toHaveBeenCalledWith({ rowIndex: 1, columnIndex: 1 }, expect.any(Object))
  })
})
