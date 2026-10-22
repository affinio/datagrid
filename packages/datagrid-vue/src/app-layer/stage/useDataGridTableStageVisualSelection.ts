import { computed, type ComputedRef, type Ref } from "vue"
import type { DataGridCopyRange } from "@affino/datagrid-vue/advanced"
import type {
  DataGridPendingEdge,
  DataGridTableMode,
  DataGridTableStageAnchorCell,
} from "./dataGridTableStage.types"

const VISUAL_SELECTION_LOOKUP_MAX_INDEXED_ROWS = 50_000
const VISUAL_SELECTION_LOOKUP_MAX_INLINE_ROW_SPAN = 256

export interface UseDataGridTableStageVisualSelectionOptions {
  mode: Ref<DataGridTableMode>
  viewportRowStart: Ref<number>
  selectionAnchorCell: ComputedRef<DataGridTableStageAnchorCell | null>
  fillPreviewRange: Ref<DataGridCopyRange | null>
  isFillDragging: Ref<boolean>
  interactionSelectionRange: Ref<DataGridCopyRange | null>
  resolveCommittedSelectionRange: () => DataGridCopyRange | null
  resolveCommittedSelectionRanges: () => readonly DataGridCopyRange[]
  isCommittedSelectionAnchorCell: (rowOffset: number, columnIndex: number) => boolean
  isCommittedCellSelected: (rowOffset: number, columnIndex: number) => boolean
  shouldHighlightCommittedSelectedCell: (rowOffset: number, columnIndex: number) => boolean
  isCommittedCellOnSelectionEdge: (rowOffset: number, columnIndex: number, edge: DataGridPendingEdge) => boolean
}

export interface UseDataGridTableStageVisualSelectionResult {
  selectionRange: ComputedRef<DataGridCopyRange | null>
  selectionRanges: ComputedRef<readonly DataGridCopyRange[]>
  isSelectionAnchorCell: (rowOffset: number, columnIndex: number) => boolean
  isCellSelected: (rowOffset: number, columnIndex: number) => boolean
  shouldHighlightSelectedCell: (rowOffset: number, columnIndex: number) => boolean
  isCellOnSelectionEdge: (rowOffset: number, columnIndex: number, edge: DataGridPendingEdge) => boolean
}

interface NormalizedVisualSelectionRange extends DataGridCopyRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

interface VisualSelectionLookup {
  rowBuckets: Map<number, NormalizedVisualSelectionRange[]>
  overflowRanges: NormalizedVisualSelectionRange[]
  rangeCount: number
  singleCellRange: NormalizedVisualSelectionRange | null
}

function normalizeVisualSelectionRange(range: DataGridCopyRange): NormalizedVisualSelectionRange {
  return {
    ...range,
    startRow: Math.min(range.startRow, range.endRow),
    endRow: Math.max(range.startRow, range.endRow),
    startColumn: Math.min(range.startColumn, range.endColumn),
    endColumn: Math.max(range.startColumn, range.endColumn),
  }
}

function isSingleCellRange(range: DataGridCopyRange): boolean {
  return range.startRow === range.endRow && range.startColumn === range.endColumn
}

