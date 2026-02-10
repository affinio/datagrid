import type { Ref } from "vue"
import type { DataGridSortDirection } from "@affino/datagrid-core"

interface EditableCellParams<TRow> {
  row: TRow
  rowIndex: number
  columnKey: string
  editable?: boolean
  value?: unknown
}

interface InlineEditorParams {
  rowKey: string
  columnKey: string
  commitOnBlur?: boolean
}

interface InlineEditSessionLike {
  draft: string
}

export interface UseAffinoDataGridBaseBindingsOptions<TRow> {
  resolveColumnSortDirection: (columnKey: string) => DataGridSortDirection | null
  toggleColumnSort: (columnKey: string) => void
  resolveRowKey: (row: TRow, index: number) => string
  isSelectedByKey: (rowKey: string) => boolean
  toggleSelectedByKey: (rowKey: string) => void
  selectOnlyRow: (rowKey: string) => void
  editingEnabled: Ref<boolean>
  beginEdit: (session: { rowKey: string; columnKey: string; draft: string }) => boolean
  resolveCellDraft: (params: { row: TRow; columnKey: string; value?: unknown }) => string
  isCellEditing: (rowKey: string, columnKey: string) => boolean
  activeSession: Ref<InlineEditSessionLike | null>
  updateDraft: (draft: string) => boolean
  cancelEdit: () => boolean
  commitEdit: () => Promise<boolean>
}

export interface UseAffinoDataGridBaseBindingsResult<TRow> {
  createHeaderSortBindings: (columnKey: string) => {
    role: "columnheader"
    tabindex: number
    "aria-sort": "none" | "ascending" | "descending"
    onClick: (event?: MouseEvent) => void
    onKeydown: (event: KeyboardEvent) => void
  }
  createRowSelectionBindings: (row: TRow, index: number) => {
    role: "row"
    tabindex: number
    "data-row-key": string
    "aria-selected": "true" | "false"
    onClick: (event?: MouseEvent) => void
    onKeydown: (event: KeyboardEvent) => void
  }
  createEditableCellBindings: (params: EditableCellParams<TRow>) => {
    "data-row-key": string
    "data-column-key": string
    "data-inline-editable": "true" | "false"
    onDblclick: (event?: MouseEvent) => void
    onKeydown: (event: KeyboardEvent) => void
  }
  createInlineEditorBindings: (params: InlineEditorParams) => {
    value: string
    onInput: (event: Event) => void
    onBlur: () => void
    onKeydown: (event: KeyboardEvent) => void
  }
}

function toAriaSortDirection(
  direction: DataGridSortDirection | null,
): "none" | "ascending" | "descending" {
  if (direction === "asc") {
    return "ascending"
  }
  if (direction === "desc") {
    return "descending"
  }
  return "none"
}

export function useAffinoDataGridBaseBindings<TRow>(
  options: UseAffinoDataGridBaseBindingsOptions<TRow>,
): UseAffinoDataGridBaseBindingsResult<TRow> {
  const createHeaderSortBindings = (columnKey: string) => ({
    role: "columnheader" as const,
    tabindex: 0,
    "aria-sort": toAriaSortDirection(options.resolveColumnSortDirection(columnKey)),
    onClick: (_event?: MouseEvent) => {
      options.toggleColumnSort(columnKey)
    },
    onKeydown: (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return
      }
      event.preventDefault()
      options.toggleColumnSort(columnKey)
    },
  })

  const createRowSelectionBindings = (row: TRow, index: number) => {
    const rowKey = options.resolveRowKey(row, index)
    return {
      role: "row" as const,
      tabindex: 0,
      "data-row-key": rowKey,
      "aria-selected": (options.isSelectedByKey(rowKey) ? "true" : "false") as "true" | "false",
      onClick: (event?: MouseEvent) => {
        const shouldToggle = Boolean(event?.metaKey || event?.ctrlKey)
        if (shouldToggle) {
          options.toggleSelectedByKey(rowKey)
          return
        }
        options.selectOnlyRow(rowKey)
      },
      onKeydown: (event: KeyboardEvent) => {
        if (event.key !== " " && event.key !== "Enter") {
          return
        }
        event.preventDefault()
        const shouldToggle = event.metaKey || event.ctrlKey
        if (shouldToggle) {
          options.toggleSelectedByKey(rowKey)
          return
        }
        options.selectOnlyRow(rowKey)
      },
    }
  }

  const createEditableCellBindings = (params: EditableCellParams<TRow>) => {
    const rowKey = options.resolveRowKey(params.row, params.rowIndex)
    const editable = params.editable ?? true
    const startEdit = (): void => {
      if (!editable || !options.editingEnabled.value) {
        return
      }
      options.beginEdit({
        rowKey,
        columnKey: params.columnKey,
        draft: options.resolveCellDraft({
          row: params.row,
          columnKey: params.columnKey,
          value: params.value,
        }),
      })
    }

    return {
      "data-row-key": rowKey,
      "data-column-key": params.columnKey,
      "data-inline-editable": editable ? ("true" as const) : ("false" as const),
      onDblclick: (_event?: MouseEvent) => {
        startEdit()
      },
      onKeydown: (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== "F2") {
          return
        }
        event.preventDefault()
        startEdit()
      },
    }
  }

  const createInlineEditorBindings = (params: InlineEditorParams) => ({
    value: options.isCellEditing(params.rowKey, params.columnKey)
      ? (options.activeSession.value?.draft ?? "")
      : "",
    onInput: (event: Event) => {
      const target = event.target as HTMLInputElement | null
      options.updateDraft(target?.value ?? "")
    },
    onBlur: () => {
      if (params.commitOnBlur === false) {
        return
      }
      void options.commitEdit()
    },
    onKeydown: (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        options.cancelEdit()
        return
      }
      if (event.key !== "Enter") {
        return
      }
      event.preventDefault()
      void options.commitEdit()
    },
  })

  return {
    createHeaderSortBindings,
    createRowSelectionBindings,
    createEditableCellBindings,
    createInlineEditorBindings,
  }
}
