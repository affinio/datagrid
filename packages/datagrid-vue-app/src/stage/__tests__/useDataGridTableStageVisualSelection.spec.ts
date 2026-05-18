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

  it("keeps many additive range lookups bounded through indexed rows", () => {
    const viewportRowStart = ref(1_000)
    const additiveRanges = Array.from({ length: 2_000 }, (_, index) => ({
      startRow: 1_000 + index,
      endRow: 1_000 + index,
      startColumn: index % 64,
      endColumn: index % 64,
    }))
    const tallOverflowRange = {
      startRow: 0,
      endRow: 20_000,
      startColumn: 70,
      endColumn: 70,
    }
    const activeRange = {
      startRow: 2_999,
      endRow: 2_999,
      startColumn: 15,
      endColumn: 15,
    }
    const service = useDataGridTableStageVisualSelection({
      mode: ref("base"),
      viewportRowStart,
      selectionAnchorCell: computed(() => ({
        rowIndex: 2_999,
        columnIndex: 15,
      })),
      fillPreviewRange: ref(null),
      isFillDragging: ref(false),
      interactionSelectionRange: ref(null),
      resolveCommittedSelectionRange: () => activeRange,
      resolveCommittedSelectionRanges: () => [...additiveRanges, tallOverflowRange, activeRange],
      isCommittedSelectionAnchorCell: (rowOffset, columnIndex) => viewportRowStart.value + rowOffset === 2_999 && columnIndex === 15,
      isCommittedCellSelected: vi.fn(),
      shouldHighlightCommittedSelectedCell: vi.fn(),
      isCommittedCellOnSelectionEdge: vi.fn(),
    })

    expect(service.isCellSelected(123, 59)).toBe(true)
    expect(service.shouldHighlightSelectedCell(123, 59)).toBe(true)
    expect(service.isCellSelected(123, 60)).toBe(false)
    expect(service.isCellSelected(7_000, 70)).toBe(true)
    expect(service.shouldHighlightSelectedCell(1_999, 15)).toBe(false)
  })
})
