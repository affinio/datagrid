import { computed, ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridTableStageVisualSelection } from "../useDataGridTableStageVisualSelection"

describe("useDataGridTableStageVisualSelection", () => {
  it("keeps the committed fill selection visible after preview clears", () => {
    const selectionRange = {
      startRow: 0,
      endRow: 5,
      startColumn: 0,
      endColumn: 0,
    }
    const service = useDataGridTableStageVisualSelection({
      mode: ref("base"),
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => ({
        rowIndex: 0,
        columnIndex: 0,
      })),
      fillPreviewRange: ref(null),
      isFillDragging: ref(false),
      interactionSelectionRange: ref(null),
      resolveCommittedSelectionRange: () => selectionRange,
      resolveCommittedSelectionRanges: () => [selectionRange],
      isCommittedSelectionAnchorCell: (rowOffset, columnIndex) => rowOffset === 0 && columnIndex === 0,
      isCommittedCellSelected: (rowOffset, columnIndex) => rowOffset >= 0 && rowOffset <= 5 && columnIndex === 0,
      shouldHighlightCommittedSelectedCell: (rowOffset, columnIndex) => rowOffset >= 0 && rowOffset <= 5 && columnIndex === 0,
      isCommittedCellOnSelectionEdge: vi.fn(),
    })

    expect(service.selectionRange.value).toEqual(selectionRange)
    expect(service.selectionRanges.value).toEqual([selectionRange])
    expect(service.isCellSelected(0, 0)).toBe(true)
    expect(service.isCellSelected(5, 0)).toBe(true)
    expect(service.shouldHighlightSelectedCell(0, 0)).toBe(false)
    expect(service.shouldHighlightSelectedCell(5, 0)).toBe(true)
  })

  it("highlights all additive ranges but keeps active range ownership for edge affordances", () => {
    const inactiveRange = {
      startRow: 1,
      endRow: 1,
      startColumn: 0,
      endColumn: 0,
    }
    const activeRange = {
      startRow: 4,
      endRow: 5,
      startColumn: 2,
      endColumn: 2,
    }
    const service = useDataGridTableStageVisualSelection({
      mode: ref("base"),
      viewportRowStart: ref(0),
      selectionAnchorCell: computed(() => ({
        rowIndex: 4,
        columnIndex: 2,
      })),
      fillPreviewRange: ref(null),
      isFillDragging: ref(false),
      interactionSelectionRange: ref(null),
      resolveCommittedSelectionRange: () => activeRange,
      resolveCommittedSelectionRanges: () => [inactiveRange, activeRange],
      isCommittedSelectionAnchorCell: (rowOffset, columnIndex) => rowOffset === 4 && columnIndex === 2,
      isCommittedCellSelected: (rowOffset, columnIndex) => (
        (rowOffset === 1 && columnIndex === 0)
        || (rowOffset >= 4 && rowOffset <= 5 && columnIndex === 2)
      ),
      shouldHighlightCommittedSelectedCell: (rowOffset, columnIndex) => (
        (rowOffset === 1 && columnIndex === 0)
        || (rowOffset >= 4 && rowOffset <= 5 && columnIndex === 2)
      ),
      isCommittedCellOnSelectionEdge: vi.fn(),
    })

    expect(service.selectionRange.value).toEqual(activeRange)
    expect(service.selectionRanges.value).toEqual([inactiveRange, activeRange])
    expect(service.isCellSelected(1, 0)).toBe(true)
    expect(service.shouldHighlightSelectedCell(1, 0)).toBe(true)
    expect(service.isCellOnSelectionEdge(1, 0, "top")).toBe(false)
    expect(service.isCellOnSelectionEdge(4, 2, "top")).toBe(true)
    expect(service.isCellOnSelectionEdge(5, 2, "bottom")).toBe(true)
  })
})
