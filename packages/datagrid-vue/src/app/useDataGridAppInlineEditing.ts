import { nextTick, ref, type Ref } from "vue"
import {
  buildDataGridCellRenderModel,
  parseDataGridCellDraftValue,
  type DataGridColumnSnapshot,
  type DataGridRowNode,
} from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import type { DataGridAppMode } from "./useDataGridAppControls"

interface DataGridAppEditingCell {
  rowId: string | number
  columnKey: string
}

interface DataGridAppEditingCoord {
  rowIndex: number
  columnIndex: number
  rowId: string | number
}

type DataGridAppInlineEditCommitTarget = "stay" | "next" | "previous" | "below" | "above"

interface DataGridAppInlineEditStartOptions {
  draftValue?: string
  openOnMount?: boolean
}

export interface UseDataGridAppInlineEditingOptions<TRow, TSnapshot> {
  mode: Ref<DataGridAppMode>
  bodyViewportRef: Ref<HTMLElement | null>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  totalRows: Ref<number>
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api" | "getBodyRowAtIndex">
  readCell: (row: DataGridRowNode<TRow>, columnKey: string) => string
  resolveBodyRowIndexById?: (rowId: string | number) => number
  resolveRowIndexById?: (rowId: string | number) => number
  applyCellSelection: (coord: DataGridAppEditingCoord) => void
  ensureActiveCellVisible: (rowIndex: number, columnIndex: number) => void
  isCellEditable: (
    row: DataGridRowNode<TRow>,
    rowIndex: number,
    columnKey: string,
    columnIndex: number,
  ) => boolean
  captureRowsSnapshot: () => TSnapshot
  captureRowsSnapshotForRowIds?: (rowIds: readonly (string | number)[]) => TSnapshot
  recordEditTransaction: (beforeSnapshot: TSnapshot) => void
}

export interface UseDataGridAppInlineEditingResult<TRow> {
  editingCell: Ref<DataGridAppEditingCell | null>
  editingCellValue: Ref<string>
  editingCellInitialFilter: Ref<string>
  editingCellOpenOnMount: Ref<boolean>
  isEditingCell: (row: DataGridRowNode<TRow>, columnKey: string) => boolean
  startInlineEdit: (
    row: DataGridRowNode<TRow>,
    columnKey: string,
    options?: DataGridAppInlineEditStartOptions,
  ) => void
  appendInlineEditTextInput: (value: string) => boolean
  handleEditorBlur: () => void
  commitInlineEdit: (targetOrEvent?: DataGridAppInlineEditCommitTarget | boolean | FocusEvent) => void
  cancelInlineEdit: () => void
  handleEditorKeydown: (event: KeyboardEvent) => void
}

