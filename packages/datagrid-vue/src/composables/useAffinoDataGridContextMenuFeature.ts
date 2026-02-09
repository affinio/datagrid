import type { Ref } from "vue"
import type { DataGridColumnDef } from "@affino/datagrid-core"
import {
  useDataGridContextMenu,
  type DataGridContextMenuAction,
  type DataGridContextMenuActionId,
  type DataGridContextMenuState,
} from "./useDataGridContextMenu"

interface EditableCellParams<TRow> {
  row: TRow
  rowIndex: number
  columnKey: string
  editable?: boolean
  value?: unknown
}

interface EditableCellBindings {
  "data-row-key": string
  "data-column-key": string
  "data-inline-editable": "true" | "false"
  onDblclick: (event?: MouseEvent) => void
  onKeydown: (event: KeyboardEvent) => void
}

interface HeaderSortBindings {
  role: "columnheader"
  tabindex: number
  "aria-sort": "none" | "ascending" | "descending"
  onClick: (event?: MouseEvent) => void
  onKeydown: (event: KeyboardEvent) => void
}

export interface DataGridContextMenuFeatureActionOptions {
  columnKey?: string | null
}

export interface DataGridContextMenuFeatureActionBindingOptions<TActionResult> {
  onResult?: (result: TActionResult) => void
}

export interface UseAffinoDataGridContextMenuFeatureOptions<
  TRow,
  TActionId extends string,
  TActionResult,
> {
  columns: Ref<readonly DataGridColumnDef[]>
  resolveRowKey: (row: TRow, index: number) => string
  createHeaderSortBindings: (columnKey: string) => HeaderSortBindings
  createEditableCellBindings: (params: EditableCellParams<TRow>) => EditableCellBindings
  runAction: (
    actionId: TActionId,
    actionOptions?: DataGridContextMenuFeatureActionOptions,
  ) => Promise<TActionResult>
}

export interface UseAffinoDataGridContextMenuFeatureResult<
  TRow,
  TActionId extends string,
  TActionResult,
> {
  contextMenuState: Ref<DataGridContextMenuState>
  contextMenuStyle: Ref<{ left: string; top: string }>
  contextMenuActions: Ref<readonly DataGridContextMenuAction[]>
  contextMenuRef: Ref<HTMLElement | null>
  openContextMenu: (clientX: number, clientY: number, context: {
    zone: "header" | "cell" | "range"
    rowId?: string | null
    columnKey?: string | null
  }) => void
  closeContextMenu: () => void
  onContextMenuKeyDown: (event: KeyboardEvent, handlers?: { onEscape?: () => void }) => void
  runContextMenuAction: (actionId: DataGridContextMenuActionId) => Promise<TActionResult>
  createHeaderCellBindings: (columnKey: string) => HeaderSortBindings & { onContextmenu: (event: MouseEvent) => void }
  createDataCellBindings: (params: EditableCellParams<TRow>) => EditableCellBindings & { onContextmenu: (event: MouseEvent) => void }
  setContextMenuRef: (element: Element | null) => void
  createContextMenuRootBindings: (handlers?: { onEscape?: () => void }) => {
    role: "menu"
    tabindex: number
    onMousedown: (event: MouseEvent) => void
    onKeydown: (event: KeyboardEvent) => void
  }
  createContextMenuActionBinding: (
    actionId: DataGridContextMenuActionId,
    options?: DataGridContextMenuFeatureActionBindingOptions<TActionResult>,
  ) => {
    onClick: () => void
  }
  createActionButtonBinding: (
    actionId: TActionId,
    options?: DataGridContextMenuFeatureActionBindingOptions<TActionResult> & {
      actionOptions?: DataGridContextMenuFeatureActionOptions
    },
  ) => {
    onClick: () => void
  }
}

export function useAffinoDataGridContextMenuFeature<
  TRow,
  TActionId extends string,
  TActionResult,
>(
  options: UseAffinoDataGridContextMenuFeatureOptions<TRow, TActionId, TActionResult>,
): UseAffinoDataGridContextMenuFeatureResult<TRow, TActionId, TActionResult> {
  const contextMenuBridge = useDataGridContextMenu({
    isColumnResizable(columnKey) {
      return options.columns.value.some(column => column.key === columnKey)
    },
  })

  const runContextMenuAction = async (
    actionId: DataGridContextMenuActionId,
  ): Promise<TActionResult> => {
    const result = await options.runAction(actionId as TActionId, {
      columnKey: contextMenuBridge.contextMenu.value.columnKey,
    })
    contextMenuBridge.closeContextMenu()
    return result
  }

  const createHeaderCellBindings = (columnKey: string) => ({
    ...options.createHeaderSortBindings(columnKey),
    onContextmenu: (event: MouseEvent) => {
      event.preventDefault()
      contextMenuBridge.openContextMenu(event.clientX, event.clientY, {
        zone: "header",
        columnKey,
      })
    },
  })

  const createDataCellBindings = (params: EditableCellParams<TRow>) => {
    const base = options.createEditableCellBindings(params)
    return {
      ...base,
      onContextmenu: (event: MouseEvent) => {
        event.preventDefault()
        contextMenuBridge.openContextMenu(event.clientX, event.clientY, {
          zone: "cell",
          rowId: String(options.resolveRowKey(params.row, params.rowIndex)),
          columnKey: params.columnKey,
        })
      },
    }
  }

  const setContextMenuRef = (element: Element | null) => {
    contextMenuBridge.contextMenuRef.value = element as HTMLElement | null
  }

  const createContextMenuRootBindings = (handlers?: { onEscape?: () => void }) => ({
    role: "menu" as const,
    tabindex: -1,
    onMousedown: (event: MouseEvent) => {
      event.stopPropagation()
    },
    onKeydown: (event: KeyboardEvent) => {
      contextMenuBridge.onContextMenuKeyDown(event, handlers)
    },
  })

  const createContextMenuActionBinding = (
    actionId: DataGridContextMenuActionId,
    optionsWithResult: DataGridContextMenuFeatureActionBindingOptions<TActionResult> = {},
  ) => ({
    onClick: () => {
      void runContextMenuAction(actionId).then(result => {
        optionsWithResult.onResult?.(result)
      })
    },
  })

  const createActionButtonBinding = (
    actionId: TActionId,
    optionsWithResult: DataGridContextMenuFeatureActionBindingOptions<TActionResult> & {
      actionOptions?: DataGridContextMenuFeatureActionOptions
    } = {},
  ) => ({
    onClick: () => {
      void options.runAction(actionId, optionsWithResult.actionOptions).then(result => {
        optionsWithResult.onResult?.(result)
      })
    },
  })

  return {
    contextMenuState: contextMenuBridge.contextMenu,
    contextMenuStyle: contextMenuBridge.contextMenuStyle,
    contextMenuActions: contextMenuBridge.contextMenuActions,
    contextMenuRef: contextMenuBridge.contextMenuRef,
    openContextMenu: contextMenuBridge.openContextMenu,
    closeContextMenu: contextMenuBridge.closeContextMenu,
    onContextMenuKeyDown: contextMenuBridge.onContextMenuKeyDown,
    runContextMenuAction,
    createHeaderCellBindings,
    createDataCellBindings,
    setContextMenuRef,
    createContextMenuRootBindings,
    createContextMenuActionBinding,
    createActionButtonBinding,
  }
}
