export interface UseDataGridInlineEditorKeyRouterOptions<TTarget = unknown> {
  isEditableColumn: (columnKey: string) => boolean
  cancelInlineEdit: () => void
  commitInlineEdit: () => boolean
  resolveNextEditableTarget: (rowId: string, columnKey: string, direction: 1 | -1) => TTarget | null
  focusInlineEditorTarget: (target: TTarget) => void
}

export interface UseDataGridInlineEditorKeyRouterResult {
  dispatchEditorKeyDown: (event: KeyboardEvent, rowId: string, columnKey: string) => boolean
}

export function useDataGridInlineEditorKeyRouter<TTarget = unknown>(
  options: UseDataGridInlineEditorKeyRouterOptions<TTarget>,
): UseDataGridInlineEditorKeyRouterResult {
  function dispatchEditorKeyDown(event: KeyboardEvent, rowId: string, columnKey: string): boolean {
    if (!options.isEditableColumn(columnKey)) {
      return false
    }

    if (event.key === "Escape") {
      event.preventDefault()
      options.cancelInlineEdit()
      return true
    }

    if (event.key === "Enter") {
      event.preventDefault()
      options.commitInlineEdit()
      return true
    }

    if (event.key === "Tab") {
      event.preventDefault()
      const direction: 1 | -1 = event.shiftKey ? -1 : 1
      const target = options.resolveNextEditableTarget(rowId, columnKey, direction)
      options.commitInlineEdit()
      if (target) {
        options.focusInlineEditorTarget(target)
      }
      return true
    }

    return false
  }

  return {
    dispatchEditorKeyDown,
  }
}
