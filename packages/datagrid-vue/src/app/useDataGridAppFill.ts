import type { Ref } from "vue"
import {
  type DataGridFillBehavior,
  buildDataGridFillMatrix,
  canToggleDataGridFillBehavior,
  resolveDataGridDefaultFillBehavior,
} from "../composables/dataGridFillBehavior"
import {
  type DataGridCopyRange,
} from "../advanced"
import type { DataGridAppMode } from "./useDataGridAppControls"

export interface DataGridAppAppliedFillSession {
  baseRange: DataGridCopyRange
  previewRange: DataGridCopyRange
  behavior: DataGridFillBehavior
  allowBehaviorToggle: boolean
}

export interface UseDataGridAppFillOptions {
  mode: Ref<DataGridAppMode>
  viewportRowStart: Ref<number>
  isFillDragging: Ref<boolean>
  fillBaseRange: Ref<DataGridCopyRange | null>
  fillPreviewRange: Ref<DataGridCopyRange | null>
  activeFillBehavior: Ref<DataGridFillBehavior | null>
  resolveSelectionRange: () => DataGridCopyRange | null
  rangesEqual: (left: DataGridCopyRange | null, right: DataGridCopyRange | null) => boolean
  buildFillMatrixFromRange: (range: DataGridCopyRange) => string[][]
  applyClipboardEdits: (range: DataGridCopyRange, matrix: string[][]) => number
  isCellEditableAt: (rowIndex: number, columnIndex: number) => boolean
  setLastAppliedFillSession: (session: DataGridAppAppliedFillSession | null) => void
  syncViewport: () => void
}

export interface UseDataGridAppFillResult {
  applyFillPreview: (behavior?: DataGridFillBehavior) => boolean
  applyFillRange: (
    baseRange: DataGridCopyRange,
    previewRange: DataGridCopyRange,
    behavior?: DataGridFillBehavior,
  ) => boolean
  isCellInFillPreview: (rowOffset: number, columnIndex: number) => boolean
  isFillHandleCell: (rowOffset: number, columnIndex: number) => boolean
}

export function useDataGridAppFill(
  options: UseDataGridAppFillOptions,
): UseDataGridAppFillResult {
  const applyFillRange = (
    baseRange: DataGridCopyRange,
    previewRange: DataGridCopyRange,
    behaviorOverride?: DataGridFillBehavior,
  ): boolean => {
    if (options.rangesEqual(baseRange, previewRange)) {
      return false
    }
    const sourceMatrix = options.buildFillMatrixFromRange(baseRange)
    if (!sourceMatrix.length) {
      return false
    }
    const behavior = behaviorOverride
      ?? options.activeFillBehavior.value
      ?? resolveDataGridDefaultFillBehavior({
        baseRange,
        previewRange,
        sourceMatrix,
      })
    const matrix = buildDataGridFillMatrix({
      baseRange,
      previewRange,
      sourceMatrix,
      behavior,
    })
    const appliedRows = options.applyClipboardEdits(previewRange, matrix)
    if (appliedRows > 0) {
      options.setLastAppliedFillSession({
        baseRange: { ...baseRange },
        previewRange: { ...previewRange },
        behavior,
        allowBehaviorToggle: canToggleDataGridFillBehavior({
          baseRange,
          previewRange,
          sourceMatrix,
        }),
      })
      options.syncViewport()
      return true
    }
    return false
  }

  const applyFillPreview = (behavior?: DataGridFillBehavior): boolean => {
    const baseRange = options.fillBaseRange.value
    const previewRange = options.fillPreviewRange.value
    if (!baseRange || !previewRange) {
      return false
    }
    return applyFillRange(baseRange, previewRange, behavior)
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
    const range = options.isFillDragging.value && options.fillPreviewRange.value
      ? options.fillPreviewRange.value
      : options.resolveSelectionRange()
    if (!range) {
      return false
    }
    const rowIndex = options.viewportRowStart.value + rowOffset
    return rowIndex === range.endRow
      && columnIndex === range.endColumn
      && options.isCellEditableAt(rowIndex, columnIndex)
  }

  return {
    applyFillPreview,
    applyFillRange,
    isCellInFillPreview,
    isFillHandleCell,
  }
}
