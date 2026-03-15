import { nextTick, ref, type Ref } from "vue"
import {
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

type DataGridAppInlineEditCommitTarget = "stay" | "next" | "previous"

interface DataGridAppInlineEditStartOptions {
  draftValue?: string
  openOnMount?: boolean
}

export interface UseDataGridAppInlineEditingOptions<TRow, TSnapshot> {
  mode: Ref<DataGridAppMode>
  bodyViewportRef: Ref<HTMLElement | null>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  totalRows: Ref<number>
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api">
  readCell: (row: DataGridRowNode<TRow>, columnKey: string) => string
  resolveRowIndexById: (rowId: string | number) => number
  applyCellSelection: (coord: DataGridAppEditingCoord) => void
  ensureActiveCellVisible: (rowIndex: number, columnIndex: number) => void
  isCellEditable: (
    row: DataGridRowNode<TRow>,
    rowIndex: number,
    columnKey: string,
    columnIndex: number,
  ) => boolean
  captureRowsSnapshot: () => TSnapshot
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

  const focusInlineEditor = (): void => {
    void nextTick(() => {
      const applyFocus = (): void => {
        const editor = options.bodyViewportRef.value?.querySelector<HTMLInputElement | HTMLSelectElement>(
          ".cell-editor-control",
        )
        if (!editor) {
          return
        }
        editor.focus({ preventScroll: true })
        if (editor instanceof HTMLInputElement) {
          const caretPosition = editor.value.length
          editor.setSelectionRange(caretPosition, caretPosition)
          return
        }
        if (editor instanceof HTMLSelectElement && typeof editor.showPicker === "function") {
          editor.showPicker()
        }
      }
      applyFocus()
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          applyFocus()
        })
      }
    })
  }

  const clearInlineEdit = (): void => {
    editingCell.value = null
    editingCellValue.value = ""
    editingCellInitialFilter.value = ""
    editingCellOpenOnMount.value = false
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
    const currentRowIndex = options.resolveRowIndexById(rowId)
    if (currentRowIndex < 0) {
      return
    }
    const maxRowIndex = Math.max(0, options.totalRows.value - 1)
    const nextRowIndex = target === "next"
      ? Math.min(maxRowIndex, currentRowIndex + 1)
      : target === "previous"
        ? Math.max(0, currentRowIndex - 1)
        : currentRowIndex
    const nextRowId = options.runtime.api.rows.get(nextRowIndex)?.rowId
    if (nextRowId == null) {
      return
    }
    options.applyCellSelection({
      rowIndex: nextRowIndex,
      columnIndex,
      rowId: nextRowId,
    })
    void nextTick(() => {
      options.ensureActiveCellVisible(nextRowIndex, columnIndex)
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
    const rowIndex = options.resolveRowIndexById(row.rowId)
    const columnIndex = options.visibleColumns.value.findIndex(column => column.key === columnKey)
    if (rowIndex < 0 || columnIndex < 0 || !options.isCellEditable(row, rowIndex, columnKey, columnIndex)) {
      return
    }
    editingCell.value = {
      rowId: row.rowId,
      columnKey,
    }
    editingCellValue.value = startOptions.draftValue ?? options.readCell(row, columnKey)
    editingCellInitialFilter.value = startOptions.draftValue ?? ""
    editingCellOpenOnMount.value = startOptions.openOnMount === true
    focusInlineEditor()
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
    const beforeSnapshot = options.captureRowsSnapshot()
    const rowIndex = options.resolveRowIndexById(currentEditingCell.rowId)
    const rowNode = rowIndex >= 0 ? options.runtime.api.rows.get(rowIndex) : null
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
    focusAfterInlineEdit(currentEditingCell.rowId, currentEditingCell.columnKey, target)
  }

  const cancelInlineEdit = (): void => {
    const currentEditingCell = editingCell.value
    clearInlineEdit()
    if (!currentEditingCell) {
      return
    }
    focusAfterInlineEdit(currentEditingCell.rowId, currentEditingCell.columnKey, "stay")
  }

  const handleEditorKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      event.preventDefault()
      commitInlineEdit(event.shiftKey ? "previous" : "next")
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
    commitInlineEdit,
    cancelInlineEdit,
    handleEditorKeydown,
  }
}