export function useDataGridTableStageVisualSelection(
  options: UseDataGridTableStageVisualSelectionOptions,
): UseDataGridTableStageVisualSelectionResult {
  const selectionRange = computed(() => (
    options.interactionSelectionRange.value ?? options.resolveCommittedSelectionRange()
  ))
  const selectionRanges = computed<readonly DataGridCopyRange[]>(() => {
    const interactionRange = options.interactionSelectionRange.value
    if (interactionRange) {
      return [interactionRange]
    }
    return options.resolveCommittedSelectionRanges()
  })
  const selectionLookup = computed<VisualSelectionLookup>(() => {
    const ranges = selectionRanges.value.map(normalizeVisualSelectionRange)
    const rowBuckets = new Map<number, NormalizedVisualSelectionRange[]>()
    const overflowRanges: NormalizedVisualSelectionRange[] = []
    let indexedRows = 0

    for (const range of ranges) {
      const rowSpan = range.endRow - range.startRow + 1
      if (
        rowSpan <= VISUAL_SELECTION_LOOKUP_MAX_INLINE_ROW_SPAN
        && indexedRows + rowSpan <= VISUAL_SELECTION_LOOKUP_MAX_INDEXED_ROWS
      ) {
        for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
          const bucket = rowBuckets.get(rowIndex)
          if (bucket) {
            bucket.push(range)
          } else {
            rowBuckets.set(rowIndex, [range])
          }
        }
        indexedRows += rowSpan
      } else {
        overflowRanges.push(range)
      }
    }

    return {
      rowBuckets,
      overflowRanges,
      rangeCount: ranges.length,
      singleCellRange: ranges.length === 1 && ranges[0] && isSingleCellRange(ranges[0]) ? ranges[0] : null,
    }
  })

  const resolveVisualAnchorCell = (): DataGridTableStageAnchorCell | null => {
    const range = selectionRange.value
    if (
      range
      && range.startRow === range.endRow
      && range.startColumn === range.endColumn
    ) {
      return {
        rowIndex: range.startRow,
        columnIndex: range.startColumn,
      }
    }
    return options.selectionAnchorCell.value
  }

  const resolveVisualSelectionRange = (): DataGridCopyRange | null => selectionRange.value
  const isVisualFillSelectionActive = (): boolean => {
    return options.mode.value === "base" && options.isFillDragging.value && Boolean(options.fillPreviewRange.value)
  }

  const isCellWithinRange = (
    range: DataGridCopyRange,
    rowOffset: number,
    columnIndex: number,
  ): boolean => {
    const rowIndex = options.viewportRowStart.value + rowOffset
    return (
      rowIndex >= range.startRow
      && rowIndex <= range.endRow
      && columnIndex >= range.startColumn
      && columnIndex <= range.endColumn
    )
  }

  const isCellWithinSelectionLookup = (rowOffset: number, columnIndex: number): boolean => {
    const rowIndex = options.viewportRowStart.value + rowOffset
    const lookup = selectionLookup.value
    const rowBucket = lookup.rowBuckets.get(rowIndex)
    if (rowBucket?.some(range => columnIndex >= range.startColumn && columnIndex <= range.endColumn)) {
      return true
    }
    return lookup.overflowRanges.some(range => (
      rowIndex >= range.startRow
      && rowIndex <= range.endRow
      && columnIndex >= range.startColumn
      && columnIndex <= range.endColumn
    ))
  }

  const isSelectionAnchorCell = (rowOffset: number, columnIndex: number): boolean => {
    const anchorCell = resolveVisualAnchorCell()
    if (anchorCell) {
      return anchorCell.rowIndex === options.viewportRowStart.value + rowOffset
        && anchorCell.columnIndex === columnIndex
    }
    return options.isCommittedSelectionAnchorCell(rowOffset, columnIndex)
  }

  const isCellSelected = (rowOffset: number, columnIndex: number): boolean => {
    if (!isVisualFillSelectionActive()) {
      return isCellWithinSelectionLookup(rowOffset, columnIndex)
    }
    const range = resolveVisualSelectionRange()
    return range ? isCellWithinRange(range, rowOffset, columnIndex) : false
  }

  const shouldHighlightSelectedCell = (rowOffset: number, columnIndex: number): boolean => {
    if (!isVisualFillSelectionActive()) {
      const lookup = selectionLookup.value
      if (lookup.rangeCount === 0 || !isCellWithinSelectionLookup(rowOffset, columnIndex)) {
        return false
      }
      if (lookup.singleCellRange) {
        return false
      }
      return !isSelectionAnchorCell(rowOffset, columnIndex)
    }
    const range = resolveVisualSelectionRange()
    if (!range || !isCellWithinRange(range, rowOffset, columnIndex)) {
      return false
    }
    const isSingleCell = range.startRow === range.endRow && range.startColumn === range.endColumn
    if (isSingleCell) {
      return false
    }
    return !isSelectionAnchorCell(rowOffset, columnIndex)
  }

  const isCellOnSelectionEdge = (
    rowOffset: number,
    columnIndex: number,
    edge: DataGridPendingEdge,
  ): boolean => {
    if (!isVisualFillSelectionActive()) {
      const range = resolveVisualSelectionRange()
      if (!range || !isCellWithinRange(range, rowOffset, columnIndex)) {
        return false
      }
      const rowIndex = options.viewportRowStart.value + rowOffset
      switch (edge) {
        case "top":
          return rowIndex === range.startRow
        case "right":
          return columnIndex === range.endColumn
        case "bottom":
          return rowIndex === range.endRow
        case "left":
          return columnIndex === range.startColumn
      }
    }
    const range = resolveVisualSelectionRange()
    if (!range || !isCellWithinRange(range, rowOffset, columnIndex)) {
      return false
    }
    const rowIndex = options.viewportRowStart.value + rowOffset
    switch (edge) {
      case "top":
        return rowIndex === range.startRow
      case "right":
        return columnIndex === range.endColumn
      case "bottom":
        return rowIndex === range.endRow
      case "left":
        return columnIndex === range.startColumn
    }
  }

  return {
    selectionRange,
    selectionRanges,
    isSelectionAnchorCell,
    isCellSelected,
    shouldHighlightSelectedCell,
    isCellOnSelectionEdge,
  }
}
