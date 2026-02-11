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
  resolveColumnOrder: () => readonly string[]
  setColumnOrder: (keys: readonly string[]) => void
  resolveRowOrder: () => readonly string[]
  moveRowByKey: (
    sourceRowKey: string,
    targetRowKey: string,
    position?: "before" | "after",
  ) => Promise<boolean> | boolean
  canReorderRows: () => boolean
}

export interface HeaderReorderBindings {
  draggable: true
  "data-column-key": string
  onDragstart: (event: DragEvent) => void
  onDragover: (event: DragEvent) => void
  onDrop: (event: DragEvent) => void
  onDragend: (event?: DragEvent) => void
  onKeydown: (event: KeyboardEvent) => void
}

export interface RowReorderBindings {
  draggable: true
  "data-row-key": string
  onDragstart: (event: DragEvent) => void
  onDragover: (event: DragEvent) => void
  onDrop: (event: DragEvent) => void
  onDragend: (event?: DragEvent) => void
  onKeydown: (event: KeyboardEvent) => void
}

export interface UseAffinoDataGridBaseBindingsResult<TRow> {
  createHeaderSortBindings: (columnKey: string) => {
    role: "columnheader"
    tabindex: number
    "aria-sort": "none" | "ascending" | "descending"
    onClick: (event?: MouseEvent) => void
    onKeydown: (event: KeyboardEvent) => void
  }
  createHeaderReorderBindings: (columnKey: string) => HeaderReorderBindings
  createRowSelectionBindings: (row: TRow, index: number) => {
    role: "row"
    tabindex: number
    "data-row-key": string
    "aria-selected": "true" | "false"
    onClick: (event?: MouseEvent) => void
    onKeydown: (event: KeyboardEvent) => void
  }
  createRowReorderBindings: (row: TRow, index: number) => RowReorderBindings
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
  const DRAG_COLUMN_KEY_MIME = "application/x-affino-datagrid-column-key"
  const DRAG_ROW_KEY_MIME = "application/x-affino-datagrid-row-key"
  let draggedColumnKey: string | null = null
  let draggedRowKey: string | null = null

  const resolveDraggedColumnKey = (event?: DragEvent): string | null => {
    const dataTransfer = event?.dataTransfer ?? null
    if (dataTransfer) {
      const explicit = dataTransfer.getData(DRAG_COLUMN_KEY_MIME)
      if (explicit) {
        return explicit
      }
      const fallback = dataTransfer.getData("text/plain")
      if (fallback) {
        return fallback
      }
    }
    return draggedColumnKey
  }

  const moveColumnBefore = (sourceKey: string, targetKey: string): boolean => {
    if (!sourceKey || !targetKey || sourceKey === targetKey) {
      return false
    }
    const currentOrder = [...options.resolveColumnOrder()]
    const sourceIndex = currentOrder.indexOf(sourceKey)
    const targetIndex = currentOrder.indexOf(targetKey)
    if (sourceIndex < 0 || targetIndex < 0) {
      return false
    }
    const withoutSource = currentOrder.filter(key => key !== sourceKey)
    const nextTargetIndex = withoutSource.indexOf(targetKey)
    if (nextTargetIndex < 0) {
      return false
    }
    withoutSource.splice(nextTargetIndex, 0, sourceKey)
    options.setColumnOrder(withoutSource)
    return true
  }

  const moveColumnByOffset = (columnKey: string, offset: -1 | 1): boolean => {
    const currentOrder = [...options.resolveColumnOrder()]
    const fromIndex = currentOrder.indexOf(columnKey)
    if (fromIndex < 0) {
      return false
    }
    const toIndex = Math.max(0, Math.min(currentOrder.length - 1, fromIndex + offset))
    if (toIndex === fromIndex) {
      return false
    }
    const [moved] = currentOrder.splice(fromIndex, 1)
    if (!moved) {
      return false
    }
    currentOrder.splice(toIndex, 0, moved)
    options.setColumnOrder(currentOrder)
    return true
  }

