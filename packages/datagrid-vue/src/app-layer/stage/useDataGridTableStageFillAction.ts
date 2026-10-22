import { computed, type ComputedRef, type Ref } from "vue"
import type { DataGridCopyRange, DataGridFillBehavior } from "@affino/datagrid-vue/advanced"
import type { DataGridTableStageAnchorCell } from "./dataGridTableStage.types"

interface DataGridTableStageLastAppliedFillSession {
  previewRange: DataGridCopyRange
  behavior: DataGridFillBehavior
  allowBehaviorToggle: boolean
}

export interface UseDataGridTableStageFillActionOptions {
  lastAppliedFill: Ref<DataGridTableStageLastAppliedFillSession | null>
  selectionRange: ComputedRef<DataGridCopyRange | null>
  isFillDragging: Ref<boolean>
}

export interface UseDataGridTableStageFillActionResult {
  fillActionAnchorCell: ComputedRef<DataGridTableStageAnchorCell | null>
  fillActionBehavior: ComputedRef<DataGridFillBehavior | null>
}

export function useDataGridTableStageFillAction(
  options: UseDataGridTableStageFillActionOptions,
): UseDataGridTableStageFillActionResult {
  const fillActionAnchorCell = computed(() => {
    const session = options.lastAppliedFill.value
    const activeSelectionRange = options.selectionRange.value
    if (!session || !activeSelectionRange || options.isFillDragging.value) {
      return null
    }
    if (session.allowBehaviorToggle === false) {
      return null
    }
    if (
      session.previewRange.startRow !== activeSelectionRange.startRow
      || session.previewRange.endRow !== activeSelectionRange.endRow
      || session.previewRange.startColumn !== activeSelectionRange.startColumn
      || session.previewRange.endColumn !== activeSelectionRange.endColumn
    ) {
      return null
    }
    return {
      rowIndex: session.previewRange.endRow,
      columnIndex: session.previewRange.endColumn,
    }
  })

  const fillActionBehavior = computed(() => options.lastAppliedFill.value?.behavior ?? null)

  return {
    fillActionAnchorCell,
    fillActionBehavior,
  }
}