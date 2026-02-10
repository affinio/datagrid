import type { DataGridSortState } from "@affino/datagrid-core"
import { useAffinoDataGridSortingFeature } from "./useAffinoDataGridSortingFeature"
import {
  useAffinoDataGridActionRunner,
  type AffinoDataGridInternalActionId,
} from "./useAffinoDataGridActionRunner"
import type {
  AffinoDataGridActionId,
  AffinoDataGridActionResult,
  AffinoDataGridRunActionOptions,
} from "../../useAffinoDataGrid.types"

export interface UseAffinoDataGridSortActionSuiteOptions<TRow> {
  initialSortState?: readonly DataGridSortState[]
  onSortModelChange: (nextSortState: readonly DataGridSortState[]) => void
  selectedRowKeySet: { value: Set<string> }
  clearSelection: () => void
  selectAllRows: () => number
  resolveSelectedRows: () => readonly TRow[]
  copySelectedRows: () => Promise<boolean>
  cutSelectedRows: () => Promise<number>
  pasteRowsAppend: () => Promise<number>
  clearSelectedRows: () => Promise<number>
}

export function useAffinoDataGridSortActionSuite<TRow>(
  options: UseAffinoDataGridSortActionSuiteOptions<TRow>,
) {
  const {
    sortState,
    setSortState,
    toggleColumnSort,
    clearSort,
    resolveColumnSortDirection,
  } = useAffinoDataGridSortingFeature({
    initialSortState: options.initialSortState,
    onSortModelChange: options.onSortModelChange,
  })

  const { runAction: runActionInternal } = useAffinoDataGridActionRunner({
    selectedRowKeySet: options.selectedRowKeySet,
    clearSelection: options.clearSelection,
    selectAllRows: options.selectAllRows,
    resolveSelectedRows: options.resolveSelectedRows,
    copySelectedRows: options.copySelectedRows,
    cutSelectedRows: options.cutSelectedRows,
    pasteRowsAppend: options.pasteRowsAppend,
    clearSelectedRows: options.clearSelectedRows,
    setSortState,
    clearSort,
  })

  const runAction = (
    actionId: AffinoDataGridActionId,
    actionOptions: AffinoDataGridRunActionOptions = {},
  ): Promise<AffinoDataGridActionResult> => {
    return runActionInternal(
      actionId as AffinoDataGridInternalActionId,
      actionOptions,
    )
  }

  return {
    sortState,
    setSortState,
    toggleColumnSort,
    clearSort,
    resolveColumnSortDirection,
    runAction,
  }
}