  const resolveDraggedRowKey = (event?: DragEvent): string | null => {
    const dataTransfer = event?.dataTransfer ?? null
    if (dataTransfer) {
      const explicit = dataTransfer.getData(DRAG_ROW_KEY_MIME)
      if (explicit) {
        return explicit
      }
      const fallback = dataTransfer.getData("text/plain")
      if (fallback) {
        return fallback
      }
    }
    return draggedRowKey
  }

  const moveRowByOffset = async (rowKey: string, offset: -1 | 1): Promise<boolean> => {
    if (!options.canReorderRows()) {
      return false
    }
    const order = options.resolveRowOrder()
    const fromIndex = order.indexOf(rowKey)
    if (fromIndex < 0) {
      return false
    }
    const targetIndex = fromIndex + offset
    if (targetIndex < 0 || targetIndex >= order.length) {
      return false
    }
    const targetKey = order[targetIndex]
    if (!targetKey) {
      return false
    }
    return options.moveRowByKey(rowKey, targetKey, offset > 0 ? "after" : "before")
  }

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

  const createHeaderReorderBindings = (columnKey: string): HeaderReorderBindings => ({
    draggable: true as const,
    "data-column-key": columnKey,
    onDragstart: (event: DragEvent) => {
      draggedColumnKey = columnKey
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData(DRAG_COLUMN_KEY_MIME, columnKey)
        event.dataTransfer.setData("text/plain", columnKey)
      }
    },
    onDragover: (event: DragEvent) => {
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move"
      }
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      const sourceKey = resolveDraggedColumnKey(event)
      if (!sourceKey) {
        draggedColumnKey = null
        return
      }
      moveColumnBefore(sourceKey, columnKey)
      draggedColumnKey = null
    },
    onDragend: (_event?: DragEvent) => {
      draggedColumnKey = null
    },
    onKeydown: (event: KeyboardEvent) => {
      if (!(event.altKey && event.shiftKey)) {
        return
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        moveColumnByOffset(columnKey, -1)
        return
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        moveColumnByOffset(columnKey, 1)
      }
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

  const createRowReorderBindings = (row: TRow, index: number): RowReorderBindings => {
    const rowKey = options.resolveRowKey(row, index)
    return {
      draggable: true as const,
      "data-row-key": rowKey,
      onDragstart: (event: DragEvent) => {
        if (!options.canReorderRows()) {
          event.preventDefault()
          draggedRowKey = null
          return
        }
        draggedRowKey = rowKey
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move"
          event.dataTransfer.setData(DRAG_ROW_KEY_MIME, rowKey)
          event.dataTransfer.setData("text/plain", rowKey)
        }
      },
      onDragover: (event: DragEvent) => {
        if (!options.canReorderRows()) {
          return
        }
        event.preventDefault()
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move"
        }
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault()
        if (!options.canReorderRows()) {
          draggedRowKey = null
          return
        }
        const sourceKey = resolveDraggedRowKey(event)
        if (!sourceKey) {
          draggedRowKey = null
          return
        }
        void options.moveRowByKey(sourceKey, rowKey, "before")
        draggedRowKey = null
      },
      onDragend: (_event?: DragEvent) => {
        draggedRowKey = null
      },
      onKeydown: (event: KeyboardEvent) => {
        if (!(event.altKey && event.shiftKey)) {
          return
        }
        if (event.key === "ArrowUp") {
          event.preventDefault()
          void moveRowByOffset(rowKey, -1)
          return
        }
        if (event.key === "ArrowDown") {
          event.preventDefault()
          void moveRowByOffset(rowKey, 1)
        }
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
    createHeaderReorderBindings,
    createRowSelectionBindings,
    createRowReorderBindings,
    createEditableCellBindings,
    createInlineEditorBindings,
  }
}
