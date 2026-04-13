import { computed, type ComputedRef, type Ref } from "vue"
import type { DataGridCopyRange } from "@affino/datagrid-vue/advanced"
import type {
  DataGridPendingEdge,
  DataGridTableMode,
  DataGridTableStageAnchorCell,
} from "./dataGridTableStage.types"

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
  const resolveVisualSelectionRanges = (): readonly DataGridCopyRange[] => selectionRanges.value

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
      return resolveVisualSelectionRanges().some(range => isCellWithinRange(range, rowOffset, columnIndex))
    }
    const range = resolveVisualSelectionRange()
    return range ? isCellWithinRange(range, rowOffset, columnIndex) : false
  }

  const shouldHighlightSelectedCell = (rowOffset: number, columnIndex: number): boolean => {
    if (!isVisualFillSelectionActive()) {
      const ranges = resolveVisualSelectionRanges()
      if (ranges.length === 0 || !ranges.some(range => isCellWithinRange(range, rowOffset, columnIndex))) {
        return false
      }
      if (
        ranges.length === 1
        && ranges[0]
        && ranges[0].startRow === ranges[0].endRow
        && ranges[0].startColumn === ranges[0].endColumn
      ) {
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
      return resolveVisualSelectionRanges().some(range => {
        if (!isCellWithinRange(range, rowOffset, columnIndex)) {
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
      })
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