import type { Ref } from "vue"
import type { DataGridColumnDef, DataGridSortDirection } from "@affino/datagrid-core"
import {
  useAffinoDataGridBaseBindings,
  type UseAffinoDataGridBaseBindingsResult,
} from "./useAffinoDataGridBaseBindings"
import {
  useAffinoDataGridContextMenuFeature,
  type UseAffinoDataGridContextMenuFeatureResult,
} from "./useAffinoDataGridContextMenuFeature"
import type {
  AffinoDataGridActionId,
  AffinoDataGridActionResult,
  AffinoDataGridEditMode,
  AffinoDataGridEditSession,
  AffinoDataGridRunActionOptions,
} from "../../useAffinoDataGrid.types"

export interface UseAffinoDataGridBindingSuiteOptions<TRow> {
  columns: Ref<readonly DataGridColumnDef[]>
  resolveRowKey: (row: TRow, index: number) => string
  resolveColumnSortDirection: (columnKey: string) => DataGridSortDirection | null
  toggleColumnSort: (columnKey: string, directionCycle?: readonly DataGridSortDirection[]) => void
  isSelectedByKey: (rowKey: string) => boolean
  toggleSelectedByKey: (rowKey: string) => void
  selectOnlyRow: (rowKey: string) => void
  editingEnabled: Ref<boolean>
  beginEdit: (session: Omit<AffinoDataGridEditSession, "mode"> & { mode?: AffinoDataGridEditMode }) => boolean
  resolveCellDraft: (params: { row: TRow; columnKey: string; value?: unknown }) => string
  isCellEditing: (rowKey: string, columnKey: string) => boolean
  activeSession: Ref<AffinoDataGridEditSession | null>
  updateDraft: (draft: string) => boolean
  cancelEdit: () => boolean
  commitEdit: () => Promise<boolean>
  runAction: (actionId: AffinoDataGridActionId, actionOptions?: AffinoDataGridRunActionOptions) => Promise<AffinoDataGridActionResult>
}

export type UseAffinoDataGridBindingSuiteResult<TRow> =
  & UseAffinoDataGridBaseBindingsResult<TRow>
  & UseAffinoDataGridContextMenuFeatureResult<
    TRow,
    AffinoDataGridActionId,
    AffinoDataGridActionResult
  >

export function useAffinoDataGridBindingSuite<TRow>(
  options: UseAffinoDataGridBindingSuiteOptions<TRow>,
): UseAffinoDataGridBindingSuiteResult<TRow> {
  const {
    createHeaderSortBindings,
    createRowSelectionBindings,
    createEditableCellBindings,
    createInlineEditorBindings,
  } = useAffinoDataGridBaseBindings({
    resolveColumnSortDirection: options.resolveColumnSortDirection,
    toggleColumnSort: options.toggleColumnSort,
    resolveRowKey: options.resolveRowKey,
    isSelectedByKey: options.isSelectedByKey,
    toggleSelectedByKey: options.toggleSelectedByKey,
    selectOnlyRow: options.selectOnlyRow,
    editingEnabled: options.editingEnabled,
    beginEdit: options.beginEdit,
    resolveCellDraft: options.resolveCellDraft,
    isCellEditing: options.isCellEditing,
    activeSession: options.activeSession,
    updateDraft: options.updateDraft,
    cancelEdit: options.cancelEdit,
    commitEdit: options.commitEdit,
  })

  const contextMenuFeature = useAffinoDataGridContextMenuFeature<
    TRow,
    AffinoDataGridActionId,
    AffinoDataGridActionResult
  >({
    columns: options.columns,
    resolveRowKey: options.resolveRowKey,
    createHeaderSortBindings,
    createEditableCellBindings,
    runAction: options.runAction,
  })

  return {
    createHeaderSortBindings,
    createRowSelectionBindings,
    createEditableCellBindings,
    createInlineEditorBindings,
    ...contextMenuFeature,
  }
}
