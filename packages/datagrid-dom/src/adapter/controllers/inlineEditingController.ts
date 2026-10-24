import {
  validateDataGridCellDraftValue,
  type DataGridApi,
  type DataGridColumnModel,
} from "@affino/datagrid-core"
import type { DataGridDomCellCoord } from "./cellSelectionController.js"
import { createHistoryPatch, createHistorySnapshot, type DomHistoryIntent } from "./historyController.js"
import { createFilterableComboboxEditor, type FilterableComboboxEditorHandle } from "./filterableComboboxEditor.js"

interface ActiveEditor {
  input: HTMLInputElement
  rowId: string | number
  columnKey: string
  rowRevision: number | null
  detach: () => void
  finish: (commit: boolean, move?: EditNavigationTarget, restoreGridFocus?: boolean) => Promise<void>
}

type EditNavigationTarget = -1 | 0 | 1 | "next" | "previous"

export function createDomInlineEditingController<TRow>(options: {
  api: DataGridApi<TRow>
  columnModel: DataGridColumnModel
  grid: HTMLDivElement
  setCellSelection: (point: DataGridDomCellCoord, anchor: DataGridDomCellCoord, origin: string) => void
  revealCell: (rowIndex: number, columnIndex: number) => void
  updateView: () => void
  recordIntent: (intent: DomHistoryIntent<TRow>) => Promise<string | null>
}) {
  let activeEditor: ActiveEditor | null = null

  const beginCellEdit = (cell: HTMLElement, initialDraft?: string): boolean => {
    if (activeEditor || cell.querySelector(".affino-grid-dom__editor")) return false
    const rowIndex = Number(cell.dataset.rowIndex)
    const columnIndex = Number(cell.dataset.columnIndex)
    const row = options.api.rows.get(rowIndex)
    const column = options.columnModel.getSnapshot().visibleColumns[columnIndex]
    if (!row || !options.api.rows.hasPatchSupport() || !column || column.column.capabilities?.editable !== true) return false

    const resolved = options.api.cells.resolveValue({ rowId: row.rowId, columnKey: column.key, purpose: "source" })
    if (resolved.status !== "available" || resolved.writeTarget?.kind !== "row-patch") return false
    const writeKey = resolved.writeTarget.key
    const originalValue = resolved.sourceValue
    const optionSource = column.column.presentation?.options
    const isCombobox = optionSource != null
    const editorMode = isCombobox ? "combobox" : column.column.cellType ?? column.column.dataType
    let input = options.grid.ownerDocument.createElement("input")
    input.className = "affino-grid-dom__editor"
    input.setAttribute("aria-label", `Edit ${column.column.label ?? column.key}`)
    if (!isCombobox) {
      const isDate = editorMode === "date"
      const isDateTime = editorMode === "datetime"
      const isNumeric = editorMode === "number" || editorMode === "currency" || editorMode === "percent"
      input.type = isDate ? "date" : isDateTime ? "datetime-local" : "text"
      if (isDate || isDateTime) input.classList.add("affino-grid-dom__editor--date")
      if (isNumeric) input.inputMode = "decimal"
      input.value = initialDraft ?? resolveEditorInputValue(originalValue, editorMode)
    }
    let combobox: FilterableComboboxEditorHandle | null = null
    const resolveDraft = (): { valid: true; value: unknown } | { valid: false; reason: string } => {
      if (combobox) {
        if (combobox.loading || input.hasAttribute("aria-invalid")) {
          return { valid: false, reason: "invalid-options" }
        }
        return { valid: true, value: combobox.resolveValue() }
      }
      if (input.value === resolveEditorInputValue(originalValue, editorMode)) {
        return { valid: true, value: originalValue }
      }
      const validation = validateDataGridCellDraftValue({ column: column.column, row: row.row, draft: input.value })
      return validation.valid
        ? { valid: true, value: validation.value }
        : { valid: false, reason: validation.reason ?? "invalid-edit-draft" }
    }

    const clearValidationState = (): void => {
      input.removeAttribute("aria-invalid")
      input.removeAttribute("title")
      cell.classList.remove("affino-grid-dom__cell--invalid")
    }
    const onEditorInput = (): void => clearValidationState()

    let finished = false
    const finish = async (commit: boolean, move: EditNavigationTarget = 0, restoreGridFocus = true): Promise<void> => {
      if (finished) return
      const draft = resolveDraft()
      if (commit && !draft.valid) {
        const message = `Invalid ${draft.reason.replace(/^invalid-/, "")}`
        input.setAttribute("aria-invalid", "true")
        input.setAttribute("title", message)
        cell.classList.add("affino-grid-dom__cell--invalid")
        input.focus()
        return
      }
      finished = true
      detach()
      if (activeEditor?.input === input) activeEditor = null
      const beforeSelection = options.api.selection.getSnapshot()
      let commitPromise: Promise<void> = Promise.resolve()
      const draftValue = draft.valid ? draft.value : originalValue
      if (commit && !Object.is(draftValue, originalValue)) {
        const patch = {
          rowId: row.rowId,
          data: { [writeKey]: draftValue } as Partial<TRow>,
          previousData: { [writeKey]: resolved.sourceValue } as Partial<TRow>,
        }
        commitPromise = Promise.resolve(options.api.rows.applyEdits([patch], { source: "grid" }))
          .then(() => options.recordIntent({
            intent: "edit",
            label: "Edit cell",
            affectedRange: { startRow: rowIndex, endRow: rowIndex, startColumn: columnIndex, endColumn: columnIndex },
            before: createHistorySnapshot([
              createHistoryPatch(row.rowId, { [writeKey]: resolved.sourceValue } as Partial<TRow>),
            ], beforeSelection),
            after: createHistorySnapshot([
              createHistoryPatch(row.rowId, { [writeKey]: draftValue } as Partial<TRow>),
            ], options.api.selection.getSnapshot()),
          }))
          .then(() => undefined)
          .catch(() => options.updateView())
      } else {
        options.updateView()
      }
      if (commit && move !== 0) navigateAfterEdit(rowIndex, columnIndex, move)
      if (restoreGridFocus) options.grid.focus({ preventScroll: true })
      await commitPromise
    }
    const onBlur = (): void => { void finish(true, 0, false) }
    const onEditorKeyDown = (rawEvent: Event): void => {
      const event = rawEvent as KeyboardEvent
      if (event.isComposing || event.key === "Process" || event.keyCode === 229) return
      if (event.key === "Tab") {
        event.preventDefault()
        event.stopPropagation()
        void finish(true, event.shiftKey ? "previous" : "next")
      } else if (event.key === "Enter") {
        event.preventDefault()
        event.stopPropagation()
        void finish(true, event.shiftKey ? -1 : 1)
      } else if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        void finish(false)
      }
    }
    const detach = (): void => {
      combobox?.dispose()
      input.removeEventListener("blur", onBlur)
      input.removeEventListener("keydown", onEditorKeyDown)
      input.removeEventListener("input", onEditorInput)
    }
    if (isCombobox) {
      let source: unknown
      try {
        source = typeof optionSource === "function" ? optionSource(row.row) : optionSource
      } catch {
        source = Promise.reject(new Error("options-load-failed"))
      }
      combobox = createFilterableComboboxEditor({
        cell,
        grid: options.grid,
        value: originalValue,
        source,
        commit: (_value, target) => { void finish(true, target === "stay" ? 0 : target) },
        cancel: () => { void finish(false) },
      })
      input = combobox.input
      input.setAttribute("aria-label", `Edit ${column.column.label ?? column.key}`)
    } else {
      cell.replaceChildren(input)
    }
    activeEditor = {
      input,
      rowId: row.rowId,
      columnKey: column.key,
      rowRevision: options.api.rows.getSnapshot().revision ?? null,
      detach,
      finish,
    }
    input.addEventListener("blur", onBlur)
    if (!isCombobox) input.addEventListener("keydown", onEditorKeyDown)
    if (!isCombobox) input.addEventListener("input", onEditorInput)
    if (!isCombobox && (input.type === "date" || input.type === "datetime-local")) {
      try {
        input.showPicker()
      } catch {
        // Keep focus when the browser blocks opening a native picker.
      }
    } else if (!isCombobox && input.type === "text") {
      input.focus()
      const caretPosition = input.value.length
      input.setSelectionRange(caretPosition, caretPosition)
    }
    return true
  }

  function navigateAfterEdit(rowIndex: number, columnIndex: number, target: EditNavigationTarget): void {
    if (target === "next" || target === "previous") {
      const adjacent = resolveAdjacentEditableCell(rowIndex, columnIndex, target === "next" ? 1 : -1)
      if (!adjacent) return
      options.setCellSelection(adjacent, adjacent, "datagrid-dom-inline-edit-tab-navigation")
      options.revealCell(adjacent.rowIndex, adjacent.colIndex)
      return
    }
    const rowCount = options.api.rows.getCount()
    const columnCount = options.columnModel.getSnapshot().visibleColumns.length
    if (rowCount === 0 || columnCount === 0) return
    const targetRowIndex = Math.max(0, Math.min(rowCount - 1, rowIndex + target))
    const targetColumnIndex = Math.max(0, Math.min(columnCount - 1, columnIndex))
    const targetRow = options.api.rows.get(targetRowIndex)
    if (!targetRow) return
    const nextCell = { rowIndex: targetRowIndex, colIndex: targetColumnIndex, rowId: targetRow.rowId }
    options.setCellSelection(nextCell, nextCell, "datagrid-dom-inline-edit-navigation")
    options.revealCell(targetRowIndex, targetColumnIndex)
  }

  function resolveAdjacentEditableCell(
    rowIndex: number,
    columnIndex: number,
    direction: -1 | 1,
  ): DataGridDomCellCoord | null {
    const columns = options.columnModel.getSnapshot().visibleColumns
    const rowCount = options.api.rows.getCount()
    for (let candidateRowIndex = rowIndex; candidateRowIndex >= 0 && candidateRowIndex < rowCount; candidateRowIndex += direction) {
      const startColumn = candidateRowIndex === rowIndex
        ? columnIndex + direction
        : direction > 0 ? 0 : columns.length - 1
      for (let candidateColumnIndex = startColumn;
        candidateColumnIndex >= 0 && candidateColumnIndex < columns.length;
        candidateColumnIndex += direction) {
        const row = options.api.rows.get(candidateRowIndex)
        const column = columns[candidateColumnIndex]
        if (!row || row.kind === "group" || !column || column.column.capabilities?.editable !== true) continue
        const source = options.api.cells.resolveValue({ rowId: row.rowId, columnKey: column.key, purpose: "source" })
        if (source.status !== "available" || source.writeTarget?.kind !== "row-patch") continue
        return { rowIndex: candidateRowIndex, colIndex: candidateColumnIndex, rowId: row.rowId }
      }
    }
    return null
  }

  const onCellDoubleClick = (event: MouseEvent): void => {
    const target = event.target as Element | null
    const cell = target?.closest?.(".affino-grid-dom__cell[data-row-index][data-column-index]") as HTMLElement | null
    if (cell && beginCellEdit(cell)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const onCellClick = (event: MouseEvent): void => {
    const target = event.target as Element | null
    const cell = target?.closest?.(".affino-grid-dom__cell--combobox[data-row-index][data-column-index]") as HTMLElement | null
    if (!cell || activeEditor) return
    const rect = cell.getBoundingClientRect()
    if (rect.width <= 0 || rect.right - event.clientX > 28) return
    if (beginCellEdit(cell)) event.preventDefault()
  }

  const tryStartFromKey = (event: KeyboardEvent): boolean => {
    if (event.isComposing || event.key === "Process" || event.keyCode === 229) return false
    if (!options.api.selection.hasSupport()) return false
    const activeCell = options.api.selection.getSnapshot()?.activeCell
    if (!activeCell) return false
    const column = options.columnModel.getSnapshot().visibleColumns[activeCell.colIndex]
    if (column?.column.presentation?.options) {
      if (event.key !== "Enter" && event.key !== "F2") return false
      const selectCell = options.grid.querySelector<HTMLElement>(
        `[data-row-index="${activeCell.rowIndex}"][data-column-index="${activeCell.colIndex}"]`,
      )
      if (!selectCell || !beginCellEdit(selectCell)) return false
      event.preventDefault()
      event.stopPropagation()
      return true
    }
    if (
      event.key.length !== 1
      || event.ctrlKey
      || event.metaKey
      || event.altKey
    ) return false
    const cell = options.grid.querySelector<HTMLElement>(
      `[data-row-index="${activeCell.rowIndex}"][data-column-index="${activeCell.colIndex}"]`,
    )
    const dateMode = column?.column.cellType === "date" || column?.column.dataType === "date"
      || column?.column.cellType === "datetime" || column?.column.dataType === "datetime"
    if (!cell || !beginCellEdit(cell, dateMode ? undefined : event.key)) return false
    event.preventDefault()
    event.stopPropagation()
    return true
  }

  const unsubscribeRowsChanged = options.api.events.on("rows:changed", event => {
    const editor = activeEditor
    if (!editor) return
    const currentRevision = event.snapshot.revision ?? null
    const target = options.api.rows.resolveById(editor.rowId)
    if (target.status !== "loaded" || currentRevision !== editor.rowRevision) {
      void editor.finish(false)
    }
  })
  const unsubscribeColumnsChanged = options.api.events.on("columns:changed", event => {
    const editor = activeEditor
    if (!editor) return
    const current = event.snapshot.byKey[editor.columnKey]
    if (!current?.visible || !event.snapshot.visibleColumns.some(column => column.key === editor.columnKey)) {
      void editor.finish(false)
    }
  })

  return {
    onCellDoubleClick,
    onCellClick,
    tryStartFromKey,
    async commitActiveEdit(): Promise<void> {
      const editor = activeEditor
      if (!editor) return
      await editor.finish(true, 0, false)
    },
    dispose() {
      unsubscribeRowsChanged()
      unsubscribeColumnsChanged()
      activeEditor?.detach()
      activeEditor = null
    },
  }

}

function resolveEditorInputValue(value: unknown, editorMode: unknown): string {
  if (value == null || value === "") return ""
  if (editorMode !== "date" && editorMode !== "datetime") return String(value)
  const date = value instanceof Date ? value : new Date(String(value))
  if (!Number.isFinite(date.getTime())) return ""
  if (editorMode === "date") return date.toISOString().slice(0, 10)
  const pad = (part: number): string => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
