import { onBeforeUnmount, shallowRef, getCurrentInstance, type Ref } from "vue"
import {
  useDataGridInlineEditOrchestration as useDataGridInlineEditOrchestrationCore,
  type DataGridInlineEditorMode,
  type DataGridInlineEditorState,
  type DataGridInlineEditTarget,
} from "@affino/datagrid-orchestration"

export type {
  DataGridInlineEditorMode,
  DataGridInlineEditorState,
  DataGridInlineEditTarget,
}

export interface UseDataGridInlineEditOrchestrationOptions<
  TRow,
  TColumnKey extends string,
  TRange = unknown,
  TSnapshot = unknown,
> {
  sourceRows: Ref<readonly TRow[]>
  setSourceRows: (rows: readonly TRow[]) => void
  cloneRow: (row: TRow) => TRow
  resolveRowId: (row: TRow) => string
  resolveCellValue: (row: TRow, columnKey: string) => unknown
  isEditableColumn: (columnKey: string) => columnKey is TColumnKey
  isSelectColumn?: (columnKey: string) => boolean
  resolveRowLabel?: (row: TRow) => string
  applyEditedValue: (row: TRow, columnKey: TColumnKey, draft: string) => void
  finalizeEditedRow?: (row: TRow, columnKey: TColumnKey, draft: string) => void
  focusInlineEditor?: (
    rowId: string,
    columnKey: TColumnKey,
    mode: DataGridInlineEditorMode,
    openPicker: boolean,
  ) => void | Promise<void>
  setLastAction?: (message: string) => void
  captureBeforeSnapshot?: () => TSnapshot
  resolveAffectedRange?: (target: DataGridInlineEditTarget<TColumnKey>) => TRange | null
  recordIntentTransaction?: (
    descriptor: { intent: "edit"; label: string; affectedRange: TRange | null },
    beforeSnapshot: TSnapshot,
  ) => Promise<void>
}

export interface UseDataGridInlineEditOrchestrationResult<TRow, TColumnKey extends string> {
  inlineEditor: Ref<DataGridInlineEditorState<TColumnKey> | null>
  isEditingCell: (rowId: string, columnKey: string) => boolean
  isSelectEditorCell: (rowId: string, columnKey: string) => boolean
  beginInlineEdit: (
    row: TRow,
    columnKey: string,
    mode?: DataGridInlineEditorMode,
    openPicker?: boolean,
  ) => boolean
  cancelInlineEdit: () => void
  commitInlineEdit: () => boolean
  updateEditorDraft: (value: string) => void
  onEditorInput: (event: Event) => void
  onEditorSelectChange: (value: string | number) => boolean
}

export function useDataGridInlineEditOrchestration<
  TRow,
  TColumnKey extends string,
  TRange = unknown,
  TSnapshot = unknown,
>(
  options: UseDataGridInlineEditOrchestrationOptions<TRow, TColumnKey, TRange, TSnapshot>,
): UseDataGridInlineEditOrchestrationResult<TRow, TColumnKey> {
  const core = useDataGridInlineEditOrchestrationCore<TRow, TColumnKey, TRange, TSnapshot>({
    sourceRows: () => options.sourceRows.value,
    setSourceRows: options.setSourceRows,
    cloneRow: options.cloneRow,
    resolveRowId: options.resolveRowId,
    resolveCellValue: options.resolveCellValue,
    isEditableColumn: options.isEditableColumn,
    isSelectColumn: options.isSelectColumn,
    resolveRowLabel: options.resolveRowLabel,
    applyEditedValue: options.applyEditedValue,
    finalizeEditedRow: options.finalizeEditedRow,
    focusInlineEditor: options.focusInlineEditor,
    setLastAction: options.setLastAction,
    captureBeforeSnapshot: options.captureBeforeSnapshot,
    resolveAffectedRange: options.resolveAffectedRange,
    recordIntentTransaction: options.recordIntentTransaction,
  })

  const inlineEditor = shallowRef<DataGridInlineEditorState<TColumnKey> | null>(core.getInlineEditor())
  const unsubscribe = core.subscribeInlineEditor(nextEditor => {
    inlineEditor.value = nextEditor
  })

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      unsubscribe()
    })
  }

  return {
    inlineEditor,
    isEditingCell: core.isEditingCell,
    isSelectEditorCell: core.isSelectEditorCell,
    beginInlineEdit: core.beginInlineEdit,
    cancelInlineEdit: core.cancelInlineEdit,
    commitInlineEdit: core.commitInlineEdit,
    updateEditorDraft: core.updateEditorDraft,
    onEditorInput: core.onEditorInput,
    onEditorSelectChange: core.onEditorSelectChange,
  }
}
