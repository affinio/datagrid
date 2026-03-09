import type { Ref } from "vue"
import type { DataGridCopyRange } from "../advanced"
import type { DataGridAppMode } from "./useDataGridAppControls"

export interface UseDataGridAppFillOptions {
  mode: Ref<DataGridAppMode>
  viewportRowStart: Ref<number>
  fillBaseRange: Ref<DataGridCopyRange | null>
  fillPreviewRange: Ref<DataGridCopyRange | null>
  resolveSelectionRange: () => DataGridCopyRange | null
  rangesEqual: (left: DataGridCopyRange | null, right: DataGridCopyRange | null) => boolean
  buildFillMatrixFromRange: (range: DataGridCopyRange) => string[][]
  applyClipboardEdits: (range: DataGridCopyRange, matrix: string[][]) => number
  syncViewport: () => void
}

export interface UseDataGridAppFillResult {
  applyFillPreview: () => void
  isCellInFillPreview: (rowOffset: number, columnIndex: number) => boolean
  isFillHandleCell: (rowOffset: number, columnIndex: number) => boolean
}

export function useDataGridAppFill(
  options: UseDataGridAppFillOptions,
): UseDataGridAppFillResult {
  const applyFillPreview = (): void => {
    const baseRange = options.fillBaseRange.value
    const previewRange = options.fillPreviewRange.value
    if (!baseRange || !previewRange || options.rangesEqual(baseRange, previewRange)) {
      return
    }
    const matrix = options.buildFillMatrixFromRange(baseRange)
    if (!matrix.length) {
      return
    }
    const appliedRows = options.applyClipboardEdits(previewRange, matrix)
    if (appliedRows > 0) {
      options.syncViewport()
    }
  }

  const isCellInFillPreview = (rowOffset: number, columnIndex: number): boolean => {
    if (options.mode.value !== "base") {
      return false
    }
    const preview = options.fillPreviewRange.value
    if (!preview) {
      return false
    }
    const rowIndex = options.viewportRowStart.value + rowOffset
    const inPreview = (
      rowIndex >= preview.startRow
      && rowIndex <= preview.endRow
      && columnIndex >= preview.startColumn
      && columnIndex <= preview.endColumn
    )
    if (!inPreview) {
      return false
    }
    const base = options.fillBaseRange.value
    if (!base) {
      return true
    }
    const inBase = (
      rowIndex >= base.startRow
      && rowIndex <= base.endRow
      && columnIndex >= base.startColumn
      && columnIndex <= base.endColumn
    )
    return !inBase
  }

  const isFillHandleCell = (rowOffset: number, columnIndex: number): boolean => {
    if (options.mode.value !== "base") {
      return false
    }
    const range = options.resolveSelectionRange()
    if (!range) {
      return false
    }
    const rowIndex = options.viewportRowStart.value + rowOffset
    return rowIndex === range.endRow && columnIndex === range.endColumn
  }

  return {
    applyFillPreview,
    isCellInFillPreview,
    isFillHandleCell,
  }
}
