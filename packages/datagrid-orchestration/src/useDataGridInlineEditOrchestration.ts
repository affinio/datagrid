export type DataGridInlineEditorMode = "text" | "select"

export interface DataGridInlineEditorState<TColumnKey extends string> {
  rowId: string
  columnKey: TColumnKey
  draft: string
  mode: DataGridInlineEditorMode
}

export interface DataGridInlineEditTarget<TColumnKey extends string> {
  rowId: string
  columnKey: TColumnKey
}

export interface UseDataGridInlineEditOrchestrationOptions<
  TRow,
  TColumnKey extends string,
  TRange = unknown,
  TSnapshot = unknown,
> {
  sourceRows: () => readonly TRow[]
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
  getInlineEditor: () => DataGridInlineEditorState<TColumnKey> | null
  subscribeInlineEditor: (listener: (editor: DataGridInlineEditorState<TColumnKey> | null) => void) => () => void
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
  let inlineEditor: DataGridInlineEditorState<TColumnKey> | null = null
  const listeners = new Set<(editor: DataGridInlineEditorState<TColumnKey> | null) => void>()

  function setInlineEditor(next: DataGridInlineEditorState<TColumnKey> | null) {
    inlineEditor = next
    listeners.forEach(listener => listener(next))
  }

  function subscribeInlineEditor(listener: (editor: DataGridInlineEditorState<TColumnKey> | null) => void): () => void {
    listeners.add(listener)
    listener(inlineEditor)
    return () => {
      listeners.delete(listener)
    }
  }

  function isEditingCell(rowId: string, columnKey: string): boolean {
    return inlineEditor?.rowId === rowId && inlineEditor?.columnKey === columnKey
  }

  function isSelectEditorCell(rowId: string, columnKey: string): boolean {
    if (!isEditingCell(rowId, columnKey) || inlineEditor?.mode !== "select") {
      return false
    }
    return options.isSelectColumn ? options.isSelectColumn(columnKey) : true
  }

  function beginInlineEdit(
    row: TRow,
    columnKey: string,
    mode: DataGridInlineEditorMode = "text",
    openPicker = false,
  ): boolean {
    if (!options.isEditableColumn(columnKey)) {
      return false
    }
    const rowId = options.resolveRowId(row)
    setInlineEditor({
      rowId,
      columnKey,
      draft: String(options.resolveCellValue(row, columnKey) ?? ""),
      mode,
    })
    if (options.setLastAction) {
      const rowLabel = options.resolveRowLabel?.(row)
      options.setLastAction(
        mode === "select"
          ? `Selecting ${columnKey}${rowLabel ? ` for ${rowLabel}` : ""}`
          : `Editing ${columnKey}${rowLabel ? ` for ${rowLabel}` : ""}`,
      )
    }
    void options.focusInlineEditor?.(rowId, columnKey, mode, openPicker)
    return true
  }

  function cancelInlineEdit(): void {
    if (!inlineEditor) {
      return
    }
    setInlineEditor(null)
    options.setLastAction?.("Edit canceled")
  }

  function commitInlineEdit(): boolean {
    if (!inlineEditor) {
      return false
    }
    const editor = inlineEditor
    const beforeSnapshot = options.captureBeforeSnapshot?.()
    const nextDraft = editor.draft.trim()
    setInlineEditor(null)

    let updated = false
    const nextRows = options.sourceRows().map(row => {
      if (options.resolveRowId(row) !== editor.rowId) {
        return row
      }
      const nextRow = options.cloneRow(row)
      options.applyEditedValue(nextRow, editor.columnKey, nextDraft)
      options.finalizeEditedRow?.(nextRow, editor.columnKey, nextDraft)
      updated = true
      return nextRow
    })

    if (updated) {
      options.setSourceRows(nextRows)
      options.setLastAction?.(`Saved ${editor.columnKey}`)
      if (options.recordIntentTransaction && typeof beforeSnapshot !== "undefined") {
        const affectedRange = options.resolveAffectedRange
          ? options.resolveAffectedRange({ rowId: editor.rowId, columnKey: editor.columnKey })
          : null
        void options.recordIntentTransaction(
          {
            intent: "edit",
            label: `Edit ${editor.columnKey}`,
            affectedRange,
          },
          beforeSnapshot,
        )
      }
      return true
    }

    options.setLastAction?.("Edit target no longer available")
    return false
  }

  function updateEditorDraft(value: string): void {
    if (!inlineEditor) {
      return
    }
    setInlineEditor({
      ...inlineEditor,
      draft: value,
    })
  }

  function onEditorInput(event: Event): void {
    updateEditorDraft((event.target as HTMLInputElement).value)
  }

  function onEditorSelectChange(value: string | number): boolean {
    updateEditorDraft(String(value))
    return commitInlineEdit()
  }

  return {
    getInlineEditor: () => inlineEditor,
    subscribeInlineEditor,
    isEditingCell,
    isSelectEditorCell,
    beginInlineEdit,
    cancelInlineEdit,
    commitInlineEdit,
    updateEditorDraft,
    onEditorInput,
    onEditorSelectChange,
  }
}
