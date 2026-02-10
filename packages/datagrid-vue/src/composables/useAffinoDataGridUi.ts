import { computed, ref, type Ref } from "vue"
import { useAffinoDataGrid } from "./useAffinoDataGrid"
import type { DataGridContextMenuActionId } from "./useDataGridContextMenu"
import type {
  AffinoDataGridActionId,
  AffinoDataGridActionResult,
  UseAffinoDataGridOptions,
  UseAffinoDataGridResult,
} from "./useAffinoDataGrid.types"

const DEFAULT_ACTION_LABELS: Record<AffinoDataGridActionId, string> = {
  copy: "Copy",
  cut: "Cut",
  paste: "Paste",
  clear: "Clear",
  "sort-asc": "Sort ascending",
  "sort-desc": "Sort descending",
  "sort-clear": "Clear sort",
  filter: "Filter",
  "auto-size": "Auto size",
  "select-all": "Select all",
  "clear-selection": "Clear selection",
}

const DEFAULT_TOOLBAR_ACTIONS: readonly AffinoDataGridActionId[] = [
  "copy",
  "cut",
  "paste",
  "select-all",
  "clear-selection",
]

export interface AffinoDataGridUiToolbarAction {
  id: AffinoDataGridActionId
  label: string
}

export interface UseAffinoDataGridUiOptions<TRow> extends UseAffinoDataGridOptions<TRow> {
  status?: Ref<string>
  initialStatus?: string
  toolbarActions?: readonly AffinoDataGridActionId[]
  actionLabels?: Partial<Record<AffinoDataGridActionId, string>>
}

export interface UseAffinoDataGridUiResult<TRow> extends UseAffinoDataGridResult<TRow> {
  ui: {
    status: Ref<string>
    setStatus: (message: string) => void
    applyActionResult: (result: AffinoDataGridActionResult) => void
    resolveActionLabel: (actionId: AffinoDataGridActionId) => string
    toolbarActions: Ref<readonly AffinoDataGridUiToolbarAction[]>
    bindToolbarAction: (actionId: AffinoDataGridActionId) => { onClick: () => void }
    bindContextMenuAction: (
      actionId: DataGridContextMenuActionId,
      options?: Parameters<UseAffinoDataGridResult<TRow>["bindings"]["contextMenuAction"]>[1],
    ) => ReturnType<UseAffinoDataGridResult<TRow>["bindings"]["contextMenuAction"]>
    bindHeaderCell: (columnKey: string) => ReturnType<UseAffinoDataGridResult<TRow>["bindings"]["headerCell"]>
    bindRowSelection: UseAffinoDataGridResult<TRow>["bindings"]["rowSelection"]
    bindDataCell: UseAffinoDataGridResult<TRow>["bindings"]["dataCell"]
    bindInlineEditor: UseAffinoDataGridResult<TRow>["bindings"]["inlineEditor"]
    isCellEditing: UseAffinoDataGridResult<TRow>["bindings"]["isCellEditing"]
    resolveHeaderAriaSort: (columnKey: string) => "none" | "ascending" | "descending"
    bindContextMenuRoot: UseAffinoDataGridResult<TRow>["bindings"]["contextMenuRoot"]
    bindContextMenuRef: UseAffinoDataGridResult<TRow>["bindings"]["contextMenuRef"]
  }
}

export function useAffinoDataGridUi<TRow>(
  options: UseAffinoDataGridUiOptions<TRow>,
): UseAffinoDataGridUiResult<TRow> {
  const grid = useAffinoDataGrid<TRow>(options)
  const status = options.status ?? ref(options.initialStatus ?? "Ready")

  const setStatus = (message: string): void => {
    status.value = message
  }

  const applyActionResult = (result: AffinoDataGridActionResult): void => {
    setStatus(result.message)
  }

  const resolveActionLabel = (actionId: AffinoDataGridActionId): string => (
    options.actionLabels?.[actionId] ?? DEFAULT_ACTION_LABELS[actionId] ?? actionId
  )

  const toolbarActions = computed<readonly AffinoDataGridUiToolbarAction[]>(() => {
    const ids = options.toolbarActions ?? DEFAULT_TOOLBAR_ACTIONS
    return ids.map(id => ({
      id,
      label: resolveActionLabel(id),
    }))
  })

  const bindToolbarAction = (actionId: AffinoDataGridActionId) => grid.bindings.actionButton(actionId, {
    onResult: applyActionResult,
  })

  const bindContextMenuAction = (
    actionId: DataGridContextMenuActionId,
    options: Parameters<UseAffinoDataGridResult<TRow>["bindings"]["contextMenuAction"]>[1] = {},
  ) => grid.bindings.contextMenuAction(actionId, {
    ...options,
    onResult: result => {
      applyActionResult(result)
      options.onResult?.(result)
    },
  })

  const bindHeaderCell = (columnKey: string) => {
    const base = grid.bindings.headerCell(columnKey)
    return {
      ...base,
      onClick: (event?: MouseEvent) => {
        base.onClick(event)
        setStatus(`Sorted by ${columnKey}`)
      },
    }
  }

  const resolveHeaderAriaSort = (columnKey: string): "none" | "ascending" | "descending" => (
    grid.bindings.headerSort(columnKey)["aria-sort"]
  )

  return {
    ...grid,
    ui: {
      status,
      setStatus,
      applyActionResult,
      resolveActionLabel,
      toolbarActions,
      bindToolbarAction,
      bindContextMenuAction,
      bindHeaderCell,
      bindRowSelection: grid.bindings.rowSelection,
      bindDataCell: grid.bindings.dataCell,
      bindInlineEditor: grid.bindings.inlineEditor,
      isCellEditing: grid.bindings.isCellEditing,
      resolveHeaderAriaSort,
      bindContextMenuRoot: grid.bindings.contextMenuRoot,
      bindContextMenuRef: grid.bindings.contextMenuRef,
    },
  }
}