export function useDataGridAppInlineEditing<TRow, TSnapshot>(
  options: UseDataGridAppInlineEditingOptions<TRow, TSnapshot>,
): UseDataGridAppInlineEditingResult<TRow> {
  const editingCell = ref<DataGridAppEditingCell | null>(null)
  const editingCellValue = ref("")
  const editingCellInitialFilter = ref("")
  const editingCellOpenOnMount = ref(false)
  const editingCellEditorMode = ref<"none" | "text" | "select" | "date" | "datetime">("none")
  const suppressNextBlurCommit = ref(false)
  const resolveBodyRowIndexById = options.resolveBodyRowIndexById ?? options.resolveRowIndexById ?? (() => -1)
  const getBodyRowAtIndex = (rowIndex: number): DataGridRowNode<TRow> | null => {
    const runtime = options.runtime as typeof options.runtime & {
      getBodyRowAtIndex?: (index: number) => DataGridRowNode<TRow> | null
    }
    return runtime.getBodyRowAtIndex?.(rowIndex) ?? options.runtime.api.rows.get(rowIndex) ?? null
  }

  const readEditorSourceValue = (row: DataGridRowNode<TRow>, column: DataGridColumnSnapshot): unknown => {
    if (row.kind === "group") {
      return undefined
    }
    if (typeof column.column.accessor === "function") {
      return column.column.accessor(row.data)
    }
    if (typeof column.column.valueGetter === "function") {
      return column.column.valueGetter(row.data)
    }
    const field = typeof column.column.field === "string" && column.column.field.length > 0
      ? column.column.field
      : column.key
    return (row.data as Record<string, unknown>)[field]
  }

  const padDateEditorPart = (value: number): string => String(value).padStart(2, "0")

  const formatLocalDateTimeDraft = (date: Date): string => {
    const year = date.getFullYear()
    const month = padDateEditorPart(date.getMonth() + 1)
    const day = padDateEditorPart(date.getDate())
    const hours = padDateEditorPart(date.getHours())
    const minutes = padDateEditorPart(date.getMinutes())
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const normalizeTemporalEditorDraft = (value: unknown, includeTime: boolean): string => {
    if (value == null || value === "") {
      return ""
    }
    if (value instanceof Date) {
      if (!Number.isFinite(value.getTime())) {
        return ""
      }
      return includeTime ? formatLocalDateTimeDraft(value) : value.toISOString().slice(0, 10)
    }
    const stringValue = String(value).trim()
    if (stringValue.length === 0) {
      return ""
    }
    if (!includeTime && /^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
      return stringValue
    }
    if (includeTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(stringValue)) {
      return stringValue
    }
    const timestamp = Date.parse(stringValue)
    if (!Number.isFinite(timestamp)) {
      return ""
    }
    const date = new Date(timestamp)
    return includeTime ? formatLocalDateTimeDraft(date) : date.toISOString().slice(0, 10)
  }

  const tryShowNativePicker = (editor: HTMLInputElement | HTMLSelectElement): void => {
    if (typeof editor.showPicker !== "function") {
      return
    }
    try {
      editor.showPicker()
    }
    catch {
      // Browsers can require a direct user gesture for showPicker; focus should still succeed.
    }
  }

  const resolveEditorSearchRoot = (): ParentNode | null => {
    const viewport = options.bodyViewportRef.value
    if (!viewport) {
      return null
    }
    const stageRoot = viewport.closest(".grid-stage")
    return stageRoot ?? viewport
  }

  const resolveActiveInlineEditor = (): HTMLInputElement | HTMLSelectElement | null => {
    const root = resolveEditorSearchRoot()
    if (!root) {
      return null
    }
    const currentEditingCell = editingCell.value
    if (!currentEditingCell) {
      return root.querySelector<HTMLInputElement | HTMLSelectElement>(".cell-editor-control")
    }
    const editors = root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(".cell-editor-control")
    const editingRowId = String(currentEditingCell.rowId)
    for (const editor of editors) {
      const hostCell = editor.closest<HTMLElement>(".grid-cell")
      if (
        hostCell?.dataset.rowId === editingRowId
        && hostCell.dataset.columnKey === currentEditingCell.columnKey
      ) {
        return editor
      }
    }
    return root.querySelector<HTMLInputElement | HTMLSelectElement>(".cell-editor-control")
  }

  const focusInlineEditor = (): void => {
    void nextTick(() => {
      const applyFocus = (): void => {
        const editor = resolveActiveInlineEditor()
        if (!editor) {
          return
        }
        editor.focus({ preventScroll: true })
        if (editor instanceof HTMLInputElement) {
          if (editor.type === "date" || editor.type === "datetime-local") {
            tryShowNativePicker(editor)
            return
          }
          const caretPosition = editor.value.length
          editor.setSelectionRange(caretPosition, caretPosition)
          return
        }
        if (editor instanceof HTMLSelectElement) {
          tryShowNativePicker(editor)
        }
      }
      applyFocus()
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          applyFocus()
          window.requestAnimationFrame(() => {
            applyFocus()
          })
        })
        window.setTimeout(() => {
          applyFocus()
        }, 0)
      }
    })
  }

  const clearInlineEdit = (): void => {
    editingCell.value = null
    editingCellValue.value = ""
    editingCellInitialFilter.value = ""
    editingCellOpenOnMount.value = false
    editingCellEditorMode.value = "none"
  }

  const focusAfterInlineEdit = (
    rowId: string | number,
    columnKey: string,
    target: DataGridAppInlineEditCommitTarget,
  ): void => {
    const columnIndex = options.visibleColumns.value.findIndex(column => column.key === columnKey)
    if (columnIndex < 0) {
      return
    }
    const currentRowIndex = resolveBodyRowIndexById(rowId)
    if (currentRowIndex < 0) {
      return
    }
    const resolveAdjacentEditableCoord = (
      direction: 1 | -1,
    ): DataGridAppEditingCoord | null => {
      const columnCount = options.visibleColumns.value.length
      if (columnCount === 0) {
        return null
      }
      if (direction > 0) {
        for (let rowIndex = currentRowIndex; rowIndex < options.totalRows.value; rowIndex += 1) {
          const startColumnIndex = rowIndex === currentRowIndex ? columnIndex + 1 : 0
          const row = getBodyRowAtIndex(rowIndex)
          if (!row) {
            continue
          }
          for (let candidateColumnIndex = startColumnIndex; candidateColumnIndex < columnCount; candidateColumnIndex += 1) {
            const candidateColumnKey = options.visibleColumns.value[candidateColumnIndex]?.key
            if (
              candidateColumnKey
              && options.isCellEditable(row, rowIndex, candidateColumnKey, candidateColumnIndex)
            ) {
              return {
                rowIndex,
                columnIndex: candidateColumnIndex,
                rowId: row.rowId,
              }
            }
          }
        }
        return null
      }
      for (let rowIndex = currentRowIndex; rowIndex >= 0; rowIndex -= 1) {
        const startColumnIndex = rowIndex === currentRowIndex ? columnIndex - 1 : columnCount - 1
        const row = getBodyRowAtIndex(rowIndex)
        if (!row) {
          continue
        }
        for (let candidateColumnIndex = startColumnIndex; candidateColumnIndex >= 0; candidateColumnIndex -= 1) {
          const candidateColumnKey = options.visibleColumns.value[candidateColumnIndex]?.key
          if (
            candidateColumnKey
            && options.isCellEditable(row, rowIndex, candidateColumnKey, candidateColumnIndex)
          ) {
            return {
              rowIndex,
              columnIndex: candidateColumnIndex,
              rowId: row.rowId,
            }
          }
        }
      }
      return null
    }
    const maxRowIndex = Math.max(0, options.totalRows.value - 1)
    const nextCoord = target === "next"
      ? resolveAdjacentEditableCoord(1)
      : target === "previous"
        ? resolveAdjacentEditableCoord(-1)
        : target === "below"
          ? {
            rowIndex: Math.min(maxRowIndex, currentRowIndex + 1),
            columnIndex,
            rowId: getBodyRowAtIndex(Math.min(maxRowIndex, currentRowIndex + 1))?.rowId ?? rowId,
          }
          : target === "above"
            ? {
              rowIndex: Math.max(0, currentRowIndex - 1),
              columnIndex,
              rowId: getBodyRowAtIndex(Math.max(0, currentRowIndex - 1))?.rowId ?? rowId,
            }
            : {
              rowIndex: currentRowIndex,
              columnIndex,
              rowId,
            }
    if (nextCoord?.rowId == null) {
      return
    }
    options.applyCellSelection({
      rowIndex: nextCoord.rowIndex,
      columnIndex: nextCoord.columnIndex,
      rowId: nextCoord.rowId,
    })
    void nextTick(() => {
      options.ensureActiveCellVisible(nextCoord.rowIndex, nextCoord.columnIndex)
    })
  }

  const startInlineEdit = (
    row: DataGridRowNode<TRow>,
    columnKey: string,
    startOptions: DataGridAppInlineEditStartOptions = {},
  ): void => {
    if (options.mode.value !== "base" || row.kind === "group" || row.rowId == null) {
      return
    }
    const rowIndex = resolveBodyRowIndexById(row.rowId)
    const columnIndex = options.visibleColumns.value.findIndex(column => column.key === columnKey)
    if (rowIndex < 0 || columnIndex < 0 || !options.isCellEditable(row, rowIndex, columnKey, columnIndex)) {
      return
    }
    const columnSnapshot = options.visibleColumns.value[columnIndex]
    const editorMode = columnSnapshot
      ? buildDataGridCellRenderModel({
        column: columnSnapshot.column,
        row: row.data,
        editable: true,
      }).editorMode
      : "text"
    const initialDraftValue = (editorMode === "date" || editorMode === "datetime") && columnSnapshot
      ? normalizeTemporalEditorDraft(readEditorSourceValue(row, columnSnapshot), editorMode === "datetime")
      : (startOptions.draftValue ?? options.readCell(row, columnKey))
    editingCell.value = {
      rowId: row.rowId,
      columnKey,
    }
    editingCellValue.value = initialDraftValue
    editingCellInitialFilter.value = editorMode === "date" || editorMode === "datetime"
      ? ""
      : (startOptions.draftValue ?? "")
    editingCellOpenOnMount.value = startOptions.openOnMount === true
    editingCellEditorMode.value = editorMode
    suppressNextBlurCommit.value = false
    focusInlineEditor()
  }

  const appendInlineEditTextInput = (value: string): boolean => {
    if (!editingCell.value || value.length === 0) {
      return false
    }
    if (
      editingCellEditorMode.value === "none"
      || editingCellEditorMode.value === "date"
      || editingCellEditorMode.value === "datetime"
    ) {
      return false
    }
    if (editingCellEditorMode.value === "select") {
      editingCellInitialFilter.value += value
      focusInlineEditor()
      return true
    }
    editingCellValue.value += value
    focusInlineEditor()
    return true
  }

  const commitInlineEdit = (
    targetOrEvent: DataGridAppInlineEditCommitTarget | boolean | FocusEvent = "stay",
  ): void => {
    const currentEditingCell = editingCell.value
    if (!currentEditingCell) {
      return
    }
    const target = typeof targetOrEvent === "string"
      ? targetOrEvent
      : typeof targetOrEvent === "boolean"
        ? (targetOrEvent ? "next" : "stay")
        : "stay"
    const beforeSnapshot = options.captureRowsSnapshotForRowIds?.([currentEditingCell.rowId])
      ?? options.captureRowsSnapshot()
    const rowIndex = resolveBodyRowIndexById(currentEditingCell.rowId)
    const rowNode = rowIndex >= 0 ? getBodyRowAtIndex(rowIndex) : null
    const columnSnapshot = options.visibleColumns.value.find(column => column.key === currentEditingCell.columnKey)
    const parsedValue = columnSnapshot
      ? parseDataGridCellDraftValue({
        column: columnSnapshot.column,
        row: rowNode && rowNode.kind !== "group" ? rowNode.data : undefined,
        draft: editingCellValue.value,
      })
      : editingCellValue.value
    options.runtime.api.rows.applyEdits([
      {
        rowId: currentEditingCell.rowId,
        data: {
          [currentEditingCell.columnKey]: parsedValue,
        } as Partial<TRow>,
      },
    ])
    options.recordEditTransaction(beforeSnapshot)
    clearInlineEdit()
    suppressNextBlurCommit.value = false
    focusAfterInlineEdit(currentEditingCell.rowId, currentEditingCell.columnKey, target)
  }

  const cancelInlineEdit = (): void => {
    const currentEditingCell = editingCell.value
    suppressNextBlurCommit.value = true
    clearInlineEdit()
    if (!currentEditingCell) {
      return
    }
    focusAfterInlineEdit(currentEditingCell.rowId, currentEditingCell.columnKey, "stay")
  }

  const handleEditorBlur = (): void => {
    if (suppressNextBlurCommit.value) {
      suppressNextBlurCommit.value = false
      return
    }
    commitInlineEdit()
  }

  const handleEditorKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Tab") {
      event.preventDefault()
      commitInlineEdit(event.shiftKey ? "previous" : "next")
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      commitInlineEdit(event.shiftKey ? "above" : "below")
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      cancelInlineEdit()
    }
  }

  const isEditingCell = (row: DataGridRowNode<TRow>, columnKey: string): boolean => {
    return editingCell.value?.rowId === row.rowId && editingCell.value?.columnKey === columnKey
  }

  return {
    editingCell,
    editingCellValue,
    editingCellInitialFilter,
    editingCellOpenOnMount,
    isEditingCell,
    startInlineEdit,
    appendInlineEditTextInput,
    commitInlineEdit,
    cancelInlineEdit,
    handleEditorKeydown,
    handleEditorBlur,
  }
}
